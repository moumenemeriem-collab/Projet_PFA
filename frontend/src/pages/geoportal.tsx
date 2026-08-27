import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { icons, Icon } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { TerrainGeometryEditor, emptyGeom, type TerrainGeom } from '../components/TerrainGeometryEditor'
import { formatApiErrors } from '../api/auth'
import { fetchProjet, previewRentabilite, type Projet, type ProjetPayload, type Rentabilite } from '../api/projets'
import { createTerrain, computeSurfaceConstructible, computeSurfaceEquipement, fetchSurfaceConstructible, fetchSurfaceEquipement, fetchTerrains, saveTerrainRentabilite, type AnalyseFiltres, type AnalyseResultat, type SurfaceConstructibleResponse, type SurfaceEquipementResponse, type Terrain } from '../api/terrains'
import { fetchAnalyseDetail, type AnalyseDetail, type ResultatAnalyse } from '../api/analyses'
import { createAnalysePondere, type PonderationResponse, type TerrainPondere } from '../api/analyses'
import { fetchCouches, fetchCoucheGeoJSON, type Couche, type CoucheFeature, type CoucheFeatureCollection } from '../api/couches'
import { attributeLabel, CADASTRE_ATTRIBUTE_LABELS, PLAN_AMENAGEMENT_ATTRIBUTE_LABELS } from '../utils/attributeLabels'
import { getReglesPrincipales } from '../utils/reglementationPA'
import { CritereSelectionStep } from '../components/ponderation/CritereSelectionStep'
import { AhpStep } from '../components/ponderation/AhpStep'
import { RocStep } from '../components/ponderation/RocStep'
import { ResultatsStep } from '../components/ponderation/ResultatsStep'
import { type AhpResult } from '../utils/ahp'
import { t } from '../i18n/index'
import {
  closeRing,
  extractRing,
  openGoogleMaps,
  polygonAreaM2,
  ringAreaM2,
  ringCenter,
  showTerrainDims,
} from '../utils/terrainDims'
import {
  computeParcelAffectations,
  preparePAZones,
  showAffectationsModal,
  type AffectationPiece,
  type PreparedPAZone,
} from '../utils/affectations'

import osmImg from '../assets/features/OSM.png'
import satImg from '../assets/features/osm_sat.jpg'
import topoImg from '../assets/features/osm_topo.jpeg'

// Aperçu SVG embarqué (data URI) pour les fonds de carte sans vignette PNG locale.
// Ratio 4:3 identique aux vignettes PNG (aspect-ratio de .geo-popup-basemap-img).
const svgThumb = (body: string): string => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180" preserveAspectRatio="xMidYMid slice">${body}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const darkThumb = svgThumb(
  '<rect width="240" height="180" fill="#1a2230"/>' +
  '<path d="M0 45h240M0 90h240M0 135h240M60 0v180M120 0v180M180 0v180" stroke="#242e3f" stroke-width="2"/>' +
  '<rect x="10" y="55" width="40" height="26" rx="4" fill="#173a5e" opacity="0.85"/>' +
  '<rect x="180" y="20" width="46" height="30" rx="4" fill="#23405f" opacity="0.9"/>' +
  '<rect x="180" y="110" width="50" height="32" rx="4" fill="#173a5e" opacity="0.85"/>' +
  '<rect x="70" y="120" width="36" height="24" rx="4" fill="#23405f" opacity="0.9"/>'
)

const lightThumb = svgThumb(
  '<rect width="240" height="180" fill="#eef2f6"/>' +
  '<path d="M0 45h240M0 90h240M0 135h240M60 0v180M120 0v180M180 0v180" stroke="#d9e2ec" stroke-width="2"/>' +
  '<rect x="10" y="55" width="40" height="26" rx="4" fill="#bfdbfe" opacity="0.9"/>' +
  '<rect x="180" y="20" width="46" height="30" rx="4" fill="#dbe3ec" stroke="#c3cfdb" stroke-width="1.5"/>' +
  '<rect x="180" y="110" width="50" height="32" rx="4" fill="#bfdbfe" opacity="0.9"/>' +
  '<rect x="70" y="120" width="36" height="24" rx="4" fill="#dbe3ec" stroke="#c3cfdb" stroke-width="1.5"/>'
)

const BASEMAPS: { id: string; name: string; url: string; attribution: string; img: string }[] = [
  { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap', img: osmImg },
  { id: 'satellite', name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri', img: satImg },
  { id: 'topo', name: 'Topographique', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap', img: topoImg },
  { id: 'dark', name: 'Sombre', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CARTO', img: darkThumb },
  { id: 'light', name: 'Clair', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CARTO', img: lightThumb },
]

const OVERLAY_LAYERS: { id: string; name: string; url: string; attribution: string; opacity: number }[] = [
  { id: 'transport', name: 'Transport', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '&copy; OSM FR', opacity: 0.6 },
]

interface CoucheType {
  key: string
  coucheId: number
  type: string
  count: number
}

const ROUTE_STYLES: Record<string, { color: string; weight: number; dashArray?: string }> = {
  motorway: { color: '#f97316', weight: 5 },
  trunk: { color: '#e11d48', weight: 4 },
  primary: { color: '#1b3a6e', weight: 3 },
  secondary: { color: '#16a34a', weight: 2.5 },
  tertiary: { color: '#a16207', weight: 2 },
}

const TEMARA_BOUNDS: [[number, number], [number, number]] = [
  [33.7, -7.1],
  [34.05, -6.75],
]

const STATUTS_JURIDIQUES: { value: string; label: string }[] = [
  { value: 'titre', label: 'statut_titre' },
  { value: 'requisition', label: 'statut_requisition' },
  { value: 'non_immatricule', label: 'statut_non_immatricule' },
  { value: 'collectif', label: 'statut_collectif' },
]

const ZONAGES: { value: string; label: string }[] = [
  { value: 'residentiel', label: 'zonage_residentiel' },
  { value: 'commercial', label: 'zonage_commercial' },
  { value: 'industriel', label: 'zonage_industriel' },
  { value: 'agricole', label: 'zonage_agricole' },
  { value: 'mixte', label: 'zonage_mixte' },
]

// Mesure l'espace occupé par les panneaux qui recouvrent la carte (`.geo-terrain-card`
// à droite, `.geo-nav` en haut) afin que la zone RÉELLEMENT VISIBLE en tienne compte.
// Réutilisé par `centerMapOnPoint` (panBy) et par `overlayFlyToBounds` (flyToBounds).
const getMapOverlayPadding = (map: any): { top: number; right: number } => {
  let top = 0
  let right = 0
  const container = map?.getContainer() as HTMLElement | null
  if (!container) return { top, right }
  const holder = container.closest('.geo-map-container') ?? container
  const card = holder.querySelector<HTMLElement>('.geo-terrain-card')
  if (card && !card.classList.contains('geo-terrain-card--hidden')) {
    right = card.offsetWidth + 16
  }
  const nav = holder.querySelector<HTMLElement>('.geo-nav')
  if (nav && nav.offsetHeight > 0) {
    top = nav.offsetHeight + 20
  }
  return { top, right }
}

const centerMapOnPoint = (map: any, latlng: any): void => {
  if (!map || !latlng) return
  const size = map.getSize()
  const { top, right } = getMapOverlayPadding(map)
  const cx = (size.x - right) / 2
  const cy = (size.y + top) / 2
  const p = map.latLngToContainerPoint(latlng)
  map.panBy([p.x - cx, p.y - cy], { animate: true, duration: 0.3 })
}

// Équivalent pour flyToBounds/fitBounds : traduit le padding des panneaux flottants
// en options paddingTopLeft/paddingBottomRight, comprises nativement par Leaflet.
const overlayFlyToBounds = (map: any, bounds: any, opts: Record<string, unknown> = {}): void => {
  if (!map || !bounds) return
  try {
    const sw = bounds.getSouthWest?.()
    const ne = bounds.getNorthEast?.()
    if (!sw || !ne || !Number.isFinite(sw.lat) || !Number.isFinite(ne.lat)) return
  } catch {
    return
  }
  const { top, right } = getMapOverlayPadding(map)
  map.flyToBounds(bounds, {
    paddingTopLeft: [0, top],
    paddingBottomRight: [right, 0],
    ...opts,
  })
}
// Correspondance entre les valeurs des filtres de l'analyse AMC et les types
// OSM utilisés par les couches `reseau_routier` / `equipements_publics`.
const FILTRE_ROUTE_OSM: Record<string, string[]> = {
  route_nationale: ['motorway', 'trunk'],
  route_regionale: ['primary'],
  route_provinciale: ['secondary'],
  route_locale: ['tertiary'],
  peu_importe: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
}

const BUFFER_COLORS: Record<string, string> = {
  distance_route: '#1b3a6e',
  distance_health: '#dc2626',
  distance_education: '#ea580c',
  distance_commerce: '#7c3aed',
  distance_transport: '#0d9488',
  distance_admin: '#16a34a',
  distance_poles: '#db2777',
}

// Doit rester synchronisé avec `transition: width 0.28s` de `.geo-sidebar` (geoportal.css)
const SIDEBAR_TRANSITION_MS = 280

const CADASTRE_STYLE = { color: '#b45309', weight: 1.4, opacity: 0.9, fillColor: '#f59e0b', fillOpacity: 0.18 }
const CADASTRE_SEARCH_STYLE = { color: '#dc2626', weight: 4, opacity: 1, fillColor: '#ef4444', fillOpacity: 0.45 }
const PLAN_AMENAGEMENT_STYLE = { color: '#7c3aed', weight: 1.2, opacity: 0.85, fillColor: '#a855f7', fillOpacity: 0.16 }

// Règlement du plan d'aménagement, servi depuis le dossier public (Vite dev et build).
// Le fichier PDF définitif sera fourni par le client et placé à cet emplacement.
const REGLEMENT_PDF_URL = '/reglements/reglement-plan-amenagement.pdf'

const TYPE_LABELS: Record<string, string> = {
  motorway: 'Autoroute',
  trunk: 'Voie rapide',
  primary: 'Route principale',
  secondary: 'Route secondaire',
  tertiary: 'Route tertiaire',
  pharmacy: 'Pharmacie',
  cafe: 'Café',
  restaurant: 'Restaurant',
  fuel: 'Station-service',
  place_of_worship: 'Lieu de culte',
  fast_food: 'Restauration rapide',
  bank: 'Banque',
  school: 'École',
  post_office: 'Bureau de poste',
  driving_school: 'Auto-école',
  parking: 'Parking',
  taxi: 'Taxi',
  doctors: 'Médecin',
  parking_entrance: 'Entrée de parking',
  money_transfer: 'Transfert d\'argent',
  bar: 'Bar',
  police: 'Police',
  kindergarten: 'Maternelle',
  dentist: 'Dentiste',
  atm: 'Distributeur',
  hospital: 'Hôpital',
  community_centre: 'Centre communautaire',
  car_wash: 'Lavage auto',
  internet_cafe: 'Cybercafé',
  courthouse: 'Tribunal',
  animal_breeding: 'Élevage',
  nursing_home: 'Maison de retraite',
  vehicle_inspection: 'Contrôle technique',
  drinking_water: 'Eau potable',
  payment_terminal: 'Terminal de paiement',
  childcare: 'Garde d\'enfants',
  water_point: 'Point d\'eau',
  prep_school: 'École préparatoire',
  charging_station: 'Borne de recharge',
  bus_station: 'Gare routière',
  surf_school: 'École de surf',
  fountain: 'Fontaine',
  toilets: 'Toilettes',
  hunting_stand: 'Poste de chasse',
  '': 'Autre',
}

// --- Équipements PA Temara : groupement par préfixe de designation ---
// S% → Santé,  E% → Enseignement,  A% → Administration
const EQUIP_PA_GROUPS: { key: string; label: string; prefix: string; symbol: string }[] = [
  { key: 'Santé', label: 'Santé', prefix: 'S', symbol: '<path d="M12 4v16M4 12h16"/>' },
  { key: 'Enseignement', label: 'Enseignement', prefix: 'E', symbol: '<path d="M12 4l10 4-10 4L2 8z"/><path d="M5 10.5V16c2.5 2.5 9 2.5 14 0v-5.5"/>' },
  { key: 'Administration', label: 'Administration', prefix: 'A', symbol: '<rect x="4" y="6" width="16" height="12"/><path d="M4 7l8 6 8-6"/>' },
]

/** Retourne le groupe PA d'un équipement à partir de sa designation. */
function equipGroupOfDesignation(designation: string | null | undefined): string {
  if (!designation) return 'Autres'
  const prefix = designation.trim().charAt(0).toUpperCase()
  return EQUIP_PA_GROUPS.find((g) => g.prefix === prefix)?.key ?? 'Autres'
}

/** Icône SVG du groupe. */
function equipGroupSymbol(group: string): string {
  return EQUIP_PA_GROUPS.find((g) => g.key === group)?.symbol ?? '<circle cx="12" cy="12" r="5"/>'
}


function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const GMAP_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'

const DIMS_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 21 7M7 17 21 11M3 21 5 19"/><path d="M3 17l4-4m6 2 4-4"/></svg>'

const PARCELLES_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'

const DETAIL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'

interface PopupAffectationsOpts {
  idParcelle: string
  computed: boolean
}

// Pied d'action commun aux popups : « Voir sur Google Maps » + « Dimensions du
// terrain » + « Voir les parcelles » (affectations du plan d'aménagement).
// Réservé aux parcelles cadastrales, qui disposent d'un anneau.
interface RentaPopupInfo { terrainId?: number; nom?: string; superficie?: number; lat?: number; lng?: number; ref?: string; ring?: number[][] }

const buildPopupActions = (lat: number, lng: number, ring?: number[][] | null, title?: string, affectations?: PopupAffectationsOpts | null, rentaInfo?: RentaPopupInfo): string => {
  const gmap = Number.isFinite(lat) && Number.isFinite(lng)
    ? `<button type="button" class="geo-popup-btn" data-action="gmaps" data-lat="${lat.toFixed(6)}" data-lng="${lng.toFixed(6)}">${GMAP_ICON}<span>Voir sur Google Maps</span></button>`
    : ''
  const dims = ring && ring.length >= 3
    ? `<button type="button" class="geo-popup-btn geo-popup-btn--primary" data-action="dims" data-geom="${escapeHtml(JSON.stringify(ring))}" data-title="${escapeHtml(title ?? '')}">${DIMS_ICON}<span>Dimensions du terrain</span></button>`
    : ''
  const aff = affectations && ring && ring.length >= 3
    ? affectations.computed
      ? `<button type="button" class="geo-popup-btn geo-popup-btn--primary" data-action="affectations-detail" data-parcelle="${escapeHtml(affectations.idParcelle)}">${DETAIL_ICON}<span>Voir Détail</span></button>`
      : `<button type="button" class="geo-popup-btn geo-popup-btn--primary" data-action="parcelles" data-parcelle="${escapeHtml(affectations.idParcelle)}">${PARCELLES_ICON}<span>Voir les parcelles</span></button>`
    : ''
  const renta = ring && ring.length >= 3
    ? (() => {
        const fallbackSurf = Math.round(ringAreaM2(ring))
        const ri = rentaInfo ?? { nom: title ?? '', superficie: fallbackSurf, lat, lng, ref: title ?? '', ring }
        const finalSurf = (ri.superficie ?? 0) > 0 ? (ri.superficie ?? 0) : fallbackSurf
        return `<button type="button" class="geo-popup-btn geo-popup-btn--renta" data-action="rentabilite" data-terrain-id="${ri.terrainId ?? ''}" data-terrain-nom="${escapeHtml(ri.nom ?? '')}" data-terrain-surf="${finalSurf}" data-terrain-lat="${ri.lat ?? ''}" data-terrain-lng="${ri.lng ?? ''}" data-terrain-ref="${escapeHtml(ri.ref ?? '')}" data-terrain-ring="${escapeHtml(JSON.stringify(ri.ring ?? []))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>Calculer la rentabilit&eacute;</span></button>`
      })()
    : ''
  if (!gmap && !dims && !aff && !renta) return ''
  return `<div class="geo-popup-actions">${gmap}${dims}${aff}${renta}</div>`
}

function isValidGeoJSONFeature(f: CoucheFeature): boolean {
  const g = f?.geometry
  if (!g || typeof g !== 'object' || Array.isArray(g)) return false
  const geom = g as { type?: unknown; coordinates?: unknown }
  return typeof geom.type === 'string' && Array.isArray(geom.coordinates)
}

function validFeatures(fc: CoucheFeatureCollection): CoucheFeatureCollection {
  return { type: 'FeatureCollection', features: fc.features.filter(isValidGeoJSONFeature) }
}

function propsToHtml(props: Record<string, unknown>, labels?: Record<string, string>, exclude?: string[]): string {
  return Object.entries(props)
    .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !(exclude && exclude.includes(k)))
    .map(([k, v]) => `<div><strong>${escapeHtml(attributeLabel(k, labels))}</strong> : ${escapeHtml(v)}</div>`)
    .join('')
}

type CardMode = 'search' | 'loading' | 'results' | 'terrainList' | 'empty' | 'addTerrain' | 'ponderationDetail'

function getScoreColor(score: number): string {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#eab308'
  return '#dc2626'
}

function ordinalSuffix(n: number): string {
  if (n === 1) return 'er'
  return 'ᵉ'
}

function toAnalyseResultat(r: ResultatAnalyse): AnalyseResultat {
  return {
    id: r.id_parcelle != null ? Number(r.id_parcelle) : 0,
    nom: r.nom || `Parcelle ${r.id_parcelle}`,
    superficie: r.superficie ?? 0,
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    score_global: r.score_final ?? 0,
    score_final: r.score_final ?? 0,
    score_amc: r.score_amc ?? 0,
    score_accessibilite: r.score_accessibilite ?? null,
    score_positionnement: r.score_positionnement ?? null,
    score_topographie: r.score_topographie ?? null,
    score_superficie: r.score_superficie,
    roi: r.roi,
    marge: r.marge,
    benefice_net: r.benefice_net,
    score_rentabilite: r.score_rentabilite,
    type_rentabilite: (r.type_rentabilite || 'indisponible') as AnalyseResultat['type_rentabilite'],
    prix_terrain: r.prix_terrain,
    infos_generales: {
      reference_cadastrale: r.reference_cadastrale || r.id_parcelle || '—',
      commune: '—',
      province: '—',
      region: '—',
      superficie: `${(r.superficie ?? 0).toFixed(2)} m²`,
      perimetre: '—',
      latitude: r.lat ?? 0,
      longitude: r.lng ?? 0,
      zone_amenagement: '—',
    },
    criteres: r.criteres ?? [],
    criteres_satisfaits: r.nombre_criteres_satisfaits,
    criteres_total: r.total_criteres,
    criteres_conformite: (r as any).criteres_conformite ?? [],
    classement: r.rang ?? 0,
    points_forts: r.points_forts ?? [],
    points_faibles: r.points_faibles ?? [],
    geom: (r as any).geom ?? (r as any).geometry ?? null,
  }
}

export function GeoportalPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const projetId = Number(id)
  const [projet, setProjet] = useState<Projet | null>(null)
  const [projetError, setProjetError] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [cardHidden, setCardHidden] = useState(true)
  const [cardMode, setCardMode] = useState<CardMode>('search')
  const [selectedTerrain, setSelectedTerrain] = useState<AnalyseResultat | null>(null)
  const [selectedPonderationTerrain, setSelectedPonderationTerrain] = useState<TerrainPondere | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [geomMissing, setGeomMissing] = useState(false)
  const [coord, setCoord] = useState('Lat: — , Lng: —')
  const [layersPopupOpen, setLayersPopupOpen] = useState(false)
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [basemapId, setBasemapId] = useState<string>(BASEMAPS[0].id)
  const [overlays, setOverlays] = useState<Record<string, boolean>>({})
  const [couchesDispo, setCouchesDispo] = useState<Couche[]>([])
  const [routeTypes, setRouteTypes] = useState<CoucheType[]>([])
  const [equipTypes, setEquipTypes] = useState<CoucheType[]>([])
  const [typeToggles, setTypeToggles] = useState<Record<string, boolean>>({})
  const [coucheSectionsOpen, setCoucheSectionsOpen] = useState<Record<string, boolean>>({ routes: true, equipements: true })
  const [cadastreEnabled, setCadastreEnabled] = useState(false)
  const [cadastreReady, setCadastreReady] = useState(false)
  const [cadastreFc, setCadastreFc] = useState<CoucheFeatureCollection | null>(null)
  const [paEnabled, setPaEnabled] = useState(false)
  const [savedAnalyse, setSavedAnalyse] = useState<AnalyseDetail | null>(null)
  const [showSavedBanner, setShowSavedBanner] = useState(false)
  const [cadastreQuery, setCadastreQuery] = useState('')
  const [coucheCounts, setCoucheCounts] = useState<Record<string, number>>({})

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const currentLayerRef = useRef<any>(null)
  const analyzePendingRef = useRef(false)
  const selectedTerrainIdRef = useRef<number | null>(null)
  const selectedMarkerRef = useRef<any>(null)
  const selectedGeomLayerRef = useRef<any>(null)
  const focusParcelleRef = useRef<number | null>(null)
  const analyseResultatsRef = useRef<AnalyseResultat[]>([])
  const overlayLayersRef = useRef<Record<string, any>>({})
  const coucheDataRef = useRef<Record<number, CoucheFeatureCollection>>({})
  const typeLayersRef = useRef<Record<string, any>>({})
  const cadastreLayerRef = useRef<any>(null)
  const paLayerRef = useRef<any>(null)
  const layersBarRef = useRef<HTMLDivElement>(null)
  const basemapMenuRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const pendingSearchRef = useRef<string | null>(null)
  const searchParcelleRef = useRef<string | null>(null)
  const analyseFiltresRef = useRef<AnalyseFiltres | null>(null)
  const bufferLayerRef = useRef<any>(null)
  const paPreparedRef = useRef<PreparedPAZone[] | null>(null)
  const affectationsLayerRef = useRef<any>(null)
  const affectationsResultRef = useRef<{ terrainNum: string; pieces: AffectationPiece[]; title: string } | null>(null)
  const drawModeRef = useRef(false)
  const drawPointsRef = useRef<[number, number][]>([])
  const drawLayerRef = useRef<any>(null)

  const [drawMode, setDrawMode] = useState(false)
  const [drawPointCount, setDrawPointCount] = useState(0)
  const [drawFinished, setDrawFinished] = useState<{ area: number; center: { lat: number; lng: number }; geometry: string } | null>(null)
  const [drawError, setDrawError] = useState<string | null>(null)
  const [terrainForm, setTerrainForm] = useState({
    num_titre_foncier: '',
    statut_juridique: '',
    prix_demande: '',
    zonage: '',
    cos: '',
    cus: '',
    hauteur_maximale: '',
    equipements: [] as string[],
    geom: emptyGeom(),
  })
  const [savingTerrain, setSavingTerrain] = useState(false)
  const [terrainError, setTerrainError] = useState<string | null>(null)
  const [terrainNote, setTerrainNote] = useState<string | null>(null)
  const addTerrainRef = useRef<HTMLDivElement>(null)

  // ── Pondération multicritère (AHP + ROC) ──
  type WizardStep = 'selection' | 'ahp' | 'roc' | 'resultats'
  const [wizardStep, setWizardStep] = useState<WizardStep>('selection')
  const [wizardLoading, setWizardLoading] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [wizardSelections, setWizardSelections] = useState<{
    accessibilite: string[]
    route_type: string
    localisation: string
    altitude: string[]
  } | null>(null)
  const [wizardMatriceAhp, setWizardMatriceAhp] = useState<[number, number] | null>(null)
  const [wizardOrdreCategoriesAhp, setWizardOrdreCategoriesAhp] = useState<string[]>([])
  const [_wizardAhpResult, setWizardAhpResult] = useState<AhpResult | null>(null)
  const [wizardOrdresRoc, setWizardOrdresRoc] = useState<Record<string, string[]>>({})
  const [wizardRocStepsDone, setWizardRocStepsDone] = useState<string[]>([])
  const [wizardResultats, setWizardResultats] = useState<PonderationResponse | null>(null)

  const WIZARD_CATEGORIE_LABELS: Record<string, string> = {
    accessibilite: 'Accessibilité',
    positionnement: 'Positionnement',
    topographie: 'Topographie',
  }

  const CRITERE_LABELS: Record<string, string> = {
    enseignement: 'Enseignement',
    sante: 'Santé',
    administration: 'Administration',
    routes: 'Routes',
    localisation: 'Localisation',
    altitude: 'Altitude',
  }

  const handleWizardSelectionComplete = useCallback((sel: typeof wizardSelections & {}): void => {
    setWizardSelections(sel)
    setWizardStep('ahp')
  }, [])

  const handleWizardAhpComplete = useCallback((intensites: [number, number], ordre: string[], resultat: AhpResult): void => {
    setWizardMatriceAhp(intensites)
    setWizardOrdreCategoriesAhp(ordre)
    setWizardAhpResult(resultat)
    if (!wizardSelections) return
    const newOrdres: Record<string, string[]> = {}
    if (wizardSelections.accessibilite.length > 0) {
      newOrdres.accessibilite = [...wizardSelections.accessibilite]
    }
    newOrdres.positionnement = ['localisation']
    if (wizardSelections.altitude.length > 0) {
      newOrdres.topographie = ['altitude']
    }
    setWizardOrdresRoc(newOrdres)
    setWizardRocStepsDone([])
    setWizardStep('roc')
  }, [wizardSelections])

  const handleWizardRocComplete = useCallback((categorie: string, ordre: string[]): void => {
    setWizardOrdresRoc((prev) => ({ ...prev, [categorie]: ordre }))
    setWizardRocStepsDone((prev) => [...prev, categorie])
  }, [])

  const wizardRocCatsAll = Object.keys(wizardOrdresRoc)
  const wizardRocCatsNeedRanking = wizardRocCatsAll.filter((c) => (wizardOrdresRoc[c]?.length ?? 0) > 1)
  const wizardNextRocCat = wizardRocCatsNeedRanking.find((c) => !wizardRocStepsDone.includes(c))

  // Auto-valider les catégories avec un seul sous-critère
  useEffect(() => {
    if (wizardStep !== 'roc') return
    const singleCritCats = wizardRocCatsAll.filter(
      (c) => (wizardOrdresRoc[c]?.length ?? 0) === 1 && !wizardRocStepsDone.includes(c),
    )
    if (singleCritCats.length > 0) {
      setWizardRocStepsDone((prev) => [...prev, ...singleCritCats])
    }
  }, [wizardStep, wizardRocCatsAll, wizardOrdresRoc, wizardRocStepsDone])

  const allRocDone = wizardRocCatsAll.length > 0 && wizardRocCatsAll.every((c) => wizardRocStepsDone.includes(c))

  useEffect(() => {
    if (!allRocDone || wizardStep !== 'roc' || !projetId) return
    const run = async (): Promise<void> => {
      setWizardLoading(true)
      setWizardError(null)
      try {
        const response = await createAnalysePondere(projetId, {
          matrice_ahp: wizardMatriceAhp!,
          ordre_categories: wizardOrdreCategoriesAhp,
          ordres_roc: wizardOrdresRoc,
          selections_criteres: {
            accessibilite: wizardSelections?.accessibilite ?? [],
            route_type: wizardSelections?.route_type ?? 'peu_importe',
          },
          preferences_localisation: {
            localisation: wizardSelections?.localisation ?? '',
          },
          preferences_altitude: Array.isArray(wizardSelections?.altitude) ? wizardSelections!.altitude : [],
          seuil: 0,
        })
        setWizardResultats(response)
        setWizardStep('resultats')
      } catch (err) {
        setWizardError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setWizardLoading(false)
      }
    }
    void run()
  }, [allRocDone, wizardStep, wizardMatriceAhp, wizardOrdreCategoriesAhp, wizardOrdresRoc, wizardSelections, projetId])

  const handleWizardRestart = (): void => {
    setWizardStep('selection')
    setWizardSelections(null)
    setWizardMatriceAhp(null)
    setWizardOrdreCategoriesAhp([])
    setWizardAhpResult(null)
    setWizardOrdresRoc({})
    setWizardRocStepsDone([])
    setWizardResultats(null)
    setWizardError(null)
  }

  const handleWizardViewOnMap = useCallback((terrain: TerrainPondere): void => {
    // Convertir le terrain pondéré en AnalyseResultat pour le système existant
    const result: AnalyseResultat = {
      id: terrain.id,
      nom: terrain.nom,
      superficie: terrain.superficie,
      lat: terrain.lat,
      lng: terrain.lng,
      score_global: terrain.score_final,
      score_final: terrain.score_final,
      score_amc: 0,
      score_accessibilite: null,
      score_positionnement: null,
      score_topographie: null,
      score_superficie: null,
      roi: null,
      marge: null,
      benefice_net: null,
      score_rentabilite: null,
      type_rentabilite: 'indisponible',
      prix_terrain: null,
      infos_generales: {
        reference_cadastrale: terrain.reference_cadastrale || terrain.nom,
        commune: '—',
        province: '—',
        region: '—',
        superficie: `${terrain.superficie.toFixed(2)} m²`,
        perimetre: '—',
        latitude: terrain.lat,
        longitude: terrain.lng,
        zone_amenagement: '—',
      },
      criteres: [],
      criteres_satisfaits: 0,
      criteres_total: 0,
      criteres_conformite: [],
      classement: terrain.rang,
      points_forts: [],
      points_faibles: [],
    }
    // Ajouter aux résultats de l'analyse pour que la carte puisse les afficher
    analyseResultatsRef.current = wizardResultats!.resultats.map((tp) => ({
      id: tp.id,
      nom: tp.nom,
      superficie: tp.superficie,
      lat: tp.lat,
      lng: tp.lng,
      score_global: tp.score_final,
      score_final: tp.score_final,
      score_amc: 0,
      score_accessibilite: null,
      score_positionnement: null,
      score_topographie: null,
      score_superficie: null,
      roi: null,
      marge: null,
      benefice_net: null,
      score_rentabilite: null,
      type_rentabilite: 'indisponible' as const,
      prix_terrain: null,
      infos_generales: {
        reference_cadastrale: tp.reference_cadastrale || tp.nom,
        commune: '—',
        province: '—',
        region: '—',
        superficie: `${tp.superficie.toFixed(2)} m²`,
        perimetre: '—',
        latitude: tp.lat,
        longitude: tp.lng,
        zone_amenagement: '—',
      },
      criteres: [],
      criteres_satisfaits: 0,
      criteres_total: 0,
      criteres_conformite: [],
      classement: tp.rang,
      points_forts: [],
      points_faibles: [],
      geom: (tp as any).geom ?? (tp as any).geometry ?? null,
    }))
    selectTerrain(result.id)
    setCadastreEnabled(true)
  }, [wizardResultats])

  // Rend les terrains du wizard disponibles pour la mise en évidence et le cadrage
  // géométrique (clic dans la liste) sans recharge ni requête supplémentaire.
  useEffect(() => {
    if (!wizardResultats) return
    analyseResultatsRef.current = wizardResultats.resultats.map((tp) => ({
      id: tp.id,
      nom: tp.nom,
      superficie: tp.superficie,
      lat: tp.lat,
      lng: tp.lng,
      score_global: tp.score_final,
      score_final: tp.score_final,
      score_amc: 0,
      score_accessibilite: null,
      score_positionnement: null,
      score_topographie: null,
      score_superficie: null,
      roi: null,
      marge: null,
      benefice_net: null,
      score_rentabilite: null,
      type_rentabilite: 'indisponible' as const,
      prix_terrain: null,
      infos_generales: {
        reference_cadastrale: tp.reference_cadastrale || tp.nom,
        commune: '—',
        province: '—',
        region: '—',
        superficie: `${tp.superficie.toFixed(2)} m²`,
        perimetre: '—',
        latitude: tp.lat,
        longitude: tp.lng,
        zone_amenagement: '—',
      },
      criteres: [],
      criteres_satisfaits: 0,
      criteres_total: 0,
      criteres_conformite: [],
      classement: tp.rang,
      points_forts: [],
      points_faibles: [],
      geom: (tp as any).geom ?? (tp as any).geometry ?? null,
    }))
  }, [wizardResultats])

  const handleWizardOpenRentabilite = useCallback((terrain: TerrainPondere): void => {
    setRentaTerrainId(terrain.id)
    setRentaTerrainNom(terrain.nom)
    setRentaParcelInfo({
      nom: terrain.nom,
      superficie: terrain.superficie,
      lat: terrain.lat,
      lng: terrain.lng,
      ref: terrain.reference_cadastrale || terrain.nom,
    })
    setRentaResult(null)
    setRentaError(null)
    setRentaNote(null)
    setRentaModalOpen(true)
  }, [])

  const toPct100 = (v: number | null | undefined): number => {
    if (v == null || !Number.isFinite(v)) return 0
    return v <= 1 ? Math.round(v * 100) : Math.round(v)
  }

  const buildPondereVM = (tp: TerrainPondere) => ({
    reference: tp.reference_cadastrale || tp.nom,
    superficie: tp.superficie,
    lat: tp.lat,
    lng: tp.lng,
    rang: tp.rang,
    scorePct: toPct100(tp.score_final),
    criteres: (tp.contributions ?? []).map((c) => ({ label: CRITERE_LABELS[c.critere] || c.critere, pct: toPct100(c.score) })),
  })

  const buildResultatVM = (tr: AnalyseResultat) => ({
    reference: tr.infos_generales?.reference_cadastrale || tr.nom,
    superficie: tr.superficie,
    lat: tr.lat,
    lng: tr.lng,
    rang: tr.classement,
    scorePct: toPct100(tr.score_final),
    criteres: (tr.criteres_conformite ?? []).map((c) => ({ label: c.label, pct: Math.round(c.pct) })),
  })

  const renderAnalyseDeTerrainCard = (
    data: { reference: string; superficie: number; lat: number; lng: number; rang: number; scorePct: number; criteres: { label: string; pct: number }[] },
    onRentabilite: () => void,
  ): React.JSX.Element => {
    const scoreCol = data.scorePct >= 70 ? '#16a34a' : data.scorePct >= 40 ? '#d97706' : '#dc2626'
    return (
      <div className="geo-analyse-popup">
        <div className="geo-analyse-stats">
          <span className="geo-analyse-stat">
            <span className="geo-analyse-stat-label">Rang</span>
            <span className="geo-analyse-stat-value">#{data.rang}</span>
          </span>
          <span className="geo-analyse-stat-sep" />
          <span className="geo-analyse-stat">
            <span className="geo-analyse-stat-label">Score</span>
            <span className="geo-analyse-stat-value" style={{ color: scoreCol }}>{data.scorePct}%</span>
          </span>
        </div>

        <div className="geo-analyse-section">
          <h4 className="geo-analyse-section-title">{t('ranking.terrain_infos')}</h4>
          <div className="geo-analyse-rows">
            <div className="geo-analyse-row">
              <span className="geo-analyse-row-icon">{icons.document}</span>
              <span className="geo-analyse-row-label">{t('ranking.terrain_reference')}</span>
              <span className="geo-analyse-row-value">{data.reference || '—'}</span>
            </div>
            <div className="geo-analyse-row">
              <span className="geo-analyse-row-icon">{icons.layers}</span>
              <span className="geo-analyse-row-label">{t('ranking.terrain_surface')}</span>
              <span className="geo-analyse-row-value">{Number(data.superficie).toLocaleString('fr-FR')} m²</span>
            </div>
            <div className="geo-analyse-row">
              <span className="geo-analyse-row-icon">{icons.mapPin}</span>
              <span className="geo-analyse-row-label">{t('ranking.terrain_centre')}</span>
              <span className="geo-analyse-row-value">{data.lat.toFixed(6)}, {data.lng.toFixed(6)}</span>
            </div>
          </div>
        </div>

        {data.criteres.length > 0 && (
          <div className="geo-analyse-section">
            <h4 className="geo-analyse-section-title">Détail par critère</h4>
            <div className="geo-analyse-criteria">
              {[...data.criteres].sort((a, b) => b.pct - a.pct).map((c, i) => (
                <div key={i} className="geo-analyse-criterion">
                  <div className="geo-analyse-criterion-header">
                    <span className="geo-analyse-criterion-name">{c.label}</span>
                    <span className="geo-analyse-criterion-pct">{c.pct}%</span>
                  </div>
                  <div className="geo-analyse-progress-track">
                    <div className="geo-analyse-progress-fill" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="geo-analyse-actions">
          <button type="button" className="btn btn-primary" onClick={onRentabilite}>
            Calculer la rentabilité
          </button>
        </div>
      </div>
    )
  }

  const openRentabiliteFromResultat = (tr: AnalyseResultat): void => {
    setRentaTerrainId(tr.id)
    setRentaTerrainNom(tr.nom)
    setRentaRing([])
    setRentaParcelInfo({
      nom: tr.nom,
      superficie: tr.superficie,
      lat: tr.lat,
      lng: tr.lng,
      ref: tr.infos_generales?.reference_cadastrale || tr.nom,
    })
    setRentaResult(null)
    setRentaError(null)
    setRentaNote(null)
    setRentaSurfaceConstructible(null)
    setRentaSurfaceEquipement(null)
    setRentaAffectationsOpen(false)
    setRentaSurfaceLoading(true)
    setRentaModalOpen(true)
  }

  const [rentaTerrainId, setRentaTerrainId] = useState<number | null>(null)
  const [rentaTerrainNom, setRentaTerrainNom] = useState('')
  const [rentaParcelInfo, setRentaParcelInfo] = useState<{ nom: string; superficie: number; lat: number; lng: number; ref?: string } | null>(null)
  const [rentaForm, setRentaForm] = useState({
    prixFoncierM2: '', fraisAcquisition: '7', tauxChute: '30',
    cos: '', cus: '',
    hasAppartement: true, hasCommerce: false, hasBureau: false, hasEquipement: false,
    quotePartApp: '100', quotePartCommerce: '0', quotePartBureau: '0',
    prixVenteApp: '', prixVenteCommerce: '', prixVenteBureau: '',
    prixVenteEquipement: '',
    coutConstrApp: '', coutConstrCommerce: '', coutConstrBureau: '',
    tauxEtudes: '10', tauxImprevus: '5', tauxCommercialisation: '3',
    dureeConstruction: '2', dureeCommercialisation: '3', tauxActualisation: '8',
  })
  const [rentaResult, setRentaResult] = useState<Rentabilite | null>(null)
  const [rentaCalculating, setRentaCalculating] = useState(false)
  const [rentaSaving, setRentaSaving] = useState(false)
  const [rentaError, setRentaError] = useState<string | null>(null)
  const [rentaNote, setRentaNote] = useState<string | null>(null)
  const [rentaModalOpen, setRentaModalOpen] = useState(false)
  const [rentaTerrains, setRentaTerrains] = useState<Terrain[]>([])
  const [rentaSurfaceConstructible, setRentaSurfaceConstructible] = useState<SurfaceConstructibleResponse | null>(null)
  const [rentaSurfaceEquipement, setRentaSurfaceEquipement] = useState<SurfaceEquipementResponse | null>(null)
  const [rentaRing, setRentaRing] = useState<number[][]>([])
  const [rentaAffectationsOpen, setRentaAffectationsOpen] = useState(false)
  const [rentaSurfaceLoading, setRentaSurfaceLoading] = useState(false)

  useEffect(() => {
    if (!rentaSurfaceConstructible) return
    const cosVal = rentaSurfaceConstructible.cos
    const cusVal = rentaSurfaceConstructible.cus
    if (cosVal != null && rentaForm.cos === '') {
      setRentaForm((f) => ({ ...f, cos: String(cosVal) }))
    }
    if (cusVal != null && rentaForm.cus === '') {
      setRentaForm((f) => ({ ...f, cus: String(cusVal) }))
    }
  }, [rentaSurfaceConstructible])

  useEffect(() => {
    if (!rentaModalOpen || !projetId) return
    let cancelled = false
    void fetchTerrains(projetId, { page_size: 100 })
      .then((data) => { if (!cancelled) setRentaTerrains(data.results) })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [rentaModalOpen, projetId])

  useEffect(() => {
    if (!projetId) { setRentaSurfaceConstructible(null); setRentaSurfaceLoading(false); return }
    setRentaSurfaceConstructible(null)
    setRentaAffectationsOpen(false)
    setRentaSurfaceLoading(true)
    if (rentaTerrainId) {
      let cancelled = false
      void fetchSurfaceConstructible(projetId, rentaTerrainId)
        .then((data) => { if (!cancelled) { setRentaSurfaceConstructible(data); setRentaSurfaceLoading(false) } })
        .catch(() => { if (!cancelled) { setRentaSurfaceConstructible(null); setRentaSurfaceLoading(false) } })
      return () => { cancelled = true }
    }
    if (rentaRing.length >= 3) {
      const closedRing = closeRing(rentaRing)
      const geom = { type: 'Polygon', coordinates: [closedRing] }
      const surf = rentaParcelInfo?.superficie && rentaParcelInfo.superficie > 0
        ? rentaParcelInfo.superficie
        : Math.round(ringAreaM2(rentaRing))
      let cancelled = false
      void computeSurfaceConstructible(projetId, geom, surf)
        .then((data) => { if (!cancelled) { setRentaSurfaceConstructible(data); setRentaSurfaceLoading(false) } })
        .catch(() => { if (!cancelled) { setRentaSurfaceConstructible(null); setRentaSurfaceLoading(false) } })
      return () => { cancelled = true }
    }
    setRentaSurfaceConstructible(null)
    setRentaSurfaceLoading(false)
  }, [rentaTerrainId, projetId, rentaRing, rentaParcelInfo])

  useEffect(() => {
    if (!projetId) { setRentaSurfaceEquipement(null); return }
    if (rentaTerrainId) {
      let cancelled = false
      void fetchSurfaceEquipement(projetId, rentaTerrainId)
        .then((data) => { if (!cancelled) setRentaSurfaceEquipement(data) })
        .catch(() => { if (!cancelled) setRentaSurfaceEquipement(null) })
      return () => { cancelled = true }
    }
    if (rentaRing.length >= 3) {
      const closedRing = closeRing(rentaRing)
      const geom = { type: 'Polygon', coordinates: [closedRing] }
      const surf = rentaParcelInfo?.superficie && rentaParcelInfo.superficie > 0
        ? rentaParcelInfo.superficie
        : Math.round(ringAreaM2(rentaRing))
      let cancelled = false
      void computeSurfaceEquipement(projetId, geom, surf)
        .then((data) => { if (!cancelled) setRentaSurfaceEquipement(data) })
        .catch(() => { if (!cancelled) setRentaSurfaceEquipement(null) })
      return () => { cancelled = true }
    }
    setRentaSurfaceEquipement(null)
  }, [rentaTerrainId, projetId, rentaRing, rentaParcelInfo])

  // Uncheck hasEquipement automatically if the terrain has no equipment intersection
  useEffect(() => {
    if (!rentaSurfaceEquipement || rentaSurfaceEquipement.surface_equipement === 0) {
      setRentaForm((f) => ({ ...f, hasEquipement: false }))
    }
  }, [rentaSurfaceEquipement])

  const openPopupRef = useRef<any>(null)
  const popupActionHandlerRef = useRef<(e: MouseEvent) => void>(() => {})
  popupActionHandlerRef.current = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    const btn = target.closest('[data-action]') as HTMLElement | null
    if (!btn) return
    const action = btn.getAttribute('data-action')

    if (action === 'gmaps') {
      const lat = Number(btn.getAttribute('data-lat'))
      const lng = Number(btn.getAttribute('data-lng'))
      if (Number.isFinite(lat) && Number.isFinite(lng)) openGoogleMaps(lat, lng)
    } else if (action === 'dims') {
      const raw = btn.getAttribute('data-geom')
      if (!raw) return
      try {
        const ring = JSON.parse(raw) as number[][]
        showTerrainDims(ring, btn.getAttribute('data-title') ?? '')
      } catch {
        /* coordonnées invalides */
      }
    } else if (action === 'parcelles') {
      const idParcelle = btn.getAttribute('data-parcelle')
      if (idParcelle) showParcelAffectations(idParcelle, openPopupRef.current)
    } else if (action === 'affectations-detail') {
      openAffectationsDetail()
    } else if (action === 'rentabilite') {
      const tid = btn.getAttribute('data-terrain-id')
      const tnom = btn.getAttribute('data-terrain-nom') ?? ''
      const tsurf = btn.getAttribute('data-terrain-surf')
      const tlat = btn.getAttribute('data-terrain-lat')
      const tlng = btn.getAttribute('data-terrain-lng')
      const tref = btn.getAttribute('data-terrain-ref') ?? ''
      const tRing = btn.getAttribute('data-terrain-ring')
      let parsedRing: number[][] = []
      try { parsedRing = tRing ? JSON.parse(tRing) as number[][] : [] } catch { parsedRing = [] }
      const calculatedSurf = parsedRing.length >= 3 ? Math.round(ringAreaM2(parsedRing)) : 0
      const parsedSurf = tsurf && Number(tsurf) > 0 ? Number(tsurf) : (calculatedSurf > 0 ? calculatedSurf : Number(projet?.surface_souhaitee ?? 0))
      setRentaTerrainId(tid ? Number(tid) : null)
      setRentaTerrainNom(tnom)
      setRentaRing(parsedRing)
      setRentaParcelInfo({
        nom: tnom,
        superficie: parsedSurf,
        lat: tlat ? Number(tlat) : 0,
        lng: tlng ? Number(tlng) : 0,
        ref: tref,
      })
      setRentaResult(null)
      setRentaError(null)
      setRentaSurfaceConstructible(null)
      setRentaSurfaceEquipement(null)
      setRentaAffectationsOpen(false)
      setRentaSurfaceLoading(true)
      setRentaNote(null)
      setRentaModalOpen(true)
    }
  }

  const parseDistance = (v: string | undefined): number | null => {
    if (!v || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const filtresDistances = (f: AnalyseFiltres): { key: string; radius: number }[] => {
    const fields: { key: string; value: string | undefined }[] = [
      { key: 'distance_route', value: f.distance_route },
      { key: 'distance_health', value: f.distance_health },
      { key: 'distance_education', value: f.distance_education },
      { key: 'distance_commerce', value: f.distance_commerce },
      { key: 'distance_transport', value: f.distance_transport },
      { key: 'distance_admin', value: f.distance_admin },
      { key: 'distance_poles', value: f.distance_poles },
    ]
    const result: { key: string; radius: number }[] = []
    fields.forEach(({ key, value }) => {
      const radius = parseDistance(value)
      if (radius != null) result.push({ key, radius })
    })
    return result
  }

  const clearTerrainBuffer = (): void => {
    const map = mapRef.current
    if (bufferLayerRef.current) {
      map?.removeLayer(bufferLayerRef.current)
      bufferLayerRef.current = null
    }
  }

  const clearAffectations = (): void => {
    const map = mapRef.current
    if (affectationsLayerRef.current) {
      map?.removeLayer(affectationsLayerRef.current)
      affectationsLayerRef.current = null
    }
    affectationsResultRef.current = null
  }

  // ---- Dessin du polygone du terrain (localisation depuis le formulaire) ----
  const drawDraftKey = (pid: number): string => `terrain_draft_${pid}`

  const clearDrawLayer = (): void => {
    const map = mapRef.current
    if (drawLayerRef.current) {
      map?.removeLayer(drawLayerRef.current)
      drawLayerRef.current = null
    }
  }

  const renderDrawShape = (): void => {
    const map = mapRef.current
    if (!map) return
    clearDrawLayer()
    const pts = drawPointsRef.current
    if (pts.length === 0) return
    const layer = L.featureGroup()
    if (pts.length === 1) {
      L.circleMarker(pts[0], { radius: 5, color: '#e11d48', fillColor: '#e11d48', fillOpacity: 0.9 }).addTo(layer)
    } else if (pts.length === 2) {
      L.polyline(pts, { color: '#e11d48', weight: 2, dashArray: '4 4' }).addTo(layer)
    } else {
      L.polygon(pts, { color: '#e11d48', weight: 2, fillColor: '#e11d48', fillOpacity: 0.15 }).addTo(layer)
      L.polyline([...pts, pts[0]], { color: '#e11d48', weight: 2, dashArray: '4 4' }).addTo(layer)
    }
    pts.forEach((p) => L.circleMarker(p, { radius: 4, color: '#fff', weight: 2, fillColor: '#e11d48', fillOpacity: 1 }).addTo(layer))
    layer.addTo(map)
    drawLayerRef.current = layer
  }

  const addDrawPoint = (latlng: { lat: number; lng: number }): void => {
    drawPointsRef.current = [...drawPointsRef.current, [latlng.lat, latlng.lng]]
    setDrawPointCount(drawPointsRef.current.length)
    renderDrawShape()
  }

  const finishDraw = (): void => {
    const pts = drawPointsRef.current
    setDrawError(null)
    if (pts.length < 3) {
      setDrawError(t('ranking.draw_min_points'))
      return
    }
    const ring: number[][] = pts.map((p) => [p[1], p[0]])
    const area = polygonAreaM2(ring)
    const center = ringCenter(ring)
    const geometry = JSON.stringify({ type: 'Polygon', coordinates: [[...ring, ring[0]]] })
    setDrawFinished({ area, center, geometry })
    setDrawMode(false)
  }

  const confirmDraw = (): void => {
    if (!drawFinished || !projetId) return
    localStorage.setItem(drawDraftKey(projetId), JSON.stringify(drawFinished))
    window.close()
  }

  const resetDraw = (): void => {
    clearDrawLayer()
    drawPointsRef.current = []
    setDrawFinished(null)
    setDrawError(null)
    setDrawMode(true)
  }

  const cancelDraw = (): void => {
    clearDrawLayer()
    drawPointsRef.current = []
    setDrawFinished(null)
    setDrawError(null)
    setDrawMode(false)
  }

  useEffect(() => {
    drawModeRef.current = drawMode
  }, [drawMode])

  const clearFormDraw = (): void => {
    setTerrainForm((f) => ({ ...f, geom: emptyGeom() }))
    setTerrainNote(null)
  }

  const handleAddTerrain = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!projetId) return
    const numTitre = terrainForm.num_titre_foncier.trim()
    const prixDemande = terrainForm.prix_demande.trim() !== '' ? Number(terrainForm.prix_demande) : null
    const superficie = terrainForm.geom.areaM2 != null ? Math.round(terrainForm.geom.areaM2) : null

    if (!numTitre) {
      setTerrainError(t('ranking.validation_required'))
      return
    }
    if (prixDemande == null || !Number.isFinite(prixDemande) || prixDemande <= 0) {
      setTerrainError(t('ranking.field_prix_required'))
      return
    }
    if (!terrainForm.geom.geometry || superficie == null || superficie <= 0) {
      setTerrainError(t('ranking.geo_required_polygon'))
      return
    }
    const cos = terrainForm.cos.trim() !== '' ? Number(terrainForm.cos) : null
    const cus = terrainForm.cus.trim() !== '' ? Number(terrainForm.cus) : null
    const hauteur = terrainForm.hauteur_maximale.trim() !== '' ? Number(terrainForm.hauteur_maximale) : null

    setSavingTerrain(true)
    setTerrainError(null)
    try {
      await createTerrain(projetId, {
        num_titre_foncier: numTitre,
        statut_juridique: terrainForm.statut_juridique || 'titre',
        prix_demande: prixDemande,
        zonage: terrainForm.zonage || 'residentiel',
        cos,
        cus,
        hauteur_maximale: hauteur,
        equipements: terrainForm.equipements,
        superficie,
        lat: terrainForm.geom.centroid?.lat ?? null,
        lng: terrainForm.geom.centroid?.lng ?? null,
        geometry: JSON.stringify(terrainForm.geom.geometry),
      })
      localStorage.setItem(`terrain_created_${projetId}`, String(Date.now()))
      setTerrainForm({ num_titre_foncier: '', statut_juridique: '', prix_demande: '', zonage: '', cos: '', cus: '', hauteur_maximale: '', equipements: [], geom: emptyGeom() })
      setTerrainNote(t('ranking.terrain_added'))
      setTerrainError(null)
      setTimeout(() => { setCardMode('search'); setCardHidden(true); setTerrainNote(null) }, 1500)
    } catch (err) {
      setTerrainError(formatApiErrors(err))
    } finally {
      setSavingTerrain(false)
    }
  }

  const numRenta = (v: string): number | undefined => v ? Number(v) : undefined

  const handleCalculateRentabilite = async (): Promise<void> => {
    if (!projet) return
    const payload: ProjetPayload = {
      nom: rentaTerrainNom,
      description: '',
      id_type: 1,
      surface_souhaitee: Number(projet.surface_souhaitee),
      budget_total: 0,
      prix_foncier_m2: numRenta(rentaForm.prixFoncierM2),
      frais_acquisition: numRenta(rentaForm.fraisAcquisition),
      taux_chute: numRenta(rentaForm.tauxChute),
      cos: numRenta(rentaForm.cos),
      cus: numRenta(rentaForm.cus),
      has_appartement: rentaForm.hasAppartement,
      has_commerce: rentaForm.hasCommerce,
      has_bureau: rentaForm.hasBureau,
      has_equipement: rentaForm.hasEquipement,
      quote_part_appartement: numRenta(rentaForm.quotePartApp),
      quote_part_commerce: numRenta(rentaForm.quotePartCommerce),
      quote_part_bureau: numRenta(rentaForm.quotePartBureau),
      quote_part_equipement: rentaForm.hasEquipement ? (() => {
        const surfBrute = Number(projet.surface_souhaitee ?? 0)
        const cosVal = numRenta(rentaForm.cos) ?? 0
        const surfaceVendable = surfBrute * cosVal * 0.9
        const surfEq = rentaSurfaceEquipement?.surface_equipement ?? 0
        return surfaceVendable > 0 && surfEq > 0 ? Math.round(surfEq / surfaceVendable * 10000) / 100 : 0
      })() : 0,
      prix_vente_appartement: numRenta(rentaForm.prixVenteApp),
      prix_vente_commerce: numRenta(rentaForm.prixVenteCommerce),
      prix_vente_bureau: numRenta(rentaForm.prixVenteBureau),
      prix_vente_equipement: numRenta(rentaForm.prixVenteEquipement),
      surface_equipement: rentaForm.hasEquipement ? (rentaSurfaceEquipement?.surface_equipement ?? 0) : 0,
      cout_construction_appartement: numRenta(rentaForm.coutConstrApp),
      cout_construction_commerce: numRenta(rentaForm.coutConstrCommerce),
      cout_construction_bureau: numRenta(rentaForm.coutConstrBureau),
      taux_etudes_honoraires: numRenta(rentaForm.tauxEtudes),
      taux_imprevus: numRenta(rentaForm.tauxImprevus),
      taux_commercialisation: numRenta(rentaForm.tauxCommercialisation),
      duree_construction: numRenta(rentaForm.dureeConstruction),
      duree_commercialisation: numRenta(rentaForm.dureeCommercialisation),
      taux_actualisation: numRenta(rentaForm.tauxActualisation),
    }
    setRentaError(null)
    setRentaResult(null)
    setRentaCalculating(true)
    try {
      const res = await previewRentabilite(payload)
      setRentaResult(res)
      if (!res.ok) setRentaError(res.error || 'Erreur de calcul')
    } catch (err) {
      setRentaError(formatApiErrors(err))
    } finally {
      setRentaCalculating(false)
    }
  }

  const handleSaveRentabiliteTerrain = async (): Promise<void> => {
    if (!rentaResult?.ok || !rentaParcelInfo) return
    setRentaSaving(true)
    setRentaNote(null)
    setRentaError(null)
    try {
      let terrainId = rentaTerrainId
      if (!terrainId) {
        const round6 = (v: number): number | null => {
          if (!Number.isFinite(v)) return null
          return Math.round(v * 1e6) / 1e6
        }
        const titre = rentaParcelInfo.ref || rentaParcelInfo.nom || `Terrain ${Date.now()}`
        const terrain = await createTerrain(projetId, {
          num_titre_foncier: titre.slice(0, 255),
          statut_juridique: 'titre',
          prix_demande: null,
          zonage: 'residentiel',
          cos: numRenta(rentaForm.cos) ?? null,
          cus: numRenta(rentaForm.cus) ?? null,
          hauteur_maximale: null,
          equipements: [],
          superficie: Number.isFinite(rentaParcelInfo.superficie) ? Math.round(rentaParcelInfo.superficie) : 0,
          lat: round6(rentaParcelInfo.lat),
          lng: round6(rentaParcelInfo.lng),
          geometry: '',
        })
        terrainId = terrain.id
      }
      await saveTerrainRentabilite(projetId, terrainId, rentaResult as unknown as Record<string, unknown>)
      setRentaNote('Terrain enregistré avec succès !')
      localStorage.setItem(`terrain_created_${projetId}`, String(Date.now()))
      void fetchTerrains(projetId, { page_size: 100 })
        .then((data) => setRentaTerrains(data.results))
        .catch(() => { /* ignore */ })
      setTimeout(() => setRentaModalOpen(false), 1200)
    } catch (err) {
      setRentaError(formatApiErrors(err))
    } finally {
      setRentaSaving(false)
    }
  }

  // Calcule le découpage de la parcelle et l'affiche sur la carte, puis bascule
  // le bouton du popup de « Voir les parcelles » vers « Détail ».
  // Les pièces restent interactives (curseur + infobulle au survol), mais leur
  // clic relance le handler « click » de la couche cadastre correspondante :
  // cliquer sur une parcelle colorée se comporte exactement comme cliquer sur
  // le terrain (popup du terrain, bouton « Voir Détail » conservé puisque le
  // résultat est déjà calculé).

  const firstSentence = (text: string, maxLen = 100): string => {
    if (!text) return ''
    const m = text.match(/^(.+?[.!?])\s/)
    const raw = m ? m[1] : text
    return raw.length > maxLen ? raw.slice(0, maxLen).replace(/\s+\S*$/, '') + '…' : raw
  }

  const showParcelAffectations = (idParcelle: string, popup: any): void => {
    const map = mapRef.current
    const cadastreId = couchesDispo.find((c) => c.nom === 'cadastre')?.id
    const paId = couchesDispo.find((c) => c.nom === 'plan_amenagement')?.id
    const cadFeat = cadastreId != null
      ? coucheDataRef.current[cadastreId]?.features.find((f) => String(f.properties?.num) === idParcelle)
      : undefined
    const paPrepared = paPreparedRef.current

    if (!map || !cadFeat || paId == null || !paPrepared) {
      return
    }

    const ring = extractRing(cadFeat.geometry)
    const title = `Parcelle ${idParcelle}`
    const pieces = computeParcelAffectations(cadFeat, paPrepared)

    if (affectationsLayerRef.current) {
      map.removeLayer(affectationsLayerRef.current)
      affectationsLayerRef.current = null
    }
    if (pieces.length > 0) {
      const group = L.featureGroup()
      const openCadastreClick = (ev: any): void => {
        // Le clic sur une pièce colorée se comporte comme un clic sur le terrain :
        // on re-déclenche le handler « click » de la couche cadastre correspondante.
        const cadLayer = cadastreLayerRef.current as any
        if (!cadLayer) return
        let targetLayer: any = null
        cadLayer.eachLayer((l: any) => {
          if (targetLayer) return
          if (l?.feature?.properties?.num != null && String(l.feature.properties.num) === String(idParcelle)) {
            targetLayer = l
          }
        })
        if (targetLayer) {
          targetLayer.fire('click', {
            latlng: ev?.latlng,
            layerPoint: ev?.layerPoint,
            containerPoint: ev?.containerPoint,
            originalEvent: ev?.originalEvent,
          })
        }
      }

      pieces.forEach((pc) => {
        const pcCode = pc.designation || 'Affectation non définie'
        const pcDef = String(pc.properties.definition ?? pc.properties.type_construction ?? '').trim()
        const pcDesc = firstSentence(pcDef)
        const tooltipHtml =
          `<div class="geo-aff-tooltip-title">${escapeHtml(pcCode)}</div>` +
          (pcDesc ? `<div class="geo-aff-tooltip-meta">${escapeHtml(pcDesc)}</div>` : '')

        L.geoJSON(pc.feature, {
          interactive: true,
          bubblingMouseEvents: false,
          style: { color: '#0f3d6e', weight: 1.5, opacity: 0.95, fillColor: pc.color, fillOpacity: 0.75 },
          onEachFeature: (_feature: any, layerItem: any) => {
            layerItem.bindTooltip(
              tooltipHtml,
              { sticky: true, className: 'geo-aff-tooltip', direction: 'top', offset: [0, -4] }
            )
            layerItem.on('click', openCadastreClick)
          },
        }).addTo(group)
      })
      if (ring && ring.length >= 3) {
        L.polygon(ring.map((pt) => [pt[1], pt[0]] as [number, number]), {
          color: '#1b3a6e',
          weight: 3,
          opacity: 1,
          fill: false,
          interactive: false,
        }).addTo(group)
      }
      group.addTo(map)
      affectationsLayerRef.current = group
      overlayFlyToBounds(map, group.getBounds().pad(0.15), { duration: 0.7, maxZoom: 19 })
    }

    affectationsResultRef.current = { terrainNum: idParcelle, pieces, title }
    if (popup?.getElement && ring) {
      const center = ringCenter(ring)
      const surfVal = Number(cadFeat.properties?.surface) || (ring && ring.length >= 3 ? Math.round(ringAreaM2(ring)) : 0)
      const info = pieces.length === 0
        ? '<div class="geoportal-popup-warn">Aucune affectation trouvée pour cette parcelle dans le plan d\'aménagement.</div>'
        : `<div class="geoportal-popup-affcount">${pieces.length} affectation${pieces.length > 1 ? 's' : ''} détectée${pieces.length > 1 ? 's' : ''}</div>`
      popup.setContent(
        `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(title)}</div>` +
        `${info}` +
        `<div class="geoportal-popup-coords">${propsToHtml(cadFeat.properties, CADASTRE_ATTRIBUTE_LABELS, ['fid', 'num'])}</div>` +
        `${buildPopupActions(center.lat, center.lng, ring, title, { idParcelle, computed: pieces.length > 0 }, { nom: title, superficie: surfVal, lat: center.lat, lng: center.lng, ref: idParcelle, ring })}</div>`
      )
      bindPopupActionButtons(popup)
    }
  }

  const openAffectationsDetail = (): void => {
    const result = affectationsResultRef.current
    if (!result) return
    const cadastreId = couchesDispo.find((c) => c.nom === 'cadastre')?.id
    const cadFeat = cadastreId != null
      ? coucheDataRef.current[cadastreId]?.features.find((f) => String(f.properties?.num) === result.terrainNum)
      : undefined
    const ring = cadFeat ? extractRing(cadFeat.geometry) : null
    if (!ring || ring.length < 3) return
    showAffectationsModal(result.title, ring, result.pieces)
  }

// Remplace bindAffectationButtons par une fonction unique qui gère TOUTES les actions du popup
const bindPopupActionButtons = (popup: any): void => {
  const el = popup?.getElement?.() as HTMLElement | null
  if (!el) return
  const stop = (e: Event): void => e.stopPropagation()

  el.querySelectorAll<HTMLElement>('[data-action="gmaps"]').forEach((b) => {
    b.addEventListener('click', (e) => {
      stop(e)
      const lat = Number(b.getAttribute('data-lat'))
      const lng = Number(b.getAttribute('data-lng'))
      if (Number.isFinite(lat) && Number.isFinite(lng)) openGoogleMaps(lat, lng)
    })
  })

  el.querySelectorAll<HTMLElement>('[data-action="dims"]').forEach((b) => {
    b.addEventListener('click', (e) => {
      stop(e)
      const raw = b.getAttribute('data-geom')
      if (!raw) return
      try {
        const ring = JSON.parse(raw) as number[][]
        showTerrainDims(ring, b.getAttribute('data-title') ?? '')
      } catch {
        /* coordonnées invalides */
      }
    })
  })

  el.querySelectorAll<HTMLElement>('[data-action="parcelles"]').forEach((b) => {
    b.addEventListener('click', (e) => {
      stop(e)
      const idParcelle = b.getAttribute('data-parcelle')
      if (!idParcelle) return
      showParcelAffectations(idParcelle, popup)
    })
  })

  el.querySelectorAll<HTMLElement>('[data-action="affectations-detail"]').forEach((b) => {
    b.addEventListener('click', (e) => {
      stop(e)
      openAffectationsDetail()
    })
  })
}

  const layersFromFiltres = (f: AnalyseFiltres): Record<string, boolean> => {
    const toggles: Record<string, boolean> = {}
    const routeCouche = couchesDispo.find((c) => c.nom === 'reseau_routier')
    const equipCouche = couchesDispo.find((c) => c.nom === 'equipements_publics')
    f.route_type?.forEach((val) => {
      ;(FILTRE_ROUTE_OSM[val] ?? []).forEach((osm) => {
        if (routeCouche) toggles[`${routeCouche.id}:${osm}`] = true
      })
    })
    if (equipCouche) {
      if (f.health && f.health.length > 0) toggles[`${equipCouche.id}:Santé`] = true
      if (f.education && f.education.length > 0) toggles[`${equipCouche.id}:Enseignement`] = true
      if (f.admin && f.admin.length > 0) toggles[`${equipCouche.id}:Administration`] = true
    }
    return toggles
  }

  const showTerrainBuffer = (tr: AnalyseResultat): void => {
    const map = mapRef.current
    if (!map) return
    clearTerrainBuffer()
    const filtres = analyseFiltresRef.current
    if (!filtres) return
    const distances = filtresDistances(filtres)
    if (distances.length === 0) return

    let center: [number, number] | null = null
    const ref = tr.infos_generales?.reference_cadastrale
    const cadastreLayer = cadastreLayerRef.current
    if (cadastreLayer && ref) {
      cadastreLayer.eachLayer((l: any) => {
        const idP = l.feature?.properties?.num
        if (idP != null && String(idP) === String(ref) && typeof l.getBounds === 'function') {
          const c = l.getBounds().getCenter()
          if (!center) center = [c.lat, c.lng]
        }
      })
    }
    if (!center) {
      if (tr.lat == null || tr.lng == null) return
      center = [tr.lat, tr.lng]
    }

    const group = L.layerGroup().addTo(map)
    bufferLayerRef.current = group
    distances.forEach(({ key, radius }) => {
      const color = BUFFER_COLORS[key] ?? '#1b3a6e'
      L.circle(center, {
        radius,
        color,
        weight: 2,
        opacity: 0.85,
        fillColor: color,
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(group)
    })
  }

  useEffect(() => {
    if (!id || !Number.isInteger(projetId) || projetId <= 0) {
      navigate('/projets', { replace: true })
    }
  }, [id, projetId, navigate])

  useEffect(() => {
    if (!projetId) return
    let cancelled = false
    fetchProjet(projetId)
      .then((p) => {
        if (cancelled) return
        setProjet(p)
      })
      .catch((err) => {
        if (cancelled) return
        setProjetError(formatApiErrors(err))
      })
    return () => {
      cancelled = true
    }
  }, [projetId])

  useEffect(() => {
    if (!projet) return
    const mapEl = mapContainerRef.current
    if (!mapEl) return
    const map = L.map(mapEl, { center: [33.88, -6.98], zoom: 12, zoomControl: false })
    map.fitBounds(TEMARA_BOUNDS)
    L.control.zoom({ position: 'bottomleft' }).addTo(map)
    mapRef.current = map

    const popupLayer = document.createElement('div')
    popupLayer.className = 'geo-popup-layer'
    mapEl.appendChild(popupLayer)
    popupLayer.appendChild(map.getPane('popupPane'))

    const syncPopupLayer = (): void => {
      const mapPane = (map as any)._mapPane as HTMLElement | undefined
      const pos = mapPane ? L.DomUtil.getPosition(mapPane) : undefined
      if (pos) L.DomUtil.setPosition(popupLayer, pos)
    }
    map.on('move', syncPopupLayer)
    map.on('zoom', syncPopupLayer)
    map.on('viewreset', syncPopupLayer)
    map.on('resize', syncPopupLayer)
    syncPopupLayer()

    map.on('click', (e: any) => {
      const target = e?.originalEvent?.target as HTMLElement | undefined
      // En mode dessin du terrain, chaque clic pose un sommet du polygone.
      if (drawModeRef.current) {
        addDrawPoint(e.latlng)
        return
      }
      // Un clic dans le popup (bouton « Voir les parcelles », etc.) ne doit pas
      // être traité comme un clic carte : sinon le popup du point sélectionné
      // s'ouvre et ferme celui de la parcelle.
      if (target?.closest?.('.geo-popup-layer')) return
      const onFeature = !!target && (
        target.classList?.contains('leaflet-interactive') ||
        target.classList?.contains('leaflet-marker-icon')
      )
      if (!onFeature && bufferLayerRef.current) {
        map.removeLayer(bufferLayerRef.current)
        bufferLayerRef.current = null
      }
      const { lat, lng } = e.latlng
      setCoord(`Lat: ${lat.toFixed(6)} , Lng: ${lng.toFixed(6)}`)
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.circleMarker([lat, lng], {
          radius: 8, color: '#1b3a6e', fillColor: '#1b3a6e', fillOpacity: 0.8, weight: 2,
        }).addTo(map)
      }
      if (onFeature) return
      map.flyTo([lat, lng], Math.min(map.getZoom() + 1, 19), { duration: 0.8 })
      map.once('moveend', () => centerMapOnPoint(map, [lat, lng]))
      markerRef.current.bindPopup(
        `<div class="geoportal-popup">
          <div class="geoportal-popup-title">${t('ranking.selected_point')}</div>
          <div class="geoportal-popup-coords">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</div>
          ${buildPopupActions(lat, lng)}
        </div>`,
        { autoPan: false }
      ).openPopup()
    })

    map.on('popupopen', (ev: any) => {
      openPopupRef.current = ev.popup
    })
    map.on('popupclose', () => {
      openPopupRef.current = null
    })

    const onPopupLayerClick = (e: MouseEvent) => {
      // Un clic dans le popup (bouton « Voir les parcelles », …) ne doit jamais
      // remonter à la carte : sinon le popup « point sélectionné » s'ouvre et
      // ferme celui du terrain. On stoppe la propagation ici, car après le
      // `setContent()` le bouton est détaché du DOM et `closest` ne marche plus.
      e.stopPropagation()
      popupActionHandlerRef.current(e)
    }
    popupLayer.addEventListener('click', onPopupLayerClick)

    const geoParams = new URLSearchParams(window.location.search)
    const geoMode = geoParams.get('mode')
    const geoLat = Number(geoParams.get('terrain_lat'))
    const geoLng = Number(geoParams.get('terrain_lng'))
    if (geoMode === 'dessin') {
      setDrawMode(true)
    } else if (geoMode === 'vue' && Number.isFinite(geoLat) && Number.isFinite(geoLng)) {
      L.marker([geoLat, geoLng])
        .addTo(map)
        .bindPopup(`Lat: ${geoLat.toFixed(6)}, Lng: ${geoLng.toFixed(6)}`)
        .openPopup()
      map.flyTo([geoLat, geoLng], Math.max(map.getZoom(), 15), { duration: 0.8 })
    }
    if (geoParams.get('add') === '1') {
      setCardMode('addTerrain')
      setCardHidden(false)
    }

    return () => {
      map.remove()
      mapRef.current = null
      typeLayersRef.current = {}
      bufferLayerRef.current = null
      affectationsLayerRef.current = null
      affectationsResultRef.current = null
      popupLayer.remove()
      popupLayer.removeEventListener('click', onPopupLayerClick)
    }
  }, [projet])

  useEffect(() => {
    if (!projet) return
    let cancelled = false
    fetchCouches()
      .then((list) => {
        if (cancelled) return
        setCadastreFc(null)
        const filtered = list.filter((c) => c.nom === 'cadastre' || c.nom === 'reseau_routier' || c.nom === 'equipements_publics' || c.nom === 'plan_amenagement')
        setCouchesDispo(filtered)
        const equipC = filtered.find((c) => c.nom === 'equipements_publics')
        if (equipC) {
          setEquipTypes(EQUIP_PA_GROUPS.map((g) => ({ key: `${equipC.id}:${g.key}`, coucheId: equipC.id, type: g.key, count: 0 })))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [projet])

  useEffect(() => {
    if (couchesDispo.length === 0) return
    let cancelled = false
    Promise.allSettled(couchesDispo.map((c) => fetchCoucheGeoJSON(c.id)))
      .then((results) => {
        if (cancelled) return
        const routes: CoucheType[] = []
        const equips: CoucheType[] = []
        couchesDispo.forEach((c, i) => {
          const result = results[i]
          if (result.status !== 'fulfilled') {
            console.warn(`[couches] ${c.nom}: chargement échoué`, result.reason)
            return
          }
          const collection = result.value
          coucheDataRef.current[c.id] = collection
          setCoucheCounts((prev) => ({ ...prev, [c.nom]: collection.features.length }))
          if (c.nom === 'cadastre') {
            setCadastreFc(collection)
            setCadastreReady(true)
          }
          if (c.nom === 'plan_amenagement') {
            paPreparedRef.current = preparePAZones(collection.features)
          }
          if (c.nom !== 'reseau_routier' && c.nom !== 'equipements_publics') return
          if (c.nom === 'reseau_routier') {
            const counts = new Map<string, number>()
            collection.features.forEach((f) => {
              const v = String(f.properties?.['highway'] ?? 'autre')
              counts.set(v, (counts.get(v) ?? 0) + 1)
            })
            const items = Array.from(counts.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => ({ key: `${c.id}:${type}`, coucheId: c.id, type, count }))
            routes.push(...items)
          } else {
            // Groupement PA Temara par préfixe de designation (S/E/A)
            const groupCounts = new Map<string, number>()
            collection.features.forEach((f) => {
              const designation = String(f.properties?.['designation'] ?? f.properties?.['definition'] ?? '')
              const group = equipGroupOfDesignation(designation)
              groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1)
            })
            // Toujours afficher les 3 groupes Santé, Enseignement, Administration
            const items = EQUIP_PA_GROUPS.map((g) => ({
              key: `${c.id}:${g.key}`,
              coucheId: c.id,
              type: g.key,
              count: groupCounts.get(g.key) ?? 0,
            }))
            equips.push(...items)
          }
        })
        if (cancelled) return
        setRouteTypes(routes)
        setEquipTypes(equips)
      })
    return () => {
      cancelled = true
    }
  }, [couchesDispo])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const basemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]
    if (currentLayerRef.current) map.removeLayer(currentLayerRef.current)
    currentLayerRef.current = L.tileLayer(basemap.url, { attribution: basemap.attribution, maxZoom: 19 }).addTo(map)
  }, [basemapId, projet])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    OVERLAY_LAYERS.forEach((ol) => {
      const checked = overlays[ol.id]
      const existing = overlayLayersRef.current[ol.id]
      if (checked && !existing) {
        overlayLayersRef.current[ol.id] = L.tileLayer(ol.url, { attribution: ol.attribution, opacity: ol.opacity, maxZoom: 19 }).addTo(map)
      } else if (!checked && existing) {
        map.removeLayer(existing)
        delete overlayLayersRef.current[ol.id]
      }
    })
  }, [overlays, projet])

  const buildTypeLayer = (map: any, id: number, type: string, fc: CoucheFeatureCollection): any => {
    const couche = couchesDispo.find((c) => c.id === id)
    if (couche?.nom === 'reseau_routier') {
      const style = ROUTE_STYLES[type] ?? { color: '#6b7280', weight: 2 }
      return L.geoJSON(validFeatures(fc), {
        style: { color: style.color, weight: style.weight, opacity: 0.9, dashArray: style.dashArray },
      }).addTo(map)
    }
    const label = type
    const symbol = equipGroupSymbol(type)
    return L.geoJSON(validFeatures(fc), {
      pointToLayer: (_feature: any, latlng: any) =>
        L.marker(latlng, {
          icon: L.divIcon({
            className: 'geo-couche-icon',
            html: `<span class="geo-couche-icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${symbol}</svg></span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -15],
          }),
        }),
      onEachFeature: (feature: any, layerItem: any) => {
        layerItem.on('click', (ev: any) => {
          const anchor = layerItem.getLatLng?.() ?? ev?.latlng
          if (anchor) centerMapOnPoint(map, anchor)
        })
        if (feature?.properties && Object.keys(feature.properties).length > 0) {
          const c = Array.isArray((feature.geometry as any)?.coordinates)
            ? (feature.geometry as any).coordinates
            : null
          const props = feature.properties as Record<string, unknown>
          const couche = couchesDispo.find((cc) => cc.id === id)
          const isEquipPA = couche?.nom === 'equipements_publics'
          let popupBody: string
          if (isEquipPA) {
            const def = escapeHtml(props['definition'] ?? props['designation'] ?? '')
            const typeConstr = escapeHtml(props['type_construction'] ?? '')
            const ville = escapeHtml(props['ville'] ?? '')
            const surface = props['Surface'] != null ? `<div><strong>Surface</strong> : ${escapeHtml(props['Surface'])} m²</div>` : ''
            popupBody = `${typeConstr ? `<div><strong>Catégorie</strong> : ${typeConstr}</div>` : ''}${def ? `<div><strong>Définition</strong> : ${def}</div>` : ''}${ville ? `<div><strong>Ville</strong> : ${ville}</div>` : ''}${surface}`
          } else {
            popupBody = propsToHtml(props)
          }
          layerItem.bindPopup(
            `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(label)}</div><div class="geoportal-popup-coords">${popupBody}</div>${buildPopupActions(c ? c[1] : NaN, c ? c[0] : NaN)}</div>`,
            { autoPan: false }
          )
        }
      },
    }).addTo(map)
  }

  const buildCadastreLayer = (map: any, fc: CoucheFeatureCollection): any =>
    L.geoJSON(validFeatures(fc), {
      style: CADASTRE_STYLE,
      onEachFeature: (feature: any, layerItem: any) => {
        layerItem.on('click', (ev: any) => {
          const anchor = layerItem.getCenter?.() ?? layerItem.getLatLng?.() ?? ev?.latlng
          const idP = feature?.properties?.num
          if (idP != null && affectationsResultRef.current && affectationsResultRef.current.terrainNum !== String(idP)) {
            clearAffectations()
          }
          const tr = idP != null
            ? analyseResultatsRef.current.find(
                (r) => String(r.infos_generales?.reference_cadastrale) === String(idP)
              )
            : undefined
          if (tr) {
            selectTerrain(tr.id)
            highlightCadastreParcelle(String(idP))
          } else if (idP != null) {
            focusCadastreParcelle(String(idP))
          } else if (anchor) {
            centerMapOnPoint(map, anchor)
          }
        })
        if (feature?.properties && Object.keys(feature.properties).length > 0) {
          const p = feature.properties
          const idParcelle = p.num ? `Parcelle ${p.num}` : 'Parcelle cadastrale'
          const ring = extractRing(feature.geometry)
          const center = ring ? ringCenter(ring) : { lat: NaN, lng: NaN }
          const num = p.num != null ? String(p.num) : ''
          const affOpts: PopupAffectationsOpts = { idParcelle: num, computed: num !== '' && affectationsResultRef.current?.terrainNum === num }
          const parcelSuperficie = Number(p.surface) || (ring && ring.length >= 3 ? Math.round(ringAreaM2(ring)) : 0)
          layerItem.bindPopup(
            `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(idParcelle)}</div><div class="geoportal-popup-coords">${propsToHtml(feature.properties, CADASTRE_ATTRIBUTE_LABELS, ['fid', 'num'])}</div>${buildPopupActions(center.lat, center.lng, ring, idParcelle, num ? affOpts : null, ring && ring.length >= 3 ? { nom: idParcelle, superficie: parcelSuperficie, lat: center.lat, lng: center.lng, ref: num, ring } : undefined)}</div>`,
            { autoPan: false }
          )
        }
      },
    }).addTo(map)

  const buildPALayer = (map: any, fc: CoucheFeatureCollection): any =>
    L.geoJSON(validFeatures(fc), {
      style: PLAN_AMENAGEMENT_STYLE,
      onEachFeature: (feature: any, layerItem: any) => {
        layerItem.on('click', (ev: any) => {
      const anchor = layerItem.getCenter?.() ?? layerItem.getLatLng?.() ?? ev?.latlng
      if (anchor) centerMapOnPoint(map, anchor)
        })
        if (feature?.properties && Object.keys(feature.properties).length > 0) {
                const p = feature.properties
      const designation = p.designation ? String(p.designation) : ''
      const title = designation ? `Zone ${designation}` : "Plan d'aménagement"
      const ring = extractRing(feature.geometry)
      const center = ring ? ringCenter(ring) : { lat: NaN, lng: NaN }
      layerItem.bindPopup(
        `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(title)}</div><div class="geoportal-popup-coords">${propsToHtml(feature.properties, PLAN_AMENAGEMENT_ATTRIBUTE_LABELS)}</div>${buildPopupActions(center.lat, center.lng)}</div>`,
        { autoPan: false }
      )
        }
      },
    }).addTo(map)

  const buildParcellePopup = (tr: AnalyseResultat, p: Record<string, unknown>, ring?: number[][] | null, terrainId?: number): string => {
    const center = ring ? ringCenter(ring) : { lat: NaN, lng: NaN }
    const title = p.num != null ? `Parcelle ${p.num}` : tr.nom
    const num = p.num != null ? String(p.num) : ''
    const affOpts: PopupAffectationsOpts | null = num !== ''
      ? { idParcelle: num, computed: affectationsResultRef.current?.terrainNum === num }
      : null
    return `<div class="geoportal-popup">
        <div class="geoportal-popup-title">${escapeHtml(tr.nom)}</div>
        <div class="geoportal-popup-classement">
          <span class="geoportal-popup-rank">${t('ranking.classement_sur')} <strong>#${tr.classement}${ordinalSuffix(tr.classement)}</strong></span>
        </div>
        <div class="geoportal-popup-scores">
          ${(tr.criteres_conformite ?? []).map(c => `<div class="geoportal-popup-row"><span>${escapeHtml(c.label)}</span><strong>${c.pct >= 50 ? '✓' : '✗'}</strong></div>`).join('')}
        </div>
        <div class="geoportal-popup-coords">${propsToHtml(p, CADASTRE_ATTRIBUTE_LABELS, ['fid', 'num'])}</div>
        ${buildPopupActions(center.lat, center.lng, ring, title, affOpts, { terrainId, nom: tr.nom, superficie: tr.superficie, lat: center.lat, lng: center.lng, ref: String(p.num ?? '') })}
      </div>`
  }

  const colorCadastreParcels = (selectedId?: number): void => {
    const layer = cadastreLayerRef.current
    if (!layer) return
    const byId = new Map<string, AnalyseResultat>()
    analyseResultatsRef.current.forEach((tr) => {
      const ref = tr.infos_generales?.reference_cadastrale
      if (ref) byId.set(String(ref), tr)
    })
    layer.eachLayer((l: any) => {
      const props = l.feature?.properties as Record<string, unknown> | undefined
      if (!props) return
      const idP = props.num
      if (idP == null) return
      const tr = byId.get(String(idP))
      if (!tr) return
      const isSel = selectedId != null && tr.id === selectedId
      const el = l.getElement?.() as SVGElement | null
      if (isSel) {
        l.setStyle({
          color: '#ea580c',
          weight: 6,
          opacity: 1,
          fillColor: '#f97316',
          fillOpacity: 0.35,
          dashArray: '10 6',
        })
        l.bringToFront?.()
        el?.classList.add('geo-cadastre-selected')
      } else {
        const color = getScoreColor(tr.score_global)
        l.setStyle({
          color,
          weight: 1.6,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.4,
        })
        el?.classList.remove('geo-cadastre-selected')
      }
      l.bindPopup(buildParcellePopup(tr, props, extractRing(l.feature?.geometry), undefined), { autoPan: false })
    })
  }

  const fitToParcelle = (tr: AnalyseResultat): void => {
    const layer = cadastreLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return
    const ref = tr.infos_generales?.reference_cadastrale
    let zoomed = false
    layer.eachLayer((l: any) => {
      const idP = l.feature?.properties?.num
      if (idP != null && String(idP) === String(ref)) {
        // Cadrage strict sur la géométrie réelle du terrain (marge + zoom max pour garder le contexte)
        overlayFlyToBounds(map, l.getBounds().pad(0.25), { duration: 0.8, easeLinearity: 0.25, maxZoom: 18 })
        zoomed = true
      }
    })
    // Repli : si la parcelle n'est pas dans le cadastre chargé, on zoome sur le point centre
    if (!zoomed && tr.lat != null && tr.lng != null) {
      map.flyTo([tr.lat, tr.lng], Math.min(17, Math.max(map.getZoom(), 15)), { duration: 0.8 })
    }
  }

  const findCadastreLayerByRef = (ref: string | null | undefined): any | null => {
    const layer = cadastreLayerRef.current
    if (!layer || ref == null) return null
    let found: any = null
    layer.eachLayer((l: any) => {
      const idP = l.feature?.properties?.num
      if (idP != null && String(idP) === String(ref)) found = l
    })
    return found
  }

  const clearSelectedMarker = (): void => {
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove()
      selectedMarkerRef.current = null
    }
  }

  const clearSelectedGeom = (): void => {
    if (selectedGeomLayerRef.current) {
      selectedGeomLayerRef.current.remove()
      selectedGeomLayerRef.current = null
    }
  }

  // Met en évidence le terrain sur SA géométrie réelle (contour du polygone).
  // Priorité : polygone propre du terrain > parcelle cadastre correspondante > signalement explicite.
  // Aucun cercle « générique » n'est affiché : si aucune géométrie n'existe, on prévient l'utilisateur.
  const focusTerrainOnMap = (tr: AnalyseResultat): void => {
    selectedTerrainIdRef.current = tr.id
    showTerrainBuffer(tr)
    clearSelectedMarker()
    clearSelectedGeom()
    const map = mapRef.current
    const geom = (tr as any).geom ?? (tr as any).geometry
    const isPoly = !!geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')
    if (isPoly) {
      clearSelectedGeom()
      selectedGeomLayerRef.current = L.geoJSON(geom, {
        style: {
          color: '#ea580c',
          weight: 6,
          opacity: 1,
          fillColor: '#f97316',
          fillOpacity: 0.35,
          dashArray: '10 6',
        },
      }).addTo(map)
      selectedGeomLayerRef.current.eachLayer((l: any) => {
        const el = l.getElement?.() as SVGElement | null
        el?.classList.add('geo-cadastre-selected')
      })
      selectedGeomLayerRef.current.bringToFront?.()
      colorCadastreParcels(undefined)
      setGeomMissing(false)
      if (map) {
        const b = selectedGeomLayerRef.current.getBounds()
        overlayFlyToBounds(map, b.pad(0.25), { duration: 0.8, easeLinearity: 0.25, maxZoom: 18 })
      }
      console.info(
        `[geoportal] Contour réel du terrain affiché : « ${tr.nom} » (réf. ${tr.infos_generales?.reference_cadastrale}).`,
      )
      return
    }
    // Repli : parcelle cadastre correspondante (si la référence matche)
    const layer = findCadastreLayerByRef(tr.infos_generales?.reference_cadastrale)
    if (layer) {
      colorCadastreParcels(tr.id)
      if (map) overlayFlyToBounds(map, layer.getBounds().pad(0.25), { duration: 0.8, easeLinearity: 0.25, maxZoom: 18 })
      setGeomMissing(false)
      return
    }
    // Aucune géométrie disponible : on signale explicitement (pas de cercle trompeur)
    colorCadastreParcels(undefined)
    clearSelectedGeom()
    setGeomMissing(true)
    console.warn(
      `[geoportal] Aucune géométrie de polygone disponible pour le terrain « ${tr.nom} » ` +
        `(réf. ${tr.infos_generales?.reference_cadastrale}). Impossible de mettre en évidence le contour réel.`,
    )
    if (map && tr.lat != null && tr.lng != null) {
      map.flyTo([tr.lat, tr.lng], Math.min(16, Math.max(map.getZoom(), 14)), { duration: 0.8 })
    }
  }

  const cadastreParcelPopup = (props: Record<string, unknown>, ring?: number[][] | null): string => {
    const idParcelle = props.num ? `Parcelle ${props.num}` : 'Parcelle cadastrale'
    const center = ring ? ringCenter(ring) : { lat: NaN, lng: NaN }
    const num = props.num != null ? String(props.num) : ''
    const affOpts: PopupAffectationsOpts | null = num !== ''
      ? { idParcelle: num, computed: affectationsResultRef.current?.terrainNum === num }
      : null
    const parcelSuperficie = Number(props.surface) || (ring && ring.length >= 3 ? Math.round(ringAreaM2(ring)) : 0)
    const rentaInfo = ring && ring.length >= 3 ? { nom: idParcelle, superficie: parcelSuperficie, lat: center.lat, lng: center.lng, ref: num, ring } : undefined
    return `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(idParcelle)}</div><div class="geoportal-popup-coords">${propsToHtml(props, CADASTRE_ATTRIBUTE_LABELS, ['fid', 'num'])}</div>${buildPopupActions(center.lat, center.lng, ring, idParcelle, affOpts, rentaInfo)}</div>`
  }

  const highlightCadastreParcelle = (idParcelle: string): void => {
    const layer = cadastreLayerRef.current
    if (!layer) return
    layer.eachLayer((l: any) => {
      const props = l.feature?.properties as Record<string, unknown> | undefined
      if (!props || props.num == null) return
      l.setStyle(CADASTRE_STYLE)
      l.bindPopup(cadastreParcelPopup(props, extractRing(l.feature?.geometry)), { autoPan: false })
    })
    colorCadastreParcels(selectedTerrainIdRef.current ?? undefined)
    layer.eachLayer((l: any) => {
      const props = l.feature?.properties as Record<string, unknown> | undefined
      if (!props || props.num == null) return
      if (String(props.num) === idParcelle) {
        l.setStyle(CADASTRE_SEARCH_STYLE)
        l.bringToFront()
      }
    })
  }

  const focusCadastreParcelle = (idParcelle: string): void => {
    const layer = cadastreLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return
    searchParcelleRef.current = idParcelle
    highlightCadastreParcelle(idParcelle)
    layer.eachLayer((l: any) => {
      const props = l.feature?.properties as Record<string, unknown> | undefined
      if (!props || props.num == null) return
      if (String(props.num) === idParcelle) {
        overlayFlyToBounds(map, l.getBounds().pad(0.2), { duration: 0.8, easeLinearity: 0.25, maxZoom: 19 })
        l.bindPopup(cadastreParcelPopup(props, extractRing(l.feature?.geometry)), { autoPan: false }).openPopup()
      }
    })
  }

  const focusSearchParcelle = (idParcelle: string): void => {
    const tr = analyseResultatsRef.current.find(
      (r) => String(r.infos_generales?.reference_cadastrale) === idParcelle
    )
    if (tr) {
      selectedTerrainIdRef.current = tr.id
      showTerrainBuffer(tr)
      setSelectedTerrain(tr)
      setCardMode('results')
    }
    setCadastreEnabled(true)
    if (cadastreLayerRef.current) {
      focusCadastreParcelle(idParcelle)
    } else {
      pendingSearchRef.current = idParcelle
    }
  }

  const handleCadastreSearch = (): void => {
    const raw = cadastreQuery.trim()
    if (!raw) {
      return
    }
    const cadastreId = couchesDispo.find((c) => c.nom === 'cadastre')?.id
    const fc = cadastreId != null ? coucheDataRef.current[cadastreId] : undefined
    if (cadastreId == null || !fc) {
      return
    }
    const needle = raw.toUpperCase()
    const exact = fc.features.filter(
      (f) => String(f.properties?.num ?? '').toUpperCase() === needle
    )
    const partial = fc.features.filter(
      (f) => String(f.properties?.num ?? '').toUpperCase().includes(needle)
    )
    const matches = exact.length > 0 ? exact : partial
    if (matches.length === 0) {
      return
    }
    const targetId = String(matches[0].properties?.num)
    focusSearchParcelle(targetId)
  }

  const handleCadastreSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleCadastreSearch()
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
    Object.entries(typeToggles).forEach(([key, checked]) => {
      const existing = typeLayersRef.current[key]
      if (checked && !existing) {
        const [cidStr, type] = key.split(':')
        const id = Number(cidStr)
        const fc = coucheDataRef.current[id]
        if (!fc) return
        const couche = couchesDispo.find((c) => c.id === id)
        const isEquip = couche?.nom === 'equipements_publics'
        // Filtrage par préfixe designation pour équipements PA Temara
        const features = isEquip
          ? (() => {
              const group = EQUIP_PA_GROUPS.find((g) => g.key === type)
              if (!group) return fc.features
              return fc.features.filter((f) => {
                const desig = String(f.properties?.['designation'] ?? '')
                return desig.trim().charAt(0).toUpperCase() === group.prefix
              })
            })()
          : (() => {
              // Reseau routier : filtrer par highway
              return fc.features.filter((f) => String(f.properties?.['highway'] ?? 'autre') === type)
            })()
        const layer = buildTypeLayer(map, id, type, { type: 'FeatureCollection', features })
        typeLayersRef.current[key] = layer
        if (features.length > 0) {
          overlayFlyToBounds(map, layer.getBounds(), { duration: 0.8, maxZoom: 18 })
        }
      } else if (!checked && existing) {
        map.removeLayer(existing)
        delete typeLayersRef.current[key]
      }
    })
    } catch (err) {
      console.warn('[couches] typeToggles error:', err)
    }
  }, [typeToggles, projet])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
    const id = couchesDispo.find((c) => c.nom === 'cadastre')?.id
    if (!id) return
    if (cadastreEnabled && !cadastreLayerRef.current) {
      const fc = coucheDataRef.current[id]
      if (!fc) return
      cadastreLayerRef.current = buildCadastreLayer(map, fc)
      let zoomed = false
      if (analyseResultatsRef.current.length > 0) {
        colorCadastreParcels(selectedTerrainIdRef.current ?? analyseResultatsRef.current[0]?.id)
        const focusId = focusParcelleRef.current
        if (focusId != null) {
          const focus = analyseResultatsRef.current.find((tr) => tr.id === focusId)
          focusParcelleRef.current = null
          if (focus) {
            fitToParcelle(focus)
            zoomed = true
          }
        }
        if (analyzePendingRef.current) {
          analyzePendingRef.current = false
          overlayFlyToBounds(map, cadastreLayerRef.current.getBounds(), { duration: 0.8 })
          zoomed = true
        }
      }
      const pendingSearch = pendingSearchRef.current
      if (pendingSearch != null) {
        pendingSearchRef.current = null
        focusCadastreParcelle(pendingSearch)
        zoomed = true
      }
      if (!zoomed) {
        overlayFlyToBounds(map, cadastreLayerRef.current.getBounds(), { duration: 0.8 })
      }
    } else if (!cadastreEnabled && cadastreLayerRef.current) {
      map.removeLayer(cadastreLayerRef.current)
      cadastreLayerRef.current = null
      clearAffectations()
    }
    } catch (err) {
      console.warn('[couches] cadastre toggle error:', err)
    }
  }, [cadastreEnabled, cadastreReady, couchesDispo, projet])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
    const id = couchesDispo.find((c) => c.nom === 'plan_amenagement')?.id
    if (!id) return
    if (paEnabled && !paLayerRef.current) {
      const fc = coucheDataRef.current[id]
      if (!fc) return
      paLayerRef.current = buildPALayer(map, fc)
      overlayFlyToBounds(map, paLayerRef.current.getBounds(), { duration: 0.8, maxZoom: 18 })
    } else if (!paEnabled && paLayerRef.current) {
      map.removeLayer(paLayerRef.current)
      paLayerRef.current = null
    }
    } catch (err) {
      console.warn('[couches] PA toggle error:', err)
    }
  }, [paEnabled, couchesDispo, projet])

  useEffect(() => {
    if (!projet) return
    const params = new URLSearchParams(window.location.search)
    const analyseId = params.get('analyse')
    if (!analyseId) return
    setCardMode('loading')
    setCardHidden(false)
    setCadastreEnabled(true)
    const parcelle = params.get('parcelle')
    fetchAnalyseDetail(projetId, Number(analyseId))
      .then((detail) => {
        const mapped = detail.resultats.map(toAnalyseResultat)
        analyseResultatsRef.current = mapped
        if (mapped.length === 0) {
          setCardMode('empty')
          return
        }
        setSavedAnalyse(detail)
        analyseFiltresRef.current = detail.filtres
        setTypeToggles(detail.filtres ? layersFromFiltres(detail.filtres) : {})
        const target = parcelle
          ? mapped.find((m) => m.infos_generales.reference_cadastrale === parcelle)
          : mapped[0]
        const selected = target ?? mapped[0]
        selectedTerrainIdRef.current = selected.id
        focusParcelleRef.current = selected.id
        setSelectedTerrain(selected)
        showTerrainBuffer(selected)
        setCardMode('results')
        if (cadastreLayerRef.current) {
          colorCadastreParcels(selected.id)
          fitToParcelle(selected)
        }
      })
      .catch((err) => {
        setCardError(err instanceof Error ? err.message : String(err))
        setCardMode('search')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projet])

  useEffect(() => {
    if (!showSavedBanner) return
    const timer = setTimeout(() => setShowSavedBanner(false), 3000)
    return () => clearTimeout(timer)
  }, [showSavedBanner])

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      const bar = layersBarRef.current
      if (layersPopupOpen && bar && !bar.contains(e.target as Node)) {
        setLayersPopupOpen(false)
        setLegendOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [layersPopupOpen])

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      const menu = basemapMenuRef.current
      if (basemapMenuOpen && menu && !menu.contains(e.target as Node)) {
        setBasemapMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [basemapMenuOpen])

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      const legend = legendRef.current
      if (legendOpen && legend && !legend.contains(e.target as Node)) {
        setLegendOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [legendOpen])

  const toggleCoucheSection = (key: string): void => {
    setCoucheSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const selectTerrain = (terrainId: number, opts: { zoom?: boolean } = {}): void => {
    const terrain = analyseResultatsRef.current.find((tr) => tr.id === terrainId)
    if (!terrain) return
    setSelectedTerrain(terrain)
    setCardMode('results')
    if (opts.zoom !== false) focusTerrainOnMap(terrain)
    else {
      selectedTerrainIdRef.current = terrainId
      colorCadastreParcels(terrainId)
      showTerrainBuffer(terrain)
    }
  }

  // Force Leaflet à recalculer sa taille après la fin de la transition CSS du panneau,
  // sinon les tuiles restent dimensionnées à l'ancienne largeur (vide gris à côté de la carte).
  const refreshMapSize = (): void => {
    const map = mapRef.current
    if (!map) return
    window.setTimeout(() => {
      map.invalidateSize()
    }, SIDEBAR_TRANSITION_MS)
  }

  const toggleSidebar = (): void => {
    setSidebarCollapsed((v) => !v)
    refreshMapSize()
  }

  const closeTerrainCard = (): void => {
    setCardHidden(true)
    refreshMapSize()
  }

  const reopenTerrainCard = (): void => {
    setCardHidden(false)
    refreshMapSize()
  }

  const handlePonderationTerrainSelect = (terrain: TerrainPondere): void => {
    setSelectedPonderationTerrain(terrain)
    setCardMode('ponderationDetail')
    setCardHidden(false)
    refreshMapSize()
    // Cadrage sur la géométrie réelle du terrain + mise en évidence (si la parcelle est connue)
    const match = analyseResultatsRef.current.find(
      (tr) =>
        (terrain.reference_cadastrale != null &&
          String(tr.infos_generales?.reference_cadastrale) === String(terrain.reference_cadastrale)) ||
        tr.nom === terrain.nom,
    )
    if (match) {
      focusTerrainOnMap(match)
    } else if (mapRef.current && terrain.lat && terrain.lng) {
      mapRef.current.flyTo([terrain.lat, terrain.lng], Math.min(17, Math.max(mapRef.current.getZoom(), 15)), { duration: 0.8 })
    }
  }

  if (projetError) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" hideSidebar projectContext={{ id: projetId, name: '...' }}>
        <div className="admin-error-state">
          <p>{projetError}</p>
          <Link to="/projets" className="btn btn-primary">{t('projects.error_login')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  if (!projet) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" hideSidebar projectContext={{ id: projetId, name: '...' }}>
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>{t('ranking.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  const currentBasemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]
  const cardTitle = cardMode === 'search' ? t('ranking.terrain_info') : cardMode === 'addTerrain' ? t('ranking.add_terrain_title') : cardMode === 'terrainList' ? `Resultats (${analyseResultatsRef.current.length})` : cardMode === 'ponderationDetail' && selectedPonderationTerrain ? `Analyse de terrain ${selectedPonderationTerrain.nom}` : cardMode === 'results' && selectedTerrain ? `Analyse de terrain ${selectedTerrain.nom}` : t('ranking.analyse_title')

  const BUFFER_LEGEND: { key: string; label: string }[] = [
    { key: 'distance_route', label: t('ranking.filter_max_distance_road') },
    { key: 'distance_health', label: t('ranking.filter_health') },
    { key: 'distance_education', label: t('ranking.filter_education') },
    { key: 'distance_commerce', label: t('ranking.filter_commerce') },
    { key: 'distance_transport', label: t('ranking.filter_transport') },
    { key: 'distance_admin', label: t('ranking.filter_admin') },
    { key: 'distance_poles', label: t('ranking.filter_distance_poles') },
  ]

  const BUFFER_LABELS: Record<string, string> = Object.fromEntries(BUFFER_LEGEND.map((b) => [b.key, b.label]))
  const activeRouteTypes = routeTypes.filter((rt) => !!typeToggles[rt.key])
  const activeEquipTypes = equipTypes.filter((et) => !!typeToggles[et.key])
  const activeOverlays = OVERLAY_LAYERS.filter((ol) => !!overlays[ol.id])
  const displayedBuffers = selectedTerrain ? filtresDistances(analyseFiltresRef.current ?? {}) : []
  const cadastreCount = coucheCounts.cadastre ?? 0
  const hasActiveLayers =
    cadastreEnabled ||
    paEnabled ||
    activeRouteTypes.length > 0 ||
    activeEquipTypes.length > 0 ||
    activeOverlays.length > 0

  const terrainAreaM2 = terrainForm.geom.areaM2
  const superficieCalculee = terrainAreaM2 != null ? Math.round(terrainAreaM2) : null
  const prixDemandeNum = terrainForm.prix_demande.trim() !== '' ? Number(terrainForm.prix_demande) : null
  const prixM2 = prixDemandeNum != null && superficieCalculee != null && superficieCalculee > 0 ? prixDemandeNum / superficieCalculee : null
  const cosNum = terrainForm.cos.trim() !== '' ? Number(terrainForm.cos) : null
  const surfaceConstructible = superficieCalculee != null && cosNum != null && cosNum > 0 ? superficieCalculee * cosNum : null

  return (
    <>
    <DashboardLayout role="investisseur" activePage="ranking" hideSidebar topbarTitle={t('ranking.geoportal_title')} projectContext={{ id: projet.id, name: projet.nom }}>
      <div className="geo-layout">
        <div className="geo-body">
          <aside className={`geo-sidebar${sidebarCollapsed ? ' geo-sidebar--collapsed' : ''}`}>
            <div className="geo-sidebar-scroll geo-sidebar-scroll--ponderation">
              {/* ── Header ── */}
              <div className="geo-sidebar-header">
                <div className="geo-sidebar-header-row">
                  <div className="geo-sidebar-header-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M4 22h16" />
                      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                  </div>
                  <div className="geo-sidebar-header-text">
                    <h2 className="geo-sidebar-title">Analyse Multicritère</h2>
                    <p className="geo-sidebar-desc">Définissez vos priorités pour classer les terrains</p>
                  </div>
                </div>
              </div>

              {/* ── Stepper ── */}
              <div className="geo-wizard-stepper">
                {(() => {
                  const stepKeys: WizardStep[] = ['selection', 'ahp', 'roc', 'resultats']
                  const stepLabels = ['Critères', 'Vos priorités', 'Classement', 'Résultats']
                  const activeIdx = stepKeys.indexOf(wizardStep)
                  return stepKeys.map((key, i) => {
                    const isDone = i < activeIdx
                    const isActive = i === activeIdx
                    return (
                      <div key={key} className="geo-stepper-group">
                        <div
                          className={`geo-stepper-step ${isDone ? 'geo-stepper-step--done' : ''} ${isActive ? 'geo-stepper-step--active' : ''}`}
                        >
                          <span className="geo-stepper-num">
                            {isDone ? (
                              <svg className="geo-stepper-check" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              i + 1
                            )}
                          </span>
                          <span className="geo-stepper-label">{stepLabels[i]}</span>
                        </div>
                        {i < stepKeys.length - 1 && (
                          <div className={`geo-stepper-connector ${i < activeIdx ? 'geo-stepper-connector--filled' : ''}`} />
                        )}
                      </div>
                    )
                  })
                })()}
              </div>

              {wizardError && (
                <div className="form-alert form-alert--error" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>{wizardError}</div>
              )}

              {wizardLoading && (
                <div className="ponderation-loading" style={{ padding: '1.5rem 0' }}>
                  <div className="admin-loading-spinner" />
                  <p>Analyse en cours…</p>
                </div>
              )}

              {!wizardLoading && wizardStep === 'selection' && (
                <CritereSelectionStep initial={wizardSelections ?? undefined} onComplete={handleWizardSelectionComplete} />
              )}

              {!wizardLoading && wizardStep === 'ahp' && (
                <AhpStep
                  initial={wizardMatriceAhp ?? undefined}
                  initialOrder={wizardOrdreCategoriesAhp.length === 3 ? wizardOrdreCategoriesAhp : undefined}
                  onComplete={handleWizardAhpComplete}
                />
              )}

              {!wizardLoading && wizardStep === 'roc' && wizardNextRocCat && (
                <RocStep
                  key={wizardNextRocCat}
                  categorie={wizardNextRocCat}
                  categorieLabel={WIZARD_CATEGORIE_LABELS[wizardNextRocCat] ?? wizardNextRocCat}
                  criteresInitiaux={wizardOrdresRoc[wizardNextRocCat]}
                  critereLabels={CRITERE_LABELS}
                  onComplete={handleWizardRocComplete}
                />
              )}

              {!wizardLoading && wizardStep === 'resultats' && wizardResultats && (
                <ResultatsStep
                  resultats={wizardResultats.resultats}
                  poidsGlobaux={wizardResultats.poids_globaux}
                  projetId={projetId}
                  onRestart={handleWizardRestart}
                  onViewOnMap={handleWizardViewOnMap}
                  onOpenRentabilite={handleWizardOpenRentabilite}
                  onTerrainSelect={handlePonderationTerrainSelect}
                  hideNavLinks
                />
              )}
            </div>

            <div className="geo-sidebar-footer">
              <button type="button" className="btn geo-btn-reset" onClick={handleWizardRestart}>
                {icons.close} Réinitialiser
              </button>
              <Link to={`/projets/${projetId}/classement`} className="geo-back-link">
                {icons.chevronLeft} {t('ranking.back_to_classement')}
              </Link>
            </div>
          </aside>

          <div className="geo-main">
            <div className="geo-main-body">
              <div className="geo-map-container">
                <div id="map" ref={mapContainerRef}></div>

                <nav className="geo-nav" aria-label={t('ranking.nav_label')}>
                  <div className="geo-nav-search">
                    <span className="geo-nav-search-icon">{icons.search}</span>
                    <input
                      type="search"
                      className="geo-nav-search-input"
                      placeholder={t('ranking.nav_search_placeholder')}
                      value={cadastreQuery}
                      onChange={(e) => setCadastreQuery(e.target.value)}
                      onKeyDown={handleCadastreSearchEnter}
                      aria-label={t('ranking.search_terrain')}
                    />
                  </div>
                  <div className="geo-nav-sep" aria-hidden="true"></div>
                  <button
                    type="button"
                    className={`geo-nav-tab${cadastreEnabled ? ' geo-nav-tab--active' : ''}`}
                    title={t('ranking.carte_cadastrale')}
                    aria-pressed={cadastreEnabled}
                    onClick={() => setCadastreEnabled((v) => !v)}
                  >
                    <span className="geo-nav-tab-icon">{icons.mapPin}</span>
                    <span className="geo-nav-tab-label">{t('ranking.nav_terrains')}</span>
                    {cadastreCount > 0 ? <em className="geo-nav-tab-count">({cadastreCount})</em> : null}
                  </button>
                  <button
                    type="button"
                    className={`geo-nav-tab${paEnabled ? ' geo-nav-tab--active' : ''}`}
                    title={t('ranking.plan_amenagement')}
                    aria-pressed={paEnabled}
                    onClick={() => setPaEnabled((v) => !v)}
                  >
                    <span className="geo-nav-tab-icon">{icons.layers}</span>
                    <span className="geo-nav-tab-label">{t('ranking.plan_amenagement')}</span>
                  </button>
                  <div className="geo-nav-sep" aria-hidden="true"></div>
                  <a
                    className="geo-nav-tab geo-nav-tab--link"
                    href={REGLEMENT_PDF_URL}
                    download
                    title={t('ranking.nav_reglement')}
                  >
                    <span className="geo-nav-tab-icon"><Icon name="document" /></span>
                    <span className="geo-nav-tab-label">{t('ranking.nav_reglement')}</span>
                  </a>
                </nav>

                <div className="geo-coord-display" id="coord-display">{coord}</div>

                {geomMissing ? (
                  <div className="geo-geom-missing" role="alert">
                    <strong>Contour indisponible</strong> — ce terrain n'a pas de polygone enregistré ;
                    impossible d'afficher son contour réel. Vérifiez la géométrie source de la parcelle.
                  </div>
                ) : null}

                {drawMode || drawFinished ? (
                  <div className="geo-draw-panel">
                    {drawFinished ? (
                      <>
                        <div className="geo-draw-panel-title">{t('ranking.draw_done_title')}</div>
                        <p className="geo-draw-panel-text">
                          {t('ranking.draw_area')} : <strong>{drawFinished.area.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} m²</strong>
                        </p>
                        <p className="geo-draw-panel-text">{t('ranking.draw_center')} : {drawFinished.center.lat.toFixed(6)}, {drawFinished.center.lng.toFixed(6)}</p>
                        <div className="geo-draw-panel-actions">
                          <button type="button" className="btn btn-primary" onClick={confirmDraw}>{t('ranking.draw_back_form')}</button>
                          <button type="button" className="btn btn-outline" onClick={resetDraw}>{t('ranking.draw_redo')}</button>
                          <button type="button" className="btn btn-outline" onClick={cancelDraw}>{t('ranking.draw_cancel')}</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="geo-draw-panel-title">{t('ranking.draw_title')}</div>
                        <p className="geo-draw-panel-text">{t('ranking.draw_instructions')}</p>
                        <p className="geo-draw-panel-text geo-draw-panel-text--count">
                          {t('ranking.draw_points_count')} : {drawPointCount}
                        </p>
                        {drawError ? <div className="geo-draw-panel-error">{drawError}</div> : null}
                        <div className="geo-draw-panel-actions">
                          <button type="button" className="btn btn-primary" disabled={drawPointCount < 3} onClick={finishDraw}>{t('ranking.draw_finish')}</button>
                          <button type="button" className="btn btn-outline" onClick={cancelDraw}>{t('ranking.draw_cancel')}</button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                <div className="geo-top-controls" id="top-controls">
                <div className="geo-map-layers-bar" id="layers-bar" ref={layersBarRef}>
                  <div className="geo-layers-trigger" id="layers-trigger">
                    <button
                      type="button"
                      className={`geo-top-fab${layersPopupOpen ? ' geo-top-fab--active' : ''}`}
                      title={t('ranking.couches')}
                      aria-expanded={layersPopupOpen}
                      onClick={(e) => {
                        e.stopPropagation()
                        setBasemapMenuOpen(false)
                        setLegendOpen(false)
                        setLayersPopupOpen((v) => !v)
                      }}
                    >
                      {icons.database}
                    </button>
                  </div>
                  <div className={`geo-top-popup${layersPopupOpen ? ' geo-top-popup--open' : ''}`} id="layers-popup">
                    <div className="geo-layers-popup-section">
                      <span className="geo-layers-popup-label">{t('ranking.cadastre')}</span>
                      <div className="geo-layers-popup-overlays">
                        <label className="geo-popup-overlay-item">
                          <input
                            type="checkbox"
                            checked={cadastreEnabled}
                            onChange={() => setCadastreEnabled((v) => !v)}
                          />
                          <span className="geo-popup-overlay-dot geo-popup-overlay-dot--cadastre"></span>
                          <span>{t('ranking.carte_cadastrale')}</span>
                        </label>
                      </div>
                    </div>
                    <div className="geo-layers-popup-divider"></div>
                    <div className="geo-layers-popup-section">
                      <span className="geo-layers-popup-label">{t('ranking.plan_amenagement')}</span>
                      <div className="geo-layers-popup-overlays">
                        <label className="geo-popup-overlay-item">
                          <input
                            type="checkbox"
                            checked={paEnabled}
                            onChange={() => setPaEnabled((v) => !v)}
                          />
                          <span className="geo-popup-overlay-dot geo-popup-overlay-dot--pa"></span>
                          <span>{t('ranking.plan_amenagement')}</span>
                        </label>
                      </div>
                    </div>
                    {routeTypes.length > 0 || equipTypes.length > 0 ? (
                      <>
                        <div className="geo-layers-popup-divider"></div>
                        {routeTypes.length > 0 ? (
                          <div className="geo-layers-popup-section">
                            <button
                              type="button"
                              className="geo-couche-section-toggle"
                              onClick={() => toggleCoucheSection('routes')}
                              aria-expanded={!!coucheSectionsOpen.routes}
                            >
                              <span className="geo-layers-popup-label">{t('ranking.routes')}</span>
                              <span className={`geo-couche-section-chevron${coucheSectionsOpen.routes ? ' geo-couche-section-chevron--open' : ''}`}>{icons.chevron}</span>
                            </button>
                            {coucheSectionsOpen.routes ? (
                              <div className="geo-layers-popup-overlays geo-layers-popup-overlays--scroll">
                                {routeTypes.map((rt) => (
                                  <label className="geo-popup-overlay-item" key={rt.key}>
                                    <input
                                      type="checkbox"
                                      checked={!!typeToggles[rt.key]}
                                      onChange={() => setTypeToggles((prev) => ({ ...prev, [rt.key]: !prev[rt.key] }))}
                                    />
                                    <span
                                      className="geo-route-swatch"
                                      style={{ background: (ROUTE_STYLES[rt.type] ?? { color: '#6b7280' }).color }}
                                    ></span>
                                    <span>{TYPE_LABELS[rt.type] ?? rt.type} <em className="geo-couche-count">({rt.count})</em></span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="geo-layers-popup-divider"></div>
                        {equipTypes.length > 0 ? (
                          <div className="geo-layers-popup-section">
                            <button
                              type="button"
                              className="geo-couche-section-toggle"
                              onClick={() => toggleCoucheSection('equipements')}
                              aria-expanded={!!coucheSectionsOpen.equipements}
                            >
                              <span className="geo-layers-popup-label">{t('ranking.equipements')}</span>
                              <span className={`geo-couche-section-chevron${coucheSectionsOpen.equipements ? ' geo-couche-section-chevron--open' : ''}`}>{icons.chevron}</span>
                            </button>
                            {coucheSectionsOpen.equipements ? (
                              <div className="geo-layers-popup-overlays geo-layers-popup-overlays--scroll">
                                {equipTypes.map((et) => (
                                  <label className="geo-popup-overlay-item" key={et.key}>
                                    <input
                                      type="checkbox"
                                      checked={!!typeToggles[et.key]}
                                      onChange={() => setTypeToggles((prev) => ({ ...prev, [et.key]: !prev[et.key] }))}
                                    />
                                    <span className="geo-couche-type-svg">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: equipGroupSymbol(et.type) }} />
                                    </span>
                                    <span>{et.type} <em className="geo-couche-count">({et.count})</em></span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="geo-basemap-control" ref={basemapMenuRef}>
                  <button
                    type="button"
                    className={`geo-top-fab${basemapMenuOpen ? ' geo-top-fab--active' : ''}`}
                    id="basemap-fab"
                    title={`${t('ranking.basemap')} — ${currentBasemap.name}`}
                    aria-expanded={basemapMenuOpen}
                    onClick={(e) => {
                      e.stopPropagation()
                      setLayersPopupOpen(false)
                      setLegendOpen(false)
                      setBasemapMenuOpen((v) => !v)
                    }}
                  >
                    {icons.layers}
                  </button>
                  <div className={`geo-top-popup${basemapMenuOpen ? ' geo-top-popup--open' : ''}`} id="basemap-popup">
                    <div className="geo-layers-popup-section">
                      <span className="geo-layers-popup-label">{t('ranking.basemap')}</span>
                      <div className="geo-layers-popup-basemaps" id="basemap-selector">
                        {BASEMAPS.map((bm) => (
                          <button
                            type="button"
                            className={`geo-popup-basemap-btn${bm.id === basemapId ? ' geo-popup-basemap-btn--active' : ''}`}
                            data-basemap={bm.id}
                            key={bm.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setBasemapId(bm.id)
                              setBasemapMenuOpen(false)
                            }}
                          >
                            <img className="geo-popup-basemap-img" src={bm.img} alt={bm.name} />
                            <span className="geo-popup-basemap-label">{bm.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="geo-layers-popup-divider"></div>
                    <div className="geo-layers-popup-section">
                      <span className="geo-layers-popup-label">{t('ranking.overlays')}</span>
                      <div className="geo-layers-popup-overlays" id="overlay-layers">
                        {OVERLAY_LAYERS.map((ol) => (
                          <label className="geo-popup-overlay-item" key={ol.id}>
                            <input
                              type="checkbox"
                              data-overlay-toggle={ol.id}
                              checked={!!overlays[ol.id]}
                              onChange={() => setOverlays((prev) => ({ ...prev, [ol.id]: !prev[ol.id] }))}
                            />
                            <span className="geo-popup-overlay-dot"></span>
                            <span>{ol.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="geo-add-control" id="add-terrain-bar" ref={addTerrainRef}>
                  <div className="geo-layers-trigger">
                    <button
                      type="button"
                      className={`geo-top-fab${cardMode === 'addTerrain' ? ' geo-top-fab--active' : ''}`}
                      title={t('ranking.add_terrain_title')}
                      aria-expanded={cardMode === 'addTerrain'}
                      onClick={(e) => {
                        e.stopPropagation()
                        setBasemapMenuOpen(false)
                        setLayersPopupOpen(false)
                        setLegendOpen(false)
                        if (cardMode === 'addTerrain') {
                          setCardMode('search')
                          setCardHidden(true)
                        } else {
                          setCardMode('addTerrain')
                          setCardHidden(true)
                        }
                      }}
                    >
                      {icons.plus}
                    </button>
                  </div>
                </div>

                <div className="geo-legend-control" id="legend-bar" ref={legendRef}>
                  <div className="geo-layers-trigger">
                    <button
                      type="button"
                      className={`geo-top-fab${legendOpen ? ' geo-top-fab--active' : ''}`}
                      title={t('ranking.legende')}
                      aria-expanded={legendOpen}
                      onClick={(e) => {
                        e.stopPropagation()
                        setBasemapMenuOpen(false)
                        setLayersPopupOpen(false)
                        setLegendOpen((v) => !v)
                      }}
                    >
                      <Icon name="map" />
                    </button>
                  </div>
                  <div className={`geo-top-popup${legendOpen ? ' geo-top-popup--open' : ''}`} id="legend-popup">
                    <div className="geo-layers-popup-section">
                      <span className="geo-layers-popup-label">{t('ranking.legende_couches')}</span>
                      <div className="geo-layers-popup-overlays">
                        {cadastreEnabled ? (
                          <div className="geo-legend-item">
                            <span className="geo-legend-swatch" style={{ background: '#f59e0b' }}></span>
                            <span>{t('ranking.carte_cadastrale')}</span>
                          </div>
                        ) : null}
                        {paEnabled ? (
                          <div className="geo-legend-item">
                            <span className="geo-legend-swatch" style={{ background: '#a855f7' }}></span>
                            <span>{t('ranking.plan_amenagement')}</span>
                          </div>
                        ) : null}
                        {activeRouteTypes.map((rt) => (
                          <div className="geo-legend-item" key={rt.key}>
                            <span className="geo-legend-line" style={{ background: (ROUTE_STYLES[rt.type] ?? { color: '#6b7280' }).color }}></span>
                            <span>{TYPE_LABELS[rt.type] ?? rt.type}</span>
                          </div>
                        ))}
                        {activeEquipTypes.map((et) => (
                          <div className="geo-legend-item" key={et.key}>
                            <span className="geo-couche-type-svg">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: equipGroupSymbol(et.type) }} />
                            </span>
                            <span>{et.type}</span>
                          </div>
                        ))}
                        {activeOverlays.map((ol) => (
                          <div className="geo-legend-item" key={ol.id}>
                            <span className="geo-legend-swatch" style={{ background: '#6b7280' }}></span>
                            <span>{ol.name}</span>
                          </div>
                        ))}
                        {!hasActiveLayers ? (
                          <div className="geo-legend-empty">{t('ranking.legende_vide')}</div>
                        ) : null}
                      </div>
                    </div>
                    {selectedTerrain && displayedBuffers.length > 0 ? (
                      <>
                        <div className="geo-layers-popup-divider"></div>
                        <div className="geo-layers-popup-section">
                          <span className="geo-layers-popup-label">{t('ranking.legende_buffers')}</span>
                          <div className="geo-layers-popup-overlays">
                            {displayedBuffers.map(({ key }) => (
                              <div className="geo-legend-item" key={key}>
                                <span className="geo-legend-swatch" style={{ background: BUFFER_COLORS[key] ?? '#1b3a6e' }}></span>
                                <span>{BUFFER_LABELS[key] ?? key}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}
                    {selectedTerrain ? (
                      <>
                        <div className="geo-layers-popup-divider"></div>
                        <div className="geo-layers-popup-section">
                          <span className="geo-layers-popup-label">{t('ranking.legende_scores')}</span>
                          <div className="geo-layers-popup-overlays">
                            <div className="geo-legend-item">
                              <span className="geo-legend-swatch" style={{ background: '#16a34a' }}></span>
                              <span>{t('ranking.legende_score_tres_bon')}</span>
                            </div>
                            <div className="geo-legend-item">
                              <span className="geo-legend-swatch" style={{ background: '#eab308' }}></span>
                              <span>{t('ranking.legende_score_bon')}</span>
                            </div>
                            <div className="geo-legend-item">
                              <span className="geo-legend-swatch" style={{ background: '#dc2626' }}></span>
                              <span>{t('ranking.legende_score_faible')}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
                </div>

                <button
                  type="button"
                  className={`geo-fab geo-fab-sidebar${sidebarCollapsed ? '' : ' geo-fab--active'}`}
                  id="sidebar-toggle"
                  title={t('ranking.filter_title')}
                  onClick={() => toggleSidebar()}
                >
                  {icons.menu}
                </button>

                <div className={`geo-terrain-card${cardHidden ? ' geo-terrain-card--hidden' : ''}${cardMode === 'addTerrain' ? ' geo-terrain-card--add' : ''}${(cardMode === 'ponderationDetail' && selectedPonderationTerrain) || (cardMode === 'results' && selectedTerrain) ? ' geo-terrain-card--analyse' : ''}`} id="terrain-card">
                  <div className={`geo-terrain-card-header${(cardMode === 'ponderationDetail' && selectedPonderationTerrain) || (cardMode === 'results' && selectedTerrain) ? ' geo-terrain-card-header--analyse' : ''}`}>
                    {(cardMode === 'ponderationDetail' && selectedPonderationTerrain) || (cardMode === 'results' && selectedTerrain) ? (
                      <div className="geo-analyse-header-content">
                        <div className="geo-analyse-header-badge">
                          {icons.building}
                        </div>
                        <div className="geo-analyse-header-text">
                          <h3 id="card-title" className="geo-analyse-header-title">{cardTitle}</h3>
                          <span className="geo-analyse-header-sub">{cardMode === 'ponderationDetail' && selectedPonderationTerrain ? (selectedPonderationTerrain.reference_cadastrale || selectedPonderationTerrain.zone_localisation) : (selectedTerrain?.infos_generales?.reference_cadastrale || '')}</span>
                        </div>
                      </div>
                    ) : (
                      <h3 id="card-title">{cardTitle}</h3>
                    )}
                    <div className="geo-card-header-actions">
                      <button type="button" className={`geo-terrain-card-close${(cardMode === 'ponderationDetail' || cardMode === 'results') ? ' geo-terrain-card-close--analyse' : ''}`} id="terrain-card-toggle" onClick={closeTerrainCard}>
                        {icons.close}
                      </button>
                    </div>
                  </div>
                  <div className="geo-terrain-card-body" id="card-body">
                    <div className="geo-card-results" id="card-results">
                      {cardError ? (
                        <div className="geo-sr-empty"><p>{cardError}</p></div>
                      ) : cardMode === 'addTerrain' ? (
                        null
                      ) : cardMode === 'loading' ? (
                        <div className="geo-sr-loading"><div className="geo-sr-spinner"></div> {t('ranking.analyse_running')}</div>
                      ) : cardMode === 'empty' ? (
                        <div className="geo-sr-empty">
                          <span className="geo-sr-empty-icon">{icons.search}</span>
                          <p className="geo-sr-empty-text">{t('ranking.no_terrains_found')}</p>
                        </div>
                      ) : cardMode === 'ponderationDetail' && selectedPonderationTerrain ? (
                        renderAnalyseDeTerrainCard(
                          buildPondereVM(selectedPonderationTerrain),
                          () => handleWizardOpenRentabilite(selectedPonderationTerrain),
                        )
                      ) : cardMode === 'results' && selectedTerrain ? (
                        <>
                          {savedAnalyse && showSavedBanner ? (
                            <div className="geo-save-banner geo-save-banner--ok geo-save-banner--card">
                              ✓ {t('ranking.analyse_saved')}
                            </div>
                          ) : null}
                          {renderAnalyseDeTerrainCard(buildResultatVM(selectedTerrain), () => openRentabiliteFromResultat(selectedTerrain))}
                        </>
                      ) : (
                        <div className="geo-sr-empty">
                          <span className="geo-sr-empty-icon">{icons.search}</span>
                          <p className="geo-sr-empty-text">{t('ranking.analyse_empty')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={`geo-fab geo-fab-terrain${cardHidden ? ' geo-fab--visible' : ''}`}
                  id="terrain-card-reopen"
                  title={t('ranking.terrain_info')}
                  onClick={reopenTerrainCard}
                >
                  {icons.building}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>

    {rentaModalOpen ? createPortal(
      <div className="geo-dims-overlay renta-modal-overlay" data-dims-overlay onClick={() => setRentaModalOpen(false)}>
        <div className="geo-dims-modal" style={{ maxWidth: 1600, width: '95vw', height: '94vh' }} onClick={(e) => e.stopPropagation()}>
          <div className="geo-dims-header">
            <div>
              <h3>Calcul de rentabilit&eacute;</h3>
              <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>{rentaParcelInfo?.ref || rentaTerrainNom || rentaParcelInfo?.nom || ''}</span>
            </div>
            <div className="geo-dims-header-actions">
              <button type="button" className="geo-dims-close" data-dims-close aria-label="Fermer" onClick={() => setRentaModalOpen(false)}>&times;</button>
            </div>
          </div>

          <div className="geo-dims-body renta-modal-content">
            <div className="renta-modal-form">
              {rentaNote ? (
                <div className="form-alert form-alert--success">{rentaNote}</div>
              ) : null}
              {rentaError ? (
                <div className="form-alert form-alert--error">{rentaError}</div>
              ) : null}

              {rentaParcelInfo && (
                <div className="geo-card-form-section">
                  <span className="geo-layers-popup-label">{t('ranking.terrain_info')}</span>
                  <div className="renta-results-grid">
                    <div className="geo-terrain-calc-row">
                      <span>Titre foncier</span>
                      <strong>{rentaParcelInfo.ref || rentaParcelInfo.nom || '—'}</strong>
                    </div>
                    <div className="geo-terrain-calc-row">
                      <span>Superficie terrain</span>
                      <strong>{Number.isFinite(rentaParcelInfo.superficie) ? Number(rentaParcelInfo.superficie).toLocaleString('fr-FR') : '—'} m²</strong>
                    </div>
                    <div className="geo-terrain-calc-row">
                      <span>Surface constructible</span>
                      <strong>{rentaSurfaceConstructible ? `${rentaSurfaceConstructible.surface_constructible.toLocaleString('fr-FR')} m²` : rentaSurfaceLoading ? 'Calcul en cours...' : '—'}</strong>
                    </div>
                    {rentaSurfaceConstructible ? (
                      <div className="geo-terrain-calc-row">
                        <span>Taux de constructibilit&eacute;</span>
                        <strong className={rentaSurfaceConstructible.taux >= 80 ? 'text-success' : rentaSurfaceConstructible.taux >= 50 ? '' : 'text-error'}>
                          {rentaSurfaceConstructible.taux}%
                        </strong>
                      </div>
                    ) : rentaSurfaceLoading ? (
                      <div className="geo-terrain-calc-row">
                        <span>Taux de constructibilit&eacute;</span>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 0.8s linear infinite' }}>
                            <circle cx="8" cy="8" r="6" fill="none" stroke="#d1d5db" strokeWidth="2" />
                            <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </strong>
                      </div>
                    ) : null}
                    {rentaSurfaceConstructible && rentaSurfaceConstructible.designation_dominante && (
                      <div className="geo-terrain-calc-row">
                        <span>Désignation dominante</span>
                        <strong>{rentaSurfaceConstructible.designation_dominante}</strong>
                      </div>
                    )}
                    {rentaSurfaceConstructible && (
                      <>
                        <div className="geo-terrain-calc-row">
                          <span>COS</span>
                          <strong>{rentaSurfaceConstructible.cos != null ? rentaSurfaceConstructible.cos : 'Non fixé'}</strong>
                        </div>
                        <div className="geo-terrain-calc-row">
                          <span>CUS</span>
                          <strong>{rentaSurfaceConstructible.cus != null ? rentaSurfaceConstructible.cus : 'Non fixé'}</strong>
                        </div>
                      </>
                    )}
                    {rentaSurfaceConstructible && rentaSurfaceConstructible.affectations.length > 0 && (
                      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => setRentaAffectationsOpen((v) => !v)}
                          style={{
                            background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
                            fontSize: '0.82rem', fontWeight: 500, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: rentaAffectationsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                            <path d="M4.5 2.5L8 6L4.5 9.5" />
                          </svg>
                          D&eacute;tail des affectations
                        </button>
                        {rentaAffectationsOpen && (
                          <div style={{ marginTop: 6, background: '#f9fafb', borderRadius: 6, padding: '6px 0', fontSize: '0.8rem', maxHeight: 220, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ color: '#6b7280', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '4px 10px' }}>Désignation</td>
                                  <td style={{ padding: '4px 10px' }}>Type de construction</td>
                                  <td style={{ padding: '4px 10px', textAlign: 'right' }}>Type</td>
                                  <td style={{ padding: '4px 10px', textAlign: 'right' }}>Surface</td>
                                  <td style={{ padding: '4px 10px', textAlign: 'right' }}>% terrain</td>
                                  <td style={{ padding: '4px 10px' }}>Conditions</td>
                                  <td style={{ padding: '4px 10px' }}>Type d'op&eacute;ration</td>
                                </tr>
                              </thead>
                              <tbody>
                                {rentaSurfaceConstructible.affectations
                                  .filter((a) => a.surface_m2 > 0)
                                  .sort((a, b) => b.surface_m2 - a.surface_m2)
                                  .map((a, i) => {
                                    const pct = rentaParcelInfo?.superficie ? Math.round(a.surface_m2 / rentaParcelInfo.superficie * 10000) / 100 : 0
                                    return (
                                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '4px 10px', fontWeight: 500 }}>{a.designation || '—'}</td>
                                        <td style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#6b7280' }}>
                                          {a.type_construction || '—'}
                                        </td>
                                        <td style={{ padding: '4px 10px', textAlign: 'right' }}>
                                          <span style={{
                                            fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4,
                                            background: a.type === 'constructible' ? '#dcfce7' : '#fee2e2',
                                            color: a.type === 'constructible' ? '#166534' : '#991b1b',
                                          }}>
                                            {a.type === 'constructible' ? 'Constr.' : 'Non constr.'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '4px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          {a.surface_m2.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m&sup2;
                                        </td>
                                        <td style={{ padding: '4px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                          {pct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%
                                        </td>
                                        <td style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#6b7280', maxWidth: 160 }}>
                                          {a.designation ? (getReglesPrincipales(a.designation)?.conditions || '—') : '—'}
                                        </td>
                                        <td style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#6b7280', maxWidth: 160 }}>
                                          {a.designation ? (getReglesPrincipales(a.designation)?.typeOperation || '—') : '—'}
                                        </td>
                                      </tr>
                                    )
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}


                  </div>
                </div>
              )}

              <div className="geo-card-form-section">
                <span className="geo-layers-popup-label">{t('projects.section_land_data')}</span>
                <div className="form-row">
                  <div className="form-field form-field--half">
                    <label className="form-label">{t('projects.field_prix_foncier_m2')}</label>
                    <input type="number" step="0.01" className="modal-input" placeholder="4000" value={rentaForm.prixFoncierM2} onChange={(e) => setRentaForm((f) => ({ ...f, prixFoncierM2: e.target.value }))} />
                  </div>
                  <div className="form-field form-field--half">
                    <label className="form-label">{t('projects.field_frais_acquisition')}</label>
                    <input type="number" step="0.01" className="modal-input" value={rentaForm.fraisAcquisition} onChange={(e) => setRentaForm((f) => ({ ...f, fraisAcquisition: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field form-field--half">
                    <label className="form-label">{t('projects.field_taux_chute')}</label>
                    <input type="number" step="0.01" className="modal-input" value={rentaForm.tauxChute} onChange={(e) => setRentaForm((f) => ({ ...f, tauxChute: e.target.value }))} />
                  </div>
                  <div className="form-field form-field--half">
                    <label className="form-label">{t('projects.field_cos')}</label>
                    <input type="number" step="0.01" className="modal-input" value={rentaForm.cos} onChange={(e) => setRentaForm((f) => ({ ...f, cos: e.target.value }))} />
                  </div>
                </div>
                <div className="form-field" style={{ maxWidth: '50%' }}>
                  <label className="form-label">{t('projects.field_cus')}</label>
                  <input type="number" step="0.01" className="modal-input" value={rentaForm.cus} onChange={(e) => setRentaForm((f) => ({ ...f, cus: e.target.value }))} />
                </div>
              </div>

              <div className="geo-card-form-section">
                <span className="geo-layers-popup-label">{t('projects.section_destinations')}</span>
                <div className="cp-dest-toggles" style={{ gap: 6 }}>
                  <label className={`cp-dest-toggle${rentaForm.hasAppartement ? ' active' : ''}`} style={{ fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={rentaForm.hasAppartement} onChange={(e) => setRentaForm((f) => ({ ...f, hasAppartement: e.target.checked }))} />
                    {t('projects.dest_appartement')}
                  </label>
                  <label className={`cp-dest-toggle${rentaForm.hasCommerce ? ' active' : ''}`} style={{ fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={rentaForm.hasCommerce} onChange={(e) => setRentaForm((f) => ({ ...f, hasCommerce: e.target.checked }))} />
                    {t('projects.dest_commerce')}
                  </label>
                  <label className={`cp-dest-toggle${rentaForm.hasBureau ? ' active' : ''}`} style={{ fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={rentaForm.hasBureau} onChange={(e) => setRentaForm((f) => ({ ...f, hasBureau: e.target.checked }))} />
                    {t('projects.dest_bureau')}
                  </label>
                  {/* Équipement toggle — désactivé si aucune intersection */}
                  <label
                    className={`cp-dest-toggle${rentaForm.hasEquipement ? ' active' : ''}${
                      (!rentaSurfaceEquipement || rentaSurfaceEquipement.surface_equipement === 0) ? ' cp-dest-toggle--disabled' : ''
                    }`}
                    style={{ fontSize: '0.85rem' }}
                    title={(!rentaSurfaceEquipement || rentaSurfaceEquipement.surface_equipement === 0)
                      ? 'Ce terrain ne couvre aucune zone d\'équipement'
                      : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={rentaForm.hasEquipement}
                      disabled={!rentaSurfaceEquipement || rentaSurfaceEquipement.surface_equipement === 0}
                      onChange={(e) => {
                        if (!rentaSurfaceEquipement || rentaSurfaceEquipement.surface_equipement === 0) return
                        setRentaForm((f) => ({ ...f, hasEquipement: e.target.checked }))
                      }}
                    />
                    {t('projects.dest_equipement')}
                  </label>
                </div>
              </div>

              {rentaForm.hasEquipement ? (
                <div className="renta-row-split">
                  <div className="geo-card-form-section">
                    <span className="geo-layers-popup-label">{t('projects.section_quote_parts')}</span>
                    <div className="form-row">
                      {rentaForm.hasAppartement && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_quote_part_app')}</label>
                          <input type="number" step="0.01" className="modal-input" value={rentaForm.quotePartApp} onChange={(e) => setRentaForm((f) => ({ ...f, quotePartApp: e.target.value }))} />
                        </div>
                      )}
                      {rentaForm.hasCommerce && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_quote_part_commerce')}</label>
                          <input type="number" step="0.01" className="modal-input" value={rentaForm.quotePartCommerce} onChange={(e) => setRentaForm((f) => ({ ...f, quotePartCommerce: e.target.value }))} />
                        </div>
                      )}
                      {rentaForm.hasBureau && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_quote_part_bureau')}</label>
                          <input type="number" step="0.01" className="modal-input" value={rentaForm.quotePartBureau} onChange={(e) => setRentaForm((f) => ({ ...f, quotePartBureau: e.target.value }))} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="geo-card-form-section">
                    <span className="geo-layers-popup-label">{t('projects.field_quote_part_equipement')}</span>
                    <div className="form-field">
                      <label className="form-label">Taux des équipements</label>
                      <div className="modal-input" style={{ background: '#f3f4f6', cursor: 'default' }}>
                        {rentaSurfaceEquipement
                          ? `${Number(rentaSurfaceEquipement.taux_equipement).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`
                          : '0%'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="geo-card-form-section">
                  <span className="geo-layers-popup-label">{t('projects.section_quote_parts')}</span>
                  <div className="form-row">
                    {rentaForm.hasAppartement && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_quote_part_app')}</label>
                        <input type="number" step="0.01" className="modal-input" value={rentaForm.quotePartApp} onChange={(e) => setRentaForm((f) => ({ ...f, quotePartApp: e.target.value }))} />
                      </div>
                    )}
                    {rentaForm.hasCommerce && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_quote_part_commerce')}</label>
                        <input type="number" step="0.01" className="modal-input" value={rentaForm.quotePartCommerce} onChange={(e) => setRentaForm((f) => ({ ...f, quotePartCommerce: e.target.value }))} />
                      </div>
                    )}
                    {rentaForm.hasBureau && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_quote_part_bureau')}</label>
                        <input type="number" step="0.01" className="modal-input" value={rentaForm.quotePartBureau} onChange={(e) => setRentaForm((f) => ({ ...f, quotePartBureau: e.target.value }))} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {rentaForm.hasEquipement ? (
                <div className="renta-row-split">
                  <div className="geo-card-form-section">
                    <span className="geo-layers-popup-label">{t('projects.section_dest_prices')}</span>
                    <div className="form-row">
                      {rentaForm.hasAppartement && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_prix_vente_app')}</label>
                          <input type="number" step="0.01" className="modal-input" placeholder="8000" value={rentaForm.prixVenteApp} onChange={(e) => setRentaForm((f) => ({ ...f, prixVenteApp: e.target.value }))} />
                        </div>
                      )}
                      {rentaForm.hasCommerce && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_prix_vente_commerce')}</label>
                          <input type="number" step="0.01" className="modal-input" placeholder="12000" value={rentaForm.prixVenteCommerce} onChange={(e) => setRentaForm((f) => ({ ...f, prixVenteCommerce: e.target.value }))} />
                        </div>
                      )}
                      {rentaForm.hasBureau && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_prix_vente_bureau')}</label>
                          <input type="number" step="0.01" className="modal-input" placeholder="10000" value={rentaForm.prixVenteBureau} onChange={(e) => setRentaForm((f) => ({ ...f, prixVenteBureau: e.target.value }))} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="geo-card-form-section">
                    <span className="geo-layers-popup-label">{t('projects.field_surface_equipement')}</span>
                    <div className="form-field">
                      <label className="form-label">Surface des équipements</label>
                      <div className="modal-input" style={{ background: '#f3f4f6', cursor: 'default' }}>
                        {rentaSurfaceEquipement?.surface_equipement != null
                          ? `${Number(rentaSurfaceEquipement.surface_equipement).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m²`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="geo-card-form-section">
                  <span className="geo-layers-popup-label">{t('projects.section_dest_prices')}</span>
                  <div className="form-row">
                    {rentaForm.hasAppartement && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_prix_vente_app')}</label>
                        <input type="number" step="0.01" className="modal-input" placeholder="8000" value={rentaForm.prixVenteApp} onChange={(e) => setRentaForm((f) => ({ ...f, prixVenteApp: e.target.value }))} />
                      </div>
                    )}
                    {rentaForm.hasCommerce && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_prix_vente_commerce')}</label>
                        <input type="number" step="0.01" className="modal-input" placeholder="12000" value={rentaForm.prixVenteCommerce} onChange={(e) => setRentaForm((f) => ({ ...f, prixVenteCommerce: e.target.value }))} />
                      </div>
                    )}
                    {rentaForm.hasBureau && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_prix_vente_bureau')}</label>
                        <input type="number" step="0.01" className="modal-input" placeholder="10000" value={rentaForm.prixVenteBureau} onChange={(e) => setRentaForm((f) => ({ ...f, prixVenteBureau: e.target.value }))} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {rentaForm.hasEquipement ? (
                <div className="renta-row-split">
                  <div className="geo-card-form-section">
                    <span className="geo-layers-popup-label">{t('projects.section_dest_costs')}</span>
                    <div className="form-row">
                      {rentaForm.hasAppartement && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_cout_constr_app')}</label>
                          <input type="number" step="0.01" className="modal-input" placeholder="4500" value={rentaForm.coutConstrApp} onChange={(e) => setRentaForm((f) => ({ ...f, coutConstrApp: e.target.value }))} />
                        </div>
                      )}
                      {rentaForm.hasCommerce && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_cout_constr_commerce')}</label>
                          <input type="number" step="0.01" className="modal-input" placeholder="5500" value={rentaForm.coutConstrCommerce} onChange={(e) => setRentaForm((f) => ({ ...f, coutConstrCommerce: e.target.value }))} />
                        </div>
                      )}
                      {rentaForm.hasBureau && (
                        <div className="form-field form-field--half">
                          <label className="form-label">{t('projects.field_cout_constr_bureau')}</label>
                          <input type="number" step="0.01" className="modal-input" placeholder="5000" value={rentaForm.coutConstrBureau} onChange={(e) => setRentaForm((f) => ({ ...f, coutConstrBureau: e.target.value }))} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="geo-card-form-section">
                    <span className="geo-layers-popup-label">{t('projects.field_prix_vente_equipement')}</span>
                    <div className="form-field">
                      <label className="form-label">Prix unitaire (DH/m²)</label>
                      <input type="number" step="0.01" className="modal-input" placeholder="Prix unitaire (DH/m²)" value={rentaForm.prixVenteEquipement} onChange={(e) => setRentaForm((f) => ({ ...f, prixVenteEquipement: e.target.value }))} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="geo-card-form-section">
                  <span className="geo-layers-popup-label">{t('projects.section_dest_costs')}</span>
                  <div className="form-row">
                    {rentaForm.hasAppartement && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_cout_constr_app')}</label>
                        <input type="number" step="0.01" className="modal-input" placeholder="4500" value={rentaForm.coutConstrApp} onChange={(e) => setRentaForm((f) => ({ ...f, coutConstrApp: e.target.value }))} />
                      </div>
                    )}
                    {rentaForm.hasCommerce && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_cout_constr_commerce')}</label>
                        <input type="number" step="0.01" className="modal-input" placeholder="5500" value={rentaForm.coutConstrCommerce} onChange={(e) => setRentaForm((f) => ({ ...f, coutConstrCommerce: e.target.value }))} />
                      </div>
                    )}
                    {rentaForm.hasBureau && (
                      <div className="form-field form-field--half">
                        <label className="form-label">{t('projects.field_cout_constr_bureau')}</label>
                        <input type="number" step="0.01" className="modal-input" placeholder="5000" value={rentaForm.coutConstrBureau} onChange={(e) => setRentaForm((f) => ({ ...f, coutConstrBureau: e.target.value }))} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="geo-card-form-section">
                <span className="geo-layers-popup-label">{t('projects.section_charges')}</span>
                <div className="form-row">
                  <div className="form-field form-field--half">
                    <label className="form-label">{t('projects.field_taux_etudes')}</label>
                    <input type="number" step="0.01" className="modal-input" value={rentaForm.tauxEtudes} onChange={(e) => setRentaForm((f) => ({ ...f, tauxEtudes: e.target.value }))} />
                  </div>
                  <div className="form-field form-field--half">
                    <label className="form-label">{t('projects.field_taux_imprevus')}</label>
                    <input type="number" step="0.01" className="modal-input" value={rentaForm.tauxImprevus} onChange={(e) => setRentaForm((f) => ({ ...f, tauxImprevus: e.target.value }))} />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">{t('projects.field_taux_commercialisation')}</label>
                  <input type="number" step="0.01" className="modal-input" value={rentaForm.tauxCommercialisation} onChange={(e) => setRentaForm((f) => ({ ...f, tauxCommercialisation: e.target.value }))} />
                </div>
              </div>

              <div className="geo-card-form-section">
                <span className="geo-layers-popup-label">{t('projects.section_scheduling')}</span>
                <div className="form-row">
                  <div className="form-field form-field--half">
                    <label className="form-label">{t('projects.field_duree_construction')}</label>
                    <input type="number" className="modal-input" value={rentaForm.dureeConstruction} onChange={(e) => setRentaForm((f) => ({ ...f, dureeConstruction: e.target.value }))} />
                  </div>
                  <div className="form-field form-field--half">
                    <label className="form-label">{t('projects.field_duree_commercialisation')}</label>
                    <input type="number" className="modal-input" value={rentaForm.dureeCommercialisation} onChange={(e) => setRentaForm((f) => ({ ...f, dureeCommercialisation: e.target.value }))} />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">{t('projects.field_taux_actualisation')}</label>
                  <input type="number" step="0.01" className="modal-input" value={rentaForm.tauxActualisation} onChange={(e) => setRentaForm((f) => ({ ...f, tauxActualisation: e.target.value }))} />
                </div>
              </div>

              {rentaResult && rentaResult.ok ? (
                <div className="geo-card-form-section geo-card-renta-results">
                  <span className="geo-layers-popup-label">{t('projects.section_results')}</span>
                  <div className="renta-results-grid">
                    <div className="geo-terrain-calc-row">
                      <span>{t('projects.res_surface')}</span>
                      <strong>{rentaResult.surfaces?.surface_vendable?.toLocaleString('fr-FR') ?? '—'} m²</strong>
                    </div>
                    <div className="geo-terrain-calc-row">
                      <span>{t('projects.res_ca')}</span>
                      <strong>{rentaResult.ca?.ca_total?.toLocaleString('fr-FR') ?? '—'} DH</strong>
                    </div>
                    <div className="geo-terrain-calc-row">
                      <span>{t('projects.res_cout_total')}</span>
                      <strong>{rentaResult.cout_total_projet?.toLocaleString('fr-FR') ?? '—'} DH</strong>
                    </div>
                    <div className="geo-terrain-calc-row">
                      <span>{t('projects.res_tri')}</span>
                      <strong>{rentaResult.tri != null ? `${rentaResult.tri}%` : '—'}</strong>
                    </div>
                    <div className="renta-results-highlight">
                      <span>{t('projects.res_benefice')}</span>
                      <strong className={(rentaResult.benefice_net ?? 0) >= 0 ? 'text-success' : 'text-error'}>
                        {rentaResult.benefice_net?.toLocaleString('fr-FR') ?? '—'} DH
                      </strong>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="geo-dims-actions">
                <button type="button" className="geo-dims-btn geo-dims-btn--ghost" onClick={() => setRentaModalOpen(false)}>{t('common.cancel')}</button>
                <button type="button" className="geo-dims-btn geo-dims-btn--calc" disabled={rentaCalculating} onClick={() => { void handleCalculateRentabilite() }}>
                  {rentaCalculating ? '...' : t('projects.btn_calculate')}
                </button>
                <button type="button" className="geo-dims-btn geo-dims-btn--primary" disabled={!rentaResult?.ok || rentaSaving} onClick={() => { void handleSaveRentabiliteTerrain() }}>
                  {rentaSaving ? '...' : icons.save} {t('ranking.save_terrain')}
                </button>
              </div>
            </div>

              <div className="renta-modal-sidebar">
                <div className="renta-sidebar-header">
                  <h4>{icons.building} Terrains du projet</h4>
                  <span>{rentaTerrains.length} terrain{rentaTerrains.length !== 1 ? 's' : ''} enregistré{rentaTerrains.length !== 1 ? 's' : ''}</span>
                </div>
              {rentaTerrains.length === 0 ? (
                <div className="renta-sidebar-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
                  <p>Aucun terrain enregistré pour ce projet.<br/>Calculez la rentabilité d'un terrain puis enregistrez-le.</p>
                </div>
              ) : (
                <div className="renta-sidebar-list">
                  {[...rentaTerrains]
                    .sort((a, b) => {
                      const triA = a.rentabilite_json ? ((a.rentabilite_json as Record<string, unknown>).tri as number) ?? -Infinity : -Infinity
                      const triB = b.rentabilite_json ? ((b.rentabilite_json as Record<string, unknown>).tri as number) ?? -Infinity : -Infinity
                      return triB - triA
                    })
                    .map((tr, i) => {
                      const rj = tr.rentabilite_json as Record<string, unknown> | null
                      const tri = rj ? (rj.tri as number | undefined) : undefined
                      const benefice = rj ? (rj.benefice_net as number | undefined) : undefined
                      const hasRenta = tri != null
                      return (
                        <div
                          key={tr.id}
                          className={`renta-terrain-card${rentaTerrainId === tr.id ? ' renta-terrain-card--active' : ''}`}
                          onClick={() => {
                            setRentaTerrainId(tr.id)
                            setRentaTerrainNom(tr.nom)
                            setRentaParcelInfo({ nom: tr.nom, superficie: Number(tr.superficie) || 0, lat: Number(tr.lat) || 0, lng: Number(tr.lng) || 0, ref: tr.num_titre_foncier || tr.num_parcelle || '' })
                            setRentaResult(tr.rentabilite_json as Rentabilite | null)
                            setRentaSurfaceConstructible(null)
                            setRentaSurfaceEquipement(null)
                            setRentaAffectationsOpen(false)
                            setRentaSurfaceLoading(true)
                          }}
                        >
                          <div className="renta-terrain-card-top">
                            <span className="renta-terrain-card-rank">#{i + 1}</span>
                            <div className="renta-terrain-card-name">{tr.nom || tr.num_titre_foncier || `Terrain #${tr.id}`}</div>
                          </div>
                          <div className="renta-terrain-card-surf">{Number(tr.superficie).toLocaleString('fr-FR')} m²</div>
                          <div className="renta-terrain-card-data">
                            <div className="renta-terrain-card-datum">
                              <span>TRI</span>
                              <strong className={hasRenta ? (tri! >= 0 ? 'text-success' : 'text-error') : 'text-muted'}>{hasRenta ? `${tri!.toFixed(2)}%` : '—'}</strong>
                            </div>
                            <div className="renta-terrain-card-datum">
                              <span>Bénéfice net</span>
                              <strong className={benefice != null ? (benefice >= 0 ? 'text-success' : 'text-error') : 'text-muted'}>{benefice != null ? `${benefice.toLocaleString('fr-FR')} DH` : '—'}</strong>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    ) : null}

    {cardMode === 'addTerrain' ? createPortal(
      <div className="geo-dims-overlay renta-modal-overlay" data-dims-overlay onClick={() => { setCardMode('search'); setCardHidden(true) }}>
        <div className="geo-dims-modal" style={{ maxWidth: 1600, width: '95vw', height: '94vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
          <div className="geo-dims-header">
            <div>
              <h3>{t('ranking.add_terrain_title')}</h3>
            </div>
            <div className="geo-dims-header-actions">
              <button type="button" className="geo-dims-close" data-dims-close aria-label="Fermer" onClick={() => { setCardMode('search'); setCardHidden(true) }}>&times;</button>
            </div>
          </div>

          <div className="geo-dims-body renta-modal-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            <form id="terrain-form" className="admin-modal-form geo-card-add-form" style={{ width: '100%' }} noValidate onSubmit={(e) => { void handleAddTerrain(e) }}>
              <div className="form-alert form-alert--error" hidden={!terrainError}>{terrainError}</div>
              {terrainNote ? (
                <div className="form-alert form-alert--success terrain-draft-note">
                  {terrainNote}
                  {terrainForm.geom.geometry ? (
                    <button type="button" className="terrain-draft-clear" onClick={clearFormDraw}>{t('ranking.loc_clear_draw')}</button>
                  ) : null}
                </div>
              ) : null}

              <div className="geo-card-form-section">
                <div className="form-field">
                  <label htmlFor="g-t-titre" className="form-label">{t('ranking.field_num_titre_foncier')}</label>
                  <input id="g-t-titre" name="num_titre_foncier" className="modal-input" placeholder="T54884" value={terrainForm.num_titre_foncier} onChange={(e) => setTerrainForm((f) => ({ ...f, num_titre_foncier: e.target.value }))} />
                </div>

                <div className="form-row">
                  <div className="form-field form-field--half">
                    <label htmlFor="g-t-statut" className="form-label">{t('ranking.field_statut_juridique')}</label>
                    <select id="g-t-statut" name="statut_juridique" className="modal-input" value={terrainForm.statut_juridique || 'titre'} onChange={(e) => setTerrainForm((f) => ({ ...f, statut_juridique: e.target.value }))}>
                      {STATUTS_JURIDIQUES.map((s) => (
                        <option key={s.value} value={s.value}>{t(`ranking.${s.label}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field form-field--half">
                    <label htmlFor="g-t-zonage" className="form-label">{t('ranking.field_zonage')}</label>
                    <select id="g-t-zonage" name="zonage" className="modal-input" value={terrainForm.zonage || 'residentiel'} onChange={(e) => setTerrainForm((f) => ({ ...f, zonage: e.target.value }))}>
                      {ZONAGES.map((z) => (
                        <option key={z.value} value={z.value}>{t(`ranking.${z.label}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field form-field--half">
                    <label htmlFor="g-t-prix" className="form-label">{t('ranking.field_prix_demande')}</label>
                    <input id="g-t-prix" name="prix_demande" type="number" min="0" step="any" className="modal-input" value={terrainForm.prix_demande} onChange={(e) => setTerrainForm((f) => ({ ...f, prix_demande: e.target.value }))} />
                  </div>
                  <div className="form-field form-field--half">
                    <label htmlFor="g-t-hauteur" className="form-label">{t('ranking.field_hauteur_maximale')}</label>
                    <input id="g-t-hauteur" name="hauteur_maximale" type="number" min="0" step="any" className="modal-input" placeholder="15" value={terrainForm.hauteur_maximale} onChange={(e) => setTerrainForm((f) => ({ ...f, hauteur_maximale: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field form-field--half">
                    <label htmlFor="g-t-cos" className="form-label">{t('ranking.field_cos')}</label>
                    <input id="g-t-cos" name="cos" type="number" min="0" step="any" className="modal-input" placeholder="0.5" value={terrainForm.cos} onChange={(e) => setTerrainForm((f) => ({ ...f, cos: e.target.value }))} />
                  </div>
                  <div className="form-field form-field--half">
                    <label htmlFor="g-t-cus" className="form-label">{t('ranking.field_cus')}</label>
                    <input id="g-t-cus" name="cus" type="number" min="0" step="any" className="modal-input" placeholder="1.0" value={terrainForm.cus} onChange={(e) => setTerrainForm((f) => ({ ...f, cus: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="geo-card-form-section">
                <span className="geo-layers-popup-label">{t('ranking.geo_geometry_title')}</span>
                <TerrainGeometryEditor
                  value={terrainForm.geom}
                  onChange={(geom: TerrainGeom) => setTerrainForm((f) => ({ ...f, geom }))}
                  cadastre={cadastreFc}
                />
              </div>

              <div className="geo-terrain-calc">
                <div className="geo-terrain-calc-row">
                  <span>{t('ranking.geo_area')}</span>
                  <strong>{superficieCalculee != null ? `${superficieCalculee.toLocaleString('fr-FR')} m²` : '—'}</strong>
                </div>
                <div className="geo-terrain-calc-row">
                  <span>{t('ranking.price_per_m2')}</span>
                  <strong>{prixM2 != null ? `${prixM2.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DH/m²` : '—'}</strong>
                </div>
                <div className="geo-terrain-calc-row">
                  <span>{t('ranking.surface_constructible')}</span>
                  <strong>{surfaceConstructible != null ? `${surfaceConstructible.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} m²` : '—'}</strong>
                </div>
              </div>

              <div className="admin-modal-actions geo-card-form-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setCardMode('search'); setCardHidden(true) }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={savingTerrain}>{savingTerrain ? '…' : icons.save} {t('ranking.save_terrain')}</button>
              </div>
            </form>
          </div>
        </div>
      </div>,
      document.body
    ) : null}
    </>
  )
}

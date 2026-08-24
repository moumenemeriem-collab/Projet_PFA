import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { icons, Icon } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { TerrainGeometryEditor, emptyGeom, type TerrainGeom } from '../components/TerrainGeometryEditor'
import { formatApiErrors } from '../api/auth'
import { fetchProjet, previewRentabilite, type Projet, type ProjetPayload, type Rentabilite } from '../api/projets'
import { createTerrain, fetchAnalyse, fetchTerrains, saveTerrainRentabilite, type AnalyseFiltres, type AnalyseResultat, type Terrain } from '../api/terrains'
import { createAnalyse, fetchAnalyseDetail, type AnalyseDetail, type ResultatAnalyse } from '../api/analyses'
import { fetchCouches, fetchCoucheGeoJSON, type Couche, type CoucheFeature, type CoucheFeatureCollection } from '../api/couches'
import { attributeLabel, CADASTRE_ATTRIBUTE_LABELS, PLAN_AMENAGEMENT_ATTRIBUTE_LABELS } from '../utils/attributeLabels'
import { t } from '../i18n/index'
import {
  extractRing,
  openGoogleMaps,
  polygonAreaM2,
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

const FILTRE_AMENITY_OSM: Record<string, Record<string, string[]>> = {
  health: { hopital: ['hospital'], clinique: ['clinic', 'doctors'] },
  education: { ecole: ['school', 'prep_school'], lycee: ['school'], universite: ['university'] },
  commerce: { centre_commercial: ['mall'], marche: ['marketplace'] },
  transport: { gare_routiere: ['bus_station'], arret_bus: ['bus_station'] },
  admin: { commune: ['townhall'], poste: ['post_office'], police: ['police'] },
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

const EQUIP_GROUP_MAPPING: Record<string, string> = {
  pharmacy: 'Pharmacie',
  school: 'Éducation',
  kindergarten: 'Éducation',
  prep_school: 'Éducation',
  hospital: 'Santé',
  doctors: 'Santé',
  dentist: 'Santé',
  bank: 'Services financiers',
  money_transfer: 'Services financiers',
  payment_terminal: 'Services financiers',
  atm: 'Services financiers',
  place_of_worship: 'Lieu de culte',
  fuel: 'Services automobiles',
  vehicle_inspection: 'Services automobiles',
  charging_station: 'Services automobiles',
  car_wash: 'Services automobiles',
  police: 'Sécurité et justice',
  courthouse: 'Sécurité et justice',
  post_office: 'Administration',
  cafe: 'Restauration',
  restaurant: 'Restauration',
  fast_food: 'Restauration',
  bar: 'Restauration',
  parking: 'Parking',
  parking_entrance: 'Parking',
  taxi: 'Transport',
  bus_station: 'Transport',
}

const EQUIP_GROUP_SYMBOLS: Record<string, string> = {
  Pharmacie: '<path d="M12 4v16M4 12h16"/>',
  Éducation: '<path d="M12 4l10 4-10 4L2 8z"/><path d="M5 10.5V16c2.5 2.5 9 2.5 14 0v-5.5"/>',
  Santé: '<rect x="6" y="4" width="12" height="16"/><path d="M12 4v16M6 12h12M9 8v8M15 8v8"/>',
  'Services financiers': '<path d="M12 3l9 5H3z"/><path d="M4 8h16v3H4z"/><path d="M6 11v6h12v-6"/><path d="M4 20h16"/>',
  'Lieu de culte': '<path d="M12 3l7 6H5z"/><path d="M5 9h14v12H5z"/><path d="M9 21v-5a3 3 0 0 1 6 0v5"/>',
  'Services automobiles': '<path d="M6 3h8v18H6z"/><path d="M6 9h8"/><path d="M14 12h4v7a1.5 1.5 0 0 1-3 0"/><path d="M18 12l1-1"/><path d="M8 3v3"/>',
  'Sécurité et justice': '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  Administration: '<rect x="4" y="6" width="16" height="12"/><path d="M4 7l8 6 8-6"/>',
  Restauration: '<path d="M7 3v9M4 3v9M5.5 3v9"/><path d="M5.5 12v6"/><path d="M19 3c-2 1-3 4-3 8l-1 7M15 18h5"/>',
  Parking: '<path d="M10 4h4a4 4 0 1 1 0 8h-4V4z"/><path d="M10 12v8"/>',
  Transport: '<rect x="4" y="6" width="16" height="12"/><path d="M4 11h16"/><circle cx="8" cy="15" r="1.5"/><circle cx="16" cy="15" r="1.5"/><path d="M6 18v2M18 18v2"/>',
}

const EQUIP_DEFAULT_GROUP = 'Autres équipements'
const EQUIP_DEFAULT_GROUP_SYMBOL = '<circle cx="12" cy="12" r="5"/>'

function equipGroupOf(amenity: string): string {
  return EQUIP_GROUP_MAPPING[amenity] ?? EQUIP_DEFAULT_GROUP
}

const EQUIP_GROUP_SUBTYPES: Record<string, string[]> = {}
Object.entries(EQUIP_GROUP_MAPPING).forEach(([raw, group]) => {
  const list = EQUIP_GROUP_SUBTYPES[group] ?? (EQUIP_GROUP_SUBTYPES[group] = [])
  if (!list.includes(raw)) list.push(raw)
})

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
interface RentaPopupInfo { terrainId?: number; nom?: string; superficie?: number; lat?: number; lng?: number; ref?: string }

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
  const renta = rentaInfo
    ? `<button type="button" class="geo-popup-btn geo-popup-btn--renta" data-action="rentabilite" data-terrain-id="${rentaInfo.terrainId ?? ''}" data-terrain-nom="${escapeHtml(rentaInfo.nom ?? '')}" data-terrain-surf="${rentaInfo.superficie ?? ''}" data-terrain-lat="${rentaInfo.lat ?? ''}" data-terrain-lng="${rentaInfo.lng ?? ''}" data-terrain-ref="${escapeHtml(rentaInfo.ref ?? '')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>Calculer la rentabilité</span></button>`
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

function propsToHtml(props: Record<string, unknown>, labels?: Record<string, string>): string {
  return Object.entries(props)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<div><strong>${escapeHtml(attributeLabel(k, labels))}</strong> : ${escapeHtml(v)}</div>`)
    .join('')
}

type CardMode = 'search' | 'loading' | 'results' | 'terrainList' | 'empty' | 'addTerrain'

function getScoreColor(score: number): string {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#eab308'
  return '#dc2626'
}

function ordinalSuffix(n: number): string {
  if (n === 1) return 'er'
  return 'ᵉ'
}

function collectFilterFiltres(): AnalyseFiltres {
  const f: AnalyseFiltres = {}

  const getChecked = (name: string): string[] =>
    Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map((cb) => cb.value)

  const getDistance = (name: string): string | undefined => {
    const sel = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`)
    if (!sel) return undefined
    if (sel.value === '__custom__') {
      const input = document.querySelector<HTMLInputElement>(`input[name="${name}_custom"]`)
      const v = input?.value.trim()
      return v ? v : undefined
    }
    return sel.value || undefined
  }

  const routes = getChecked('route_type')
  if (routes.length > 0) f.route_type = routes
  f.distance_route = getDistance('distance_route')

  const health = getChecked('health')
  if (health.length > 0) f.health = health
  f.distance_health = getDistance('distance_health')

  const edu = getChecked('education')
  if (edu.length > 0) f.education = edu
  f.distance_education = getDistance('distance_education')

  const commerce = getChecked('commerce')
  if (commerce.length > 0) f.commerce = commerce
  f.distance_commerce = getDistance('distance_commerce')

  const transport = getChecked('transport')
  if (transport.length > 0) f.transport = transport
  f.distance_transport = getDistance('distance_transport')

  const admin = getChecked('admin')
  if (admin.length > 0) f.admin = admin
  f.distance_admin = getDistance('distance_admin')

  const pole = getChecked('pole')
  if (pole.length > 0) f.pole = pole
  f.distance_poles = getDistance('distance_poles')

  const loc = getChecked('localisation')
  if (loc.length > 0) f.localisation = loc

  const pente = getChecked('pente')
  if (pente.length > 0) f.pente = pente

  const denivele = getChecked('denivele')
  if (denivele.length > 0) f.denivele = denivele

  const altitude = getChecked('altitude')
  if (altitude.length > 0) f.altitude = altitude

  return f
}

function hasAnyFilter(f: AnalyseFiltres): boolean {
  return Object.keys(f).length > 0
}

function setupCustomDistances(): void {
  document.querySelectorAll<HTMLSelectElement>('#filter-accordion select[data-custom-input]').forEach((sel) => {
    const inputName = sel.dataset.customInput
    if (!inputName) return
    const input = document.querySelector<HTMLInputElement>(`input[name="${inputName}"]`)
    if (!input) return
    const sync = (): void => {
      input.hidden = sel.value !== '__custom__'
      if (sel.value !== '__custom__') input.value = ''
    }
    sel.addEventListener('change', sync)
    sync()
  })
}

function resetFilterDom(): void {
  document.querySelectorAll<HTMLInputElement>('#filter-accordion input[type="checkbox"]').forEach((cb) => { cb.checked = false })
  document.querySelectorAll<HTMLSelectElement>('#filter-accordion select').forEach((sel) => { sel.selectedIndex = 0 })
  document.querySelectorAll<HTMLInputElement>('#filter-accordion input.geo-distance-input').forEach((inp) => { inp.hidden = true; inp.value = '' })
}

function scoreRow(label: string, score: number, color: string): React.JSX.Element {
  const pct = Math.min(score, 100)
  return (
    <div className="geo-sr-score-row">
      <span className="geo-sr-score-label">{label}</span>
      <div className="geo-sr-score-bar-wrap">
        <div className="geo-sr-score-bar" style={{ width: `${pct}%`, background: color }}></div>
      </div>
      <span className="geo-sr-score-value">{score.toFixed(0)}</span>
    </div>
  )
}

function renderInfoGenerale(tr: AnalyseResultat): React.JSX.Element {
  const info = tr.infos_generales
  return (
    <div className="geo-sr-card">
      <div className="geo-sr-card-header">
        <span className="geo-sr-card-header-icon">{icons.mapPin}</span>
        <h4 className="geo-sr-card-title">{t('ranking.terrain_infos')}</h4>
      </div>
      <div className="geo-sr-card-body">
        <div className="geo-sr-info-grid">
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.terrain_reference')}</span>
            <span className="geo-sr-info-value">{info.reference_cadastrale}</span>
          </div>
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.terrain_commune')}</span>
            <span className="geo-sr-info-value">{info.commune}</span>
          </div>
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.terrain_province')}</span>
            <span className="geo-sr-info-value">{info.province}</span>
          </div>
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.terrain_region')}</span>
            <span className="geo-sr-info-value">{info.region}</span>
          </div>
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.terrain_surface')}</span>
            <span className="geo-sr-info-value">{info.superficie}</span>
          </div>
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.terrain_perimetre')}</span>
            <span className="geo-sr-info-value">{info.perimetre}</span>
          </div>
          <div className="geo-sr-info-item geo-sr-info-item--full">
            <span className="geo-sr-info-label">{t('ranking.terrain_centre')}</span>
            <span className="geo-sr-info-value">{info.latitude.toFixed(6)}, {info.longitude.toFixed(6)}</span>
          </div>
          <div className="geo-sr-info-item geo-sr-info-item--full">
            <span className="geo-sr-info-label">{t('ranking.terrain_zone')}</span>
            <span className="geo-sr-info-value">{info.zone_amenagement}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderDetailCriteres(tr: AnalyseResultat): React.JSX.Element | null {
  if (!tr.criteres || tr.criteres.length === 0) return null
  return (
    <div className="geo-sr-card">
      <div className="geo-sr-card-header">
        <span className="geo-sr-card-header-icon">{icons.layers}</span>
        <h4 className="geo-sr-card-title">{t('ranking.resultats_criteres')}</h4>
      </div>
      {tr.criteres.map((c) => (
        <div className="geo-sr-criteria" key={c.id}>
          <div className="geo-sr-criteria-name">{c.critere}</div>
          <div className="geo-sr-criteria-details">
            <span className="geo-sr-criteria-dt">{t('ranking.critere_demande')}</span>
            <span className="geo-sr-criteria-dd">{c.critere_demande}</span>
            <span className="geo-sr-criteria-dt">{t('ranking.valeur_mesuree')}</span>
            <span className="geo-sr-criteria-dd">{c.valeur_mesuree}</span>
            <span className="geo-sr-criteria-dt">{t('ranking.point_interet')}</span>
            <span className="geo-sr-criteria-dd">{c.point_interet}</span>
          </div>
          <div className={`geo-sr-criteria-status ${c.conforme ? 'geo-sr-criteria-status--ok' : 'geo-sr-criteria-status--ko'}`}>
            {c.conforme ? '✅ ' + t('ranking.conforme') : '❌ ' + t('ranking.non_conforme')}
          </div>
        </div>
      ))}
    </div>
  )
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
    score_accessibilite: r.score_accessibilite ?? 0,
    score_positionnement: r.score_positionnement ?? 0,
    score_topographie: r.score_topographie ?? 0,
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
    classement: r.rang ?? 0,
    points_forts: r.points_forts ?? [],
    points_faibles: r.points_faibles ?? [],
  }
}

function renderScoreSummary(tr: AnalyseResultat): React.JSX.Element {
  return (
    <div className="geo-score-summary">
      <div className="geo-score-summary-item geo-score-summary-item--amc">
        <span className="geo-score-summary-label">{t('ranking.score_amc')}</span>
        <strong className="geo-score-summary-value">{tr.score_amc != null ? tr.score_amc.toFixed(1) : '—'}</strong>
      </div>
      <div className="geo-score-summary-item geo-score-summary-item--renta">
        <span className="geo-score-summary-label">{t('ranking.score_rentabilite')}</span>
        <strong className="geo-score-summary-value">{tr.score_rentabilite != null ? tr.score_rentabilite.toFixed(1) : '—'}</strong>
      </div>
      <div className="geo-score-summary-item geo-score-summary-item--final">
        <span className="geo-score-summary-label">{t('ranking.score_final')}</span>
        <strong className="geo-score-summary-value">{tr.score_final != null ? tr.score_final.toFixed(1) : '—'}</strong>
      </div>
      <div className="geo-score-summary-item geo-score-summary-item--rang">
        <span className="geo-score-summary-label">{t('ranking.rang')}</span>
        <strong className="geo-score-summary-value">#{tr.classement}</strong>
      </div>
      {tr.score_rentabilite == null ? (
        <div className="geo-score-summary-note">{t('ranking.rentabilite_non_disponible')}</div>
      ) : null}
    </div>
  )
}

function renderScores(tr: AnalyseResultat, total: number): React.JSX.Element {
  return (
    <div className="geo-sr-card">
      <div className="geo-sr-card-header">
        <span className="geo-sr-card-header-icon">{icons.ranking}</span>
        <h4 className="geo-sr-card-title">{t('ranking.scores_title')}</h4>
      </div>
      <div className="geo-sr-card-body">
        <div className="geo-sr-scores">
          {scoreRow(t('ranking.score_accessibilite'), tr.score_accessibilite, '#1b3a6e')}
          {scoreRow(t('ranking.score_positionnement'), tr.score_positionnement, '#22c55e')}
          {scoreRow(t('ranking.score_topographie'), tr.score_topographie, '#eab308')}
          {tr.score_superficie != null ? scoreRow(t('ranking.score_superficie'), tr.score_superficie, '#14b8a6') : null}
          <div className="geo-sr-score-separator"></div>
          {scoreRow(t('ranking.score_amc'), tr.score_amc, '#ec4899')}
          {tr.score_rentabilite != null ? scoreRow(t('ranking.score_rentabilite'), tr.score_rentabilite, '#f97316') : null}
          {scoreRow(t('ranking.score_final'), tr.score_final, '#8b5cf6')}
        </div>
        <div className="geo-sr-classement">
          {t('ranking.classement_sur')} : <strong>{tr.classement}<sup>{ordinalSuffix(tr.classement)}</sup></strong> / {total}
        </div>
      </div>
    </div>
  )
}

function renderRentabilite(tr: AnalyseResultat): React.JSX.Element {
  const sourceLabel = {
    personnalisee: t('ranking.rentabilite_personnalisee'),
    benchmark: t('ranking.rentabilite_benchmark'),
    indisponible: t('ranking.rentabilite_indisponible'),
  }[tr.type_rentabilite]
  return (
    <div className="geo-sr-card">
      <div className="geo-sr-card-header">
        <span className="geo-sr-card-header-icon">{icons.euro}</span>
        <h4 className="geo-sr-card-title">{t('ranking.rentabilite')}</h4>
      </div>
      <div className="geo-sr-card-body">
        <div className="geo-sr-info-grid">
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.roi')}</span>
            <span className="geo-sr-info-value">{tr.roi != null ? `${tr.roi.toFixed(1)} %` : '—'}</span>
          </div>
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.score_rentabilite')}</span>
            <span className="geo-sr-info-value">{tr.score_rentabilite != null ? `${tr.score_rentabilite.toFixed(1)}/100` : '—'}</span>
          </div>
          <div className="geo-sr-info-item">
            <span className="geo-sr-info-label">{t('ranking.prix_terrain')}</span>
            <span className="geo-sr-info-value">{tr.prix_terrain != null ? `${Number(tr.prix_terrain).toLocaleString()} DH` : '—'}</span>
          </div>
          <div className="geo-sr-info-item geo-sr-info-item--full">
            <span className="geo-sr-info-label">{t('ranking.source')}</span>
            <span className="geo-sr-info-value">{sourceLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderConclusion(tr: AnalyseResultat): React.JSX.Element {
  const s = tr.criteres_satisfaits
  const totalCriteres = tr.criteres_total
  return (
    <div className="geo-sr-card">
      <div className="geo-sr-card-header">
        <span className="geo-sr-card-header-icon">{icons.search}</span>
        <h4 className="geo-sr-card-title">{t('ranking.conclusion_title')}</h4>
      </div>
      <div className="geo-sr-conclusion">
        <p className="geo-sr-conclusion-text">{t('ranking.conclusion_conforme').replace('{s}', String(s)).replace('{t}', String(totalCriteres))}</p>
        {tr.points_forts.length > 0 ? (
          <>
            <p className="geo-sr-conclusion-sub">{t('ranking.points_forts')}</p>
            <ul className="geo-sr-conclusion-list geo-sr-conclusion-list--forts">
              {tr.points_forts.map((pf) => <li key={pf}>{pf.charAt(0).toUpperCase() + pf.slice(1)}</li>)}
            </ul>
          </>
        ) : null}
        {tr.points_faibles.length > 0 ? (
          <>
            <p className="geo-sr-conclusion-sub">{t('ranking.points_faibles')}</p>
            <ul className="geo-sr-conclusion-list geo-sr-conclusion-list--faibles">
              {tr.points_faibles.map((pf) => <li key={pf}>{pf.charAt(0).toUpperCase() + pf.slice(1)}</li>)}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  )
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
  const [cardError, setCardError] = useState<string | null>(null)
  const [coord, setCoord] = useState('Lat: — , Lng: —')
  const [layersPopupOpen, setLayersPopupOpen] = useState(false)
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [basemapId, setBasemapId] = useState<string>(BASEMAPS[0].id)
  const [overlays, setOverlays] = useState<Record<string, boolean>>({})
  const [openSections, setOpenSections] = useState<string[]>(['accessibilite'])
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSavedBanner, setShowSavedBanner] = useState(false)
  const [cadastreQuery, setCadastreQuery] = useState('')
  const [coucheCounts, setCoucheCounts] = useState<Record<string, number>>({})

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const currentLayerRef = useRef<any>(null)
  const analyzePendingRef = useRef(false)
  const selectedTerrainIdRef = useRef<number | null>(null)
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
  const accordionContentRefs = useRef<Record<string, HTMLDivElement | null>>({})
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

  const [rentaTerrainId, setRentaTerrainId] = useState<number | null>(null)
  const [rentaTerrainNom, setRentaTerrainNom] = useState('')
  const [rentaParcelInfo, setRentaParcelInfo] = useState<{ nom: string; superficie: number; lat: number; lng: number; ref?: string } | null>(null)
  const [rentaForm, setRentaForm] = useState({
    prixFoncierM2: '', fraisAcquisition: '7', tauxChute: '30',
    cos: '', cus: '',
    hasAppartement: true, hasCommerce: false, hasBureau: false,
    quotePartApp: '100', quotePartCommerce: '0', quotePartBureau: '0',
    prixVenteApp: '', prixVenteCommerce: '', prixVenteBureau: '',
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

  useEffect(() => {
    if (!rentaModalOpen || !projetId) return
    let cancelled = false
    void fetchTerrains(projetId, { page_size: 100 })
      .then((data) => { if (!cancelled) setRentaTerrains(data.results) })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [rentaModalOpen, projetId])
  
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
      setRentaTerrainId(tid ? Number(tid) : null)
      setRentaTerrainNom(tnom)
      setRentaParcelInfo({
        nom: tnom,
        superficie: tsurf ? Number(tsurf) : Number(projet?.surface_souhaitee ?? 0),
        lat: tlat ? Number(tlat) : 0,
        lng: tlng ? Number(tlng) : 0,
        ref: tref,
      })
      setRentaResult(null)
      setRentaError(null)
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
      quote_part_appartement: numRenta(rentaForm.quotePartApp),
      quote_part_commerce: numRenta(rentaForm.quotePartCommerce),
      quote_part_bureau: numRenta(rentaForm.quotePartBureau),
      prix_vente_appartement: numRenta(rentaForm.prixVenteApp),
      prix_vente_commerce: numRenta(rentaForm.prixVenteCommerce),
      prix_vente_bureau: numRenta(rentaForm.prixVenteBureau),
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
      const info = pieces.length === 0
        ? '<div class="geoportal-popup-warn">Aucune affectation trouvée pour cette parcelle dans le plan d\'aménagement.</div>'
        : `<div class="geoportal-popup-affcount">${pieces.length} affectation${pieces.length > 1 ? 's' : ''} détectée${pieces.length > 1 ? 's' : ''}</div>`
      popup.setContent(
        `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(title)}</div>` +
        `${info}` +
        `<div class="geoportal-popup-coords">${propsToHtml(cadFeat.properties, CADASTRE_ATTRIBUTE_LABELS)}</div>` +
        `${buildPopupActions(center.lat, center.lng, ring, title, { idParcelle, computed: pieces.length > 0 })}</div>`
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
    ;(['health', 'education', 'commerce', 'transport', 'admin'] as const).forEach((group) => {
      const values = f[group]
      if (!values) return
      values.forEach((val) => {
        ;(FILTRE_AMENITY_OSM[group]?.[val] ?? []).forEach((osm) => {
          if (equipCouche) toggles[`${equipCouche.id}:${equipGroupOf(osm)}`] = true
        })
      })
    })
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

    setupCustomDistances()

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
        setCouchesDispo(list.filter((c) => c.nom === 'cadastre' || c.nom === 'reseau_routier' || c.nom === 'equipements_publics' || c.nom === 'plan_amenagement'))
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
          const attrKey = c.nom === 'reseau_routier' ? 'highway' : 'amenity'
          if (c.nom === 'reseau_routier') {
            const counts = new Map<string, number>()
            collection.features.forEach((f) => {
              const v = String(f.properties?.[attrKey] ?? 'autre')
              counts.set(v, (counts.get(v) ?? 0) + 1)
            })
            const items = Array.from(counts.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => ({ key: `${c.id}:${type}`, coucheId: c.id, type, count }))
            routes.push(...items)
          } else {
            const groupCounts = new Map<string, { count: number; subTypes: string[] }>()
            collection.features.forEach((f) => {
              const raw = String(f.properties?.[attrKey] ?? 'autre')
              const group = equipGroupOf(raw)
              const entry = groupCounts.get(group) ?? { count: 0, subTypes: [] }
              entry.count++
              if (!entry.subTypes.includes(raw)) entry.subTypes.push(raw)
              groupCounts.set(group, entry)
            })
            const items = Array.from(groupCounts.entries())
              .sort((a, b) => b[1].count - a[1].count)
              .map(([group, { count }]) => ({ key: `${c.id}:${group}`, coucheId: c.id, type: group, count }))
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
    const symbol = EQUIP_GROUP_SYMBOLS[type] ?? EQUIP_DEFAULT_GROUP_SYMBOL
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
          layerItem.bindPopup(
            `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(label)}</div><div class="geoportal-popup-coords">${propsToHtml(feature.properties)}</div>${buildPopupActions(c ? c[1] : NaN, c ? c[0] : NaN)}</div>`,
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
          layerItem.bindPopup(
            `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(idParcelle)}</div><div class="geoportal-popup-coords">${propsToHtml(feature.properties, CADASTRE_ATTRIBUTE_LABELS)}</div>${buildPopupActions(center.lat, center.lng, ring, idParcelle, num ? affOpts : null)}</div>`,
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
    const color = getScoreColor(tr.score_final)
    const rentaRow = tr.score_rentabilite != null
      ? `<div class="geoportal-popup-row"><span>${t('ranking.rentabilite')}</span><strong>${tr.score_rentabilite.toFixed(1)}/100</strong></div>`
      : ''
    const center = ring ? ringCenter(ring) : { lat: NaN, lng: NaN }
    const title = p.num != null ? `Parcelle ${p.num}` : tr.nom
    const num = p.num != null ? String(p.num) : ''
    const affOpts: PopupAffectationsOpts | null = num !== ''
      ? { idParcelle: num, computed: affectationsResultRef.current?.terrainNum === num }
      : null
    return `<div class="geoportal-popup">
        <div class="geoportal-popup-title">${escapeHtml(tr.nom)}</div>
        <div class="geoportal-popup-classement">
          <span class="geoportal-popup-badge" style="background:${color}">${tr.score_final.toFixed(1)}/100</span>
          <span class="geoportal-popup-rank">${t('ranking.classement_sur')} <strong>${tr.classement}${ordinalSuffix(tr.classement)}</strong></span>
        </div>
        <div class="geoportal-popup-scores">
          <div class="geoportal-popup-row"><span>${t('ranking.score_amc')}</span><strong>${tr.score_amc.toFixed(1)}/100</strong></div>
          ${rentaRow}
        </div>
        <div class="geoportal-popup-coords">${propsToHtml(p, CADASTRE_ATTRIBUTE_LABELS)}</div>
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
      const color = getScoreColor(tr.score_global)
      l.setStyle({
        color,
        weight: isSel ? 4 : 1.6,
        opacity: isSel ? 1 : 0.9,
        fillColor: color,
        fillOpacity: isSel ? 0.6 : 0.4,
      })
      l.bindPopup(buildParcellePopup(tr, props, extractRing(l.feature?.geometry), undefined), { autoPan: false })
    })
  }

  const fitToParcelle = (tr: AnalyseResultat): void => {
    const layer = cadastreLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return
    const ref = tr.infos_generales?.reference_cadastrale
    layer.eachLayer((l: any) => {
      const idP = l.feature?.properties?.num
      if (idP != null && String(idP) === String(ref)) {
        overlayFlyToBounds(map, l.getBounds().pad(0.2), { duration: 0.8, easeLinearity: 0.25, maxZoom: 19 })
      }
    })
  }

  const cadastreParcelPopup = (props: Record<string, unknown>, ring?: number[][] | null): string => {
    const idParcelle = props.num ? `Parcelle ${props.num}` : 'Parcelle cadastrale'
    const center = ring ? ringCenter(ring) : { lat: NaN, lng: NaN }
    const num = props.num != null ? String(props.num) : ''
    const affOpts: PopupAffectationsOpts | null = num !== ''
      ? { idParcelle: num, computed: affectationsResultRef.current?.terrainNum === num }
      : null
    return `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(idParcelle)}</div><div class="geoportal-popup-coords">${propsToHtml(props, CADASTRE_ATTRIBUTE_LABELS)}</div>${buildPopupActions(center.lat, center.lng, ring, idParcelle, affOpts)}</div>`
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
        const attrKey = couche?.nom === 'reseau_routier' ? 'highway' : 'amenity'
        const subTypes = isEquip ? (EQUIP_GROUP_SUBTYPES[type] ?? [type]) : [type]
        const features = fc.features.filter((f) => subTypes.includes(String(f.properties?.[attrKey] ?? 'autre')))
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
    if (!projet) return
    Object.entries(accordionContentRefs.current).forEach(([section, el]) => {
      if (!el) return
      el.style.maxHeight = openSections.includes(section) ? `${el.scrollHeight}px` : '0'
    })
  }, [openSections, projet])

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

  const toggleAccordion = (section: string): void => {
    setOpenSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  const toggleCoucheSection = (key: string): void => {
    setCoucheSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const selectTerrain = (terrainId: number, opts: { zoom?: boolean } = {}): void => {
    const terrain = analyseResultatsRef.current.find((tr) => tr.id === terrainId)
    if (!terrain) return
    selectedTerrainIdRef.current = terrainId
    colorCadastreParcels(terrainId)
    showTerrainBuffer(terrain)
    setSelectedTerrain(terrain)
    setCardMode('results')
    if (opts.zoom !== false) fitToParcelle(terrain)
  }

  const handleAnalyse = async (): Promise<void> => {
    if (!projetId) return
    const filtres = collectFilterFiltres()
    if (!hasAnyFilter(filtres)) {
      window.alert('Veuillez sélectionner au moins un critère avant de lancer l\'analyse.')
      return
    }
    setCardError(null)
    setCardMode('loading')
    setCardHidden(false)
    try {
      const response = await fetchAnalyse(projetId, filtres)
      analyseResultatsRef.current = response.resultats
      analyseFiltresRef.current = filtres
      setTypeToggles(layersFromFiltres(filtres))

      if (analyseResultatsRef.current.length === 0) {
        setCardMode('empty')
        return
      }

      if (cadastreLayerRef.current) {
        colorCadastreParcels()
        const map = mapRef.current
        if (map) map.fitBounds(cadastreLayerRef.current.getBounds().pad(0.08))
      } else {
        analyzePendingRef.current = true
      }
      setCadastreEnabled(true)
      setCardMode('terrainList')
    } catch (err) {
      setCardError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSaveClassement = async (): Promise<void> => {
    if (!projetId || analyseResultatsRef.current.length === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await createAnalyse(projetId, collectFilterFiltres())
      setSavedAnalyse(saved)
      setShowSavedBanner(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleModifyCriteria = (): void => {
    setCardMode('search')
    setCardError(null)
  }

  const handleResetFilters = (): void => {
    resetFilterDom()
    setOpenSections(['accessibilite'])
    setTypeToggles({})
    setCoucheSectionsOpen({ routes: true, equipements: true })
    setCadastreEnabled(false)
    setPaEnabled(false)
    setCadastreQuery('')
    setSelectedTerrain(null)
    setCardMode('search')
    setCardHidden(false)
    setCardError(null)
    setCoord('Lat: — , Lng: —')
    setSavedAnalyse(null)
    setSaveError(null)
    setShowSavedBanner(false)
    setSaving(false)
    analyseResultatsRef.current = []
    analyseFiltresRef.current = null
    clearTerrainBuffer()
    clearAffectations()
    selectedTerrainIdRef.current = null
    focusParcelleRef.current = null
    pendingSearchRef.current = null
    searchParcelleRef.current = null
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

  if (projetError) {
    return (
    <DashboardLayout role="investisseur" activePage="ranking" hideSidebar projectContext={projet ? { id: projet.id, name: projet.nom } : null}>
        <div className="admin-error-state">
          <p>{projetError}</p>
          <Link to="/projets" className="btn btn-primary">{t('projects.error_login')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  if (!projet) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" hideSidebar projectContext={null}>
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>{t('ranking.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  const currentBasemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]
  const cardTitle = cardMode === 'search' ? t('ranking.terrain_info') : cardMode === 'addTerrain' ? t('ranking.add_terrain_title') : cardMode === 'terrainList' ? `Resultats (${analyseResultatsRef.current.length})` : t('ranking.analyse_title')

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

  const toggleTerrainEquipement = (key: string): void => {
    setTerrainForm((f) => {
      const has = f.equipements.includes(key)
      return { ...f, equipements: has ? f.equipements.filter((k) => k !== key) : [...f.equipements, key] }
    })
  }

  return (
    <>
    <DashboardLayout role="investisseur" activePage="ranking" hideSidebar topbarTitle={t('ranking.geoportal_title')} projectContext={projet ? { id: projet.id, name: projet.nom } : null}>
      <div className="geo-layout">
        <div className="geo-body">
          <aside className={`geo-sidebar${sidebarCollapsed ? ' geo-sidebar--collapsed' : ''}`}>
            <div className="geo-sidebar-scroll">
              <div className="geo-sidebar-header">
                <div className="geo-sidebar-header-row">
                  <span className="geo-sidebar-header-icon">{icons.filter}</span>
                  <h2 className="geo-sidebar-title">{t('ranking.filter_title')}</h2>
                </div>
                <p className="geo-sidebar-desc">{t('ranking.filter_desc')}</p>
              </div>

              <div className="geo-accordion" id="filter-accordion">
                <div className={`geo-accordion-item${openSections.includes('accessibilite') ? ' is-open' : ''}`} data-section="accessibilite">
                  <button type="button" className="geo-accordion-trigger" onClick={() => toggleAccordion('accessibilite')}>
                    <span className="geo-accordion-icon geo-accordion-icon--blue">{icons.layers}</span>
                    <span className="geo-accordion-label">{t('ranking.filter_access')}</span>
                    <span className="geo-accordion-chevron">{icons.chevron}</span>
                  </button>
                  <div className="geo-accordion-content" ref={(el) => { accordionContentRefs.current.accessibilite = el }}>
                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_road_type')}</span>
                      {['route_nationale', 'route_regionale', 'route_provinciale', 'route_locale', 'peu_importe'].map((val) => (
                        <label className="geo-checkbox" key={val}>
                          <input type="checkbox" name="route_type" value={val} />
                          <span className="geo-checkbox-mark"></span>
                          <span className="geo-checkbox-label">{t(`ranking.route_type_${val}`)}</span>
                        </label>
                      ))}
                    </div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_max_distance_road')}</span>
                      <select className="geo-select" name="distance_route" data-custom-input="distance_route_custom">
                        <option value="">{t('ranking.filter_any')}</option>
                        <option value="100">100 m</option>
                        <option value="250">250 m</option>
                        <option value="500">500 m</option>
                        <option value="1000">1 km</option>
                        <option value="2000">2 km</option>
                        <option value="__custom__">{t('ranking.distance_custom')}</option>
                      </select>
                      <input type="number" min="1" step="1" className="geo-distance-input geo-distance-input--full" name="distance_route_custom" placeholder={t('ranking.distance_custom_placeholder')} hidden />
                    </div>

                    <div className="geo-filter-divider"></div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_health')}</span>
                      <div className="geo-filter-row">
                        <div className="geo-filter-checks">
                          <label className="geo-checkbox">
                            <input type="checkbox" name="health" value="hopital" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.health_hopital')}</span>
                          </label>
                          <label className="geo-checkbox">
                            <input type="checkbox" name="health" value="clinique" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.health_clinique')}</span>
                          </label>
                        </div>
                        <select className="geo-select" name="distance_health" data-custom-input="distance_health_custom">
                          <option value="500">500 m</option>
                          <option value="1000">1 km</option>
                          <option value="2000">2 km</option>
                          <option value="5000">5 km</option>
                          <option value="__custom__">{t('ranking.distance_custom')}</option>
                        </select>
                        <input type="number" min="1" step="1" className="geo-distance-input" name="distance_health_custom" placeholder={t('ranking.distance_custom_placeholder')} hidden />
                      </div>
                    </div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_education')}</span>
                      <div className="geo-filter-row">
                        <div className="geo-filter-checks">
                          <label className="geo-checkbox">
                            <input type="checkbox" name="education" value="ecole" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.edu_ecole')}</span>
                          </label>
                          <label className="geo-checkbox">
                            <input type="checkbox" name="education" value="lycee" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.edu_lycee')}</span>
                          </label>
                          <label className="geo-checkbox">
                            <input type="checkbox" name="education" value="universite" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.edu_universite')}</span>
                          </label>
                        </div>
                        <select className="geo-select" name="distance_education" data-custom-input="distance_education_custom">
                          <option value="500">500 m</option>
                          <option value="1000">1 km</option>
                          <option value="2000">2 km</option>
                          <option value="5000">5 km</option>
                          <option value="__custom__">{t('ranking.distance_custom')}</option>
                        </select>
                        <input type="number" min="1" step="1" className="geo-distance-input" name="distance_education_custom" placeholder={t('ranking.distance_custom_placeholder')} hidden />
                      </div>
                    </div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_commerce')}</span>
                      <div className="geo-filter-row">
                        <div className="geo-filter-checks">
                          <label className="geo-checkbox">
                            <input type="checkbox" name="commerce" value="centre_commercial" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.commerce_centre')}</span>
                          </label>
                          <label className="geo-checkbox">
                            <input type="checkbox" name="commerce" value="marche" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.commerce_marche')}</span>
                          </label>
                        </div>
                        <select className="geo-select" name="distance_commerce" data-custom-input="distance_commerce_custom">
                          <option value="500">500 m</option>
                          <option value="1000">1 km</option>
                          <option value="2000">2 km</option>
                          <option value="5000">5 km</option>
                          <option value="__custom__">{t('ranking.distance_custom')}</option>
                        </select>
                        <input type="number" min="1" step="1" className="geo-distance-input" name="distance_commerce_custom" placeholder={t('ranking.distance_custom_placeholder')} hidden />
                      </div>
                    </div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_transport')}</span>
                      <div className="geo-filter-row">
                        <div className="geo-filter-checks">
                          <label className="geo-checkbox">
                            <input type="checkbox" name="transport" value="gare_routiere" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.transport_gare')}</span>
                          </label>
                          <label className="geo-checkbox">
                            <input type="checkbox" name="transport" value="arret_bus" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.transport_bus')}</span>
                          </label>
                        </div>
                        <select className="geo-select" name="distance_transport" data-custom-input="distance_transport_custom">
                          <option value="250">250 m</option>
                          <option value="500">500 m</option>
                          <option value="1000">1 km</option>
                          <option value="__custom__">{t('ranking.distance_custom')}</option>
                        </select>
                        <input type="number" min="1" step="1" className="geo-distance-input" name="distance_transport_custom" placeholder={t('ranking.distance_custom_placeholder')} hidden />
                      </div>
                    </div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_admin')}</span>
                      <div className="geo-filter-row">
                        <div className="geo-filter-checks">
                          <label className="geo-checkbox">
                            <input type="checkbox" name="admin" value="commune" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.admin_commune')}</span>
                          </label>
                          <label className="geo-checkbox">
                            <input type="checkbox" name="admin" value="poste" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.admin_poste')}</span>
                          </label>
                          <label className="geo-checkbox">
                            <input type="checkbox" name="admin" value="police" />
                            <span className="geo-checkbox-mark"></span>
                            <span className="geo-checkbox-label">{t('ranking.admin_police')}</span>
                          </label>
                        </div>
                        <select className="geo-select" name="distance_admin" data-custom-input="distance_admin_custom">
                          <option value="1000">1 km</option>
                          <option value="2000">2 km</option>
                          <option value="5000">5 km</option>
                          <option value="__custom__">{t('ranking.distance_custom')}</option>
                        </select>
                        <input type="number" min="1" step="1" className="geo-distance-input" name="distance_admin_custom" placeholder={t('ranking.distance_custom_placeholder')} hidden />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`geo-accordion-item${openSections.includes('positionnement') ? ' is-open' : ''}`} data-section="positionnement">
                  <button type="button" className="geo-accordion-trigger" onClick={() => toggleAccordion('positionnement')}>
                    <span className="geo-accordion-icon geo-accordion-icon--green">{icons.mapPin}</span>
                    <span className="geo-accordion-label">{t('ranking.filter_position')}</span>
                    <span className="geo-accordion-chevron">{icons.chevron}</span>
                  </button>
                  <div className="geo-accordion-content" ref={(el) => { accordionContentRefs.current.positionnement = el }}>
                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_localisation')}</span>
                      {['centre_ville', 'periurbaine', 'rurale'].map((val) => (
                        <label className="geo-checkbox" key={val}>
                          <input type="checkbox" name="localisation" value={val} />
                          <span className="geo-checkbox-mark"></span>
                          <span className="geo-checkbox-label">{t(`ranking.loc_${val}`)}</span>
                        </label>
                      ))}
                    </div>

                    <div className="geo-filter-divider"></div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_distance_poles')}</span>
                      <div className="geo-poles-grid">
                        {['pole_centre', 'pole_industriel', 'pole_commercial', 'pole_gare', 'pole_port', 'pole_aeroport'].map((val) => (
                          <div className="geo-pole-item" key={val}>
                            <label className="geo-checkbox">
                              <input type="checkbox" name="pole" value={val} />
                              <span className="geo-checkbox-mark"></span>
                              <span className="geo-checkbox-label">{t(`ranking.${val}`)}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                      <select className="geo-select geo-select--full" name="distance_poles" data-custom-input="distance_poles_custom">
                        <option value="1000">1 km</option>
                        <option value="2000">2 km</option>
                        <option value="5000">5 km</option>
                        <option value="10000">10 km</option>
                        <option value="__custom__">{t('ranking.distance_custom')}</option>
                      </select>
                      <input type="number" min="1" step="1" className="geo-distance-input geo-distance-input--full" name="distance_poles_custom" placeholder={t('ranking.distance_custom_placeholder')} hidden />
                    </div>

                    <div className="geo-filter-divider"></div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_situation_admin')}</span>
                      {['interieur_perimetre', 'exterieur_perimetre'].map((val) => (
                        <label className="geo-checkbox" key={val}>
                          <input type="checkbox" name="situation_admin" value={val} />
                          <span className="geo-checkbox-mark"></span>
                          <span className="geo-checkbox-label">{t(`ranking.situation_${val}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`geo-accordion-item${openSections.includes('topographie') ? ' is-open' : ''}`} data-section="topographie">
                  <button type="button" className="geo-accordion-trigger" onClick={() => toggleAccordion('topographie')}>
                    <span className="geo-accordion-icon geo-accordion-icon--amber">{icons.ranking}</span>
                    <span className="geo-accordion-label">{t('ranking.filter_topo')}</span>
                    <span className="geo-accordion-chevron">{icons.chevron}</span>
                  </button>
                  <div className="geo-accordion-content" ref={(el) => { accordionContentRefs.current.topographie = el }}>
                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_pente')}</span>
                      {['0_5', '5_10', '10_15', 'gt15'].map((val) => (
                        <label className="geo-checkbox" key={val}>
                          <input type="checkbox" name="pente" value={val} />
                          <span className="geo-checkbox-mark"></span>
                          <span className="geo-checkbox-label">{t(`ranking.pente_${val}`)}</span>
                        </label>
                      ))}
                    </div>

                    <div className="geo-filter-divider"></div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_denivele')}</span>
                      {['lt5', '5_20', 'gt20'].map((val) => (
                        <label className="geo-checkbox" key={val}>
                          <input type="checkbox" name="denivele" value={val} />
                          <span className="geo-checkbox-mark"></span>
                          <span className="geo-checkbox-label">{t(`ranking.denivele_${val}`)}</span>
                        </label>
                      ))}
                    </div>

                    <div className="geo-filter-divider"></div>

                    <div className="geo-filter-group">
                      <span className="geo-filter-group-title">{t('ranking.filter_altitude')}</span>
                      {['any', 'lt100', '100_300', 'gt300'].map((val) => (
                        <label className="geo-checkbox" key={val}>
                          <input type="checkbox" name="altitude" value={val} />
                          <span className="geo-checkbox-mark"></span>
                          <span className="geo-checkbox-label">{t(`ranking.altitude_${val}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="geo-sidebar-footer">
              <button type="button" className="btn geo-btn-reset" id="filter-reset" onClick={handleResetFilters}>
                {icons.close} {t('ranking.reset_filters')}
              </button>
              {savedAnalyse ? (
                <>
                  <button type="button" className="btn geo-btn-analyze geo-btn-modify" id="filter-modify" onClick={handleModifyCriteria}>
                    {icons.chevron} {t('ranking.modify_criteria')}
                  </button>
                  <Link to={`/projets/${projetId}/classement`} className="btn btn-primary geo-btn-analyze" id="filter-view">
                    {icons.ranking} {t('ranking.view_classement')}
                  </Link>
                </>
              ) : cardMode === 'results' ? (
                <button type="button" className="btn btn-primary geo-btn-analyze" id="filter-save" onClick={() => { void handleSaveClassement() }} disabled={saving}>
                  {saving ? '…' : '✓'} {saving ? t('ranking.save_loading') : t('ranking.save_classement')}
                </button>
              ) : (
                <button type="button" className="btn btn-primary geo-btn-analyze" id="filter-analyze" onClick={() => { void handleAnalyse() }} disabled={cardMode === 'loading'}>
                  {icons.search} {t('ranking.run_analysis')}
                </button>
              )}
              {saveError ? (
                <div className="geo-save-banner geo-save-banner--error">{saveError}</div>
              ) : savedAnalyse && showSavedBanner ? (
                <div className="geo-save-banner geo-save-banner--ok">
                  ✓ {t('ranking.analyse_saved')}
                </div>
              ) : null}
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
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: EQUIP_GROUP_SYMBOLS[et.type] ?? EQUIP_DEFAULT_GROUP_SYMBOL }} />
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
                          setCardHidden(false)
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
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: EQUIP_GROUP_SYMBOLS[et.type] ?? EQUIP_DEFAULT_GROUP_SYMBOL }} />
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

                <div className={`geo-terrain-card${cardHidden ? ' geo-terrain-card--hidden' : ''}${cardMode === 'addTerrain' ? ' geo-terrain-card--add' : ''}`} id="terrain-card">
                  <div className="geo-terrain-card-header">
                    <h3 id="card-title">{cardTitle}</h3>
                    <div className="geo-card-header-actions">
                      <button type="button" className="geo-card-back" id="card-back-btn" hidden={cardMode === 'search' || cardMode === 'terrainList'} onClick={() => { if (cardMode === 'results') { setCardMode('terrainList'); setSelectedTerrain(null) } else if (cardMode === 'addTerrain') { setCardMode('search'); setCardHidden(true) } else { setCardMode('search') } }}>{icons.chevronLeft}</button>
                      <button type="button" className="geo-terrain-card-close" id="terrain-card-toggle" onClick={closeTerrainCard}>
                        {icons.close}
                      </button>
                    </div>
                  </div>
                  <div className="geo-terrain-card-body" id="card-body">
                    <div className="geo-card-results" id="card-results">
                      {cardError ? (
                        <div className="geo-sr-empty"><p>{cardError}</p></div>
                      ) : cardMode === 'addTerrain' ? (
                        <form id="terrain-form" className="admin-modal-form geo-card-add-form" noValidate onSubmit={(e) => { void handleAddTerrain(e) }}>
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

                          {equipTypes.length > 0 ? (
                            <div className="form-field">
                              <label className="form-label">{t('ranking.field_equipements')}</label>
                              <div className="geo-layers-popup-overlays geo-layers-popup-overlays--scroll geo-terrain-equips">
                                {equipTypes.map((et) => (
                                  <label className="geo-popup-overlay-item" key={et.key}>
                                    <input
                                      type="checkbox"
                                      checked={terrainForm.equipements.includes(et.key)}
                                      onChange={() => toggleTerrainEquipement(et.key)}
                                    />
                                    <span className="geo-couche-type-svg">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: EQUIP_GROUP_SYMBOLS[et.type] ?? EQUIP_DEFAULT_GROUP_SYMBOL }} />
                                    </span>
                                    <span>{et.type} <em className="geo-couche-count">({et.count})</em></span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="admin-modal-actions geo-card-form-actions">
                            <button type="button" className="btn btn-outline" onClick={() => { setCardMode('search'); setCardHidden(true) }}>{t('common.cancel')}</button>
                            <button type="submit" className="btn btn-primary" disabled={savingTerrain}>{savingTerrain ? '…' : icons.save} {t('ranking.save_terrain')}</button>
                          </div>
                        </form>
                      ) : cardMode === 'loading' ? (
                        <div className="geo-sr-loading"><div className="geo-sr-spinner"></div> {t('ranking.analyse_running')}</div>
                      ) : cardMode === 'empty' ? (
                        <div className="geo-sr-empty">
                          <span className="geo-sr-empty-icon">{icons.search}</span>
                          <p className="geo-sr-empty-text">{t('ranking.no_terrains_found')}</p>
                        </div>
                      ) : cardMode === 'terrainList' ? (
                        (() => {
                          const sorted = [...analyseResultatsRef.current].sort((a, b) => {
                            if (b.score_amc !== a.score_amc) return b.score_amc - a.score_amc
                            return b.superficie - a.superficie
                          })
                          return (
                            <div className="geo-terrain-list">
                              {savedAnalyse && showSavedBanner ? (
                                <div className="geo-save-banner geo-save-banner--ok geo-save-banner--card">
                                  ✓ {t('ranking.analyse_saved')}
                                </div>
                              ) : null}
                              <div className="geo-terrain-list-header">
                                <div>
                                  <span className="geo-terrain-list-count">{sorted.length} {sorted.length > 1 ? 'parcelles' : 'parcelle'} classees</span>
                                </div>
                                <button type="button" className="geo-terrain-list-save" disabled={saving || !!savedAnalyse} onClick={() => { void handleSaveClassement() }}>
                                  {saving ? '...' : icons.save} {savedAnalyse ? 'Sauvegarde ✓' : 'Sauvegarder'}
                                </button>
                              </div>
                              {sorted.map((tr, i) => {
                                const color = getScoreColor(tr.score_final)
                                return (
                                  <button
                                    key={tr.id}
                                    type="button"
                                    className="geo-terrain-list-item"
                                    onClick={() => selectTerrain(tr.id)}
                                  >
                                    <div className="geo-terrain-list-rank">
                                      <span className="geo-terrain-list-rank-num" style={{ background: color }}>#{i + 1}</span>
                                    </div>
                                    <div className="geo-terrain-list-info">
                                      <div className="geo-terrain-list-name">{tr.infos_generales.reference_cadastrale || tr.nom}</div>
                                      <div className="geo-terrain-list-meta">
                                        {tr.infos_generales.commune} &middot; {tr.superficie.toLocaleString('fr-FR')} m&sup2;
                                      </div>
                                    </div>
                                    <div className="geo-terrain-list-scores">
                                      <div className="geo-terrain-list-score-item">
                                        <span className="geo-terrain-list-score-label">AMC</span>
                                        <strong>{tr.score_amc.toFixed(1)}</strong>
                                      </div>
                                      <div className="geo-terrain-list-score-item">
                                        <span className="geo-terrain-list-score-label">Score</span>
                                        <strong style={{ color }}>{tr.score_final.toFixed(1)}</strong>
                                      </div>
                                    </div>
                                    <div className="geo-terrain-list-arrow">{icons.chevron}</div>
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })()
                      ) : cardMode === 'results' && selectedTerrain ? (
                        <>
                          {savedAnalyse && showSavedBanner ? (
                            <div className="geo-save-banner geo-save-banner--ok geo-save-banner--card">
                              ✓ {t('ranking.analyse_saved')}
                            </div>
                          ) : null}
                          {renderScoreSummary(selectedTerrain)}
                          {renderInfoGenerale(selectedTerrain)}
                          {renderDetailCriteres(selectedTerrain)}
                          {renderScores(selectedTerrain, analyseResultatsRef.current.length)}
                          {renderRentabilite(selectedTerrain)}
                          {renderConclusion(selectedTerrain)}
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
              <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>{rentaTerrainNom || rentaParcelInfo?.nom || ''}</span>
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
                </div>
              </div>

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
    </>
  )
}

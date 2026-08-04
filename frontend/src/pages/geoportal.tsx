import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { formatApiErrors } from '../api/auth'
import { fetchProjet, type Projet } from '../api/projets'
import { fetchAnalyse, type AnalyseFiltres, type AnalyseResultat } from '../api/terrains'
import { createAnalyse, fetchAnalyseDetail, type AnalyseDetail, type ResultatAnalyse } from '../api/analyses'
import { fetchCouches, fetchCoucheGeoJSON, type Couche, type CoucheFeature, type CoucheFeatureCollection } from '../api/couches'
import { t } from '../i18n/index'

import osmImg from '../assets/features/OSM.png'
import satImg from '../assets/features/osm_sat.jpg'
import topoImg from '../assets/features/osm_topo.jpeg'

const BASEMAPS: { id: string; name: string; url: string; attribution: string; img: string }[] = [
  { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap', img: osmImg },
  { id: 'satellite', name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri', img: satImg },
  { id: 'topo', name: 'Topographique', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap', img: topoImg },
]

const OVERLAY_LAYERS: { id: string; name: string; url: string; attribution: string; opacity: number }[] = [
  { id: 'transport', name: 'Transport', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '&copy; OSM FR', opacity: 0.6 },
  { id: 'dark', name: 'Sombre', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CARTO', opacity: 0.5 },
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
  primary: { color: '#2563eb', weight: 3 },
  secondary: { color: '#16a34a', weight: 2.5 },
  tertiary: { color: '#a16207', weight: 2 },
}

const TEMARA_BOUNDS: [[number, number], [number, number]] = [
  [33.7, -7.1],
  [34.05, -6.75],
]

const CADASTRE_STYLE = { color: '#b45309', weight: 1.4, opacity: 0.9, fillColor: '#f59e0b', fillOpacity: 0.18 }
const CADASTRE_SEARCH_STYLE = { color: '#dc2626', weight: 4, opacity: 1, fillColor: '#ef4444', fillOpacity: 0.45 }

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

const EQUIP_SYMBOLS: Record<string, string> = {
  pharmacy: '<path d="M12 4v16M4 12h16"/>',
  cafe: '<path d="M5 8h13v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z"/><path d="M18 8h1a2 2 0 0 1 0 4h-1"/><path d="M4 20h16"/>',
  restaurant: '<path d="M7 3v9M4 3v9M5.5 3v9"/><path d="M5.5 12v6"/><path d="M19 3c-2 1-3 4-3 8l-1 7M15 18h5"/>',
  fuel: '<path d="M6 3h8v18H6z"/><path d="M6 9h8"/><path d="M14 12h4v7a1.5 1.5 0 0 1-3 0"/><path d="M18 12l1-1"/><path d="M8 3v3"/>',
  place_of_worship: '<path d="M12 3l7 6H5z"/><path d="M5 9h14v12H5z"/><path d="M9 21v-5a3 3 0 0 1 6 0v5"/>',
  fast_food: '<path d="M4 13h16a8 8 0 0 1-16 0z"/><path d="M12 13V5c0-1.5-1-2-1-2"/><path d="M4 16h16"/><path d="M6 19h12"/>',
  bank: '<path d="M12 3l9 5H3z"/><path d="M4 8h16v3H4z"/><path d="M6 11v6h12v-6"/><path d="M4 20h16"/>',
  school: '<path d="M12 4l10 4-10 4L2 8z"/><path d="M5 10.5V16c2.5 2.5 9 2.5 14 0v-5.5"/>',
  post_office: '<rect x="4" y="6" width="16" height="12"/><path d="M4 7l8 6 8-6"/>',
  driving_school: '<path d="M5 10l2-4h10l2 4"/><rect x="3" y="10" width="18" height="8"/><circle cx="8" cy="15" r="1.6"/><circle cx="16" cy="15" r="1.6"/>',
  parking: '<path d="M10 4h4a4 4 0 1 1 0 8h-4V4z"/><path d="M10 12v8"/>',
  taxi: '<path d="M4 11l1-3h14l1 3"/><rect x="3" y="11" width="18" height="7"/><circle cx="8" cy="15" r="1.4"/><circle cx="16" cy="15" r="1.4"/><path d="M6 18v2M18 18v2"/>',
  doctors: '<circle cx="12" cy="7" r="2.5"/><path d="M12 9.5V15"/><path d="M12 15a5 5 0 0 0 5 5h1"/><path d="M12 15a5 5 0 0 1-5 5H6"/>',
  parking_entrance: '<rect x="3" y="6" width="18" height="12"/><path d="M10 4h4a4 4 0 1 1 0 8h-4V4z"/><path d="M10 12v8"/>',
  money_transfer: '<rect x="4" y="7" width="16" height="10"/><circle cx="12" cy="12" r="2.2"/><path d="M4 9l2 2M4 9V7h2M20 15l-2-2M20 15v2h-2"/>',
  bar: '<path d="M5 4h14l-7 8z"/><path d="M12 12v8"/><path d="M8 20h8"/>',
  police: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  kindergarten: '<circle cx="12" cy="7" r="3"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
  dentist: '<path d="M8.5 4C6 4 4 5.5 4 8.5 4 12.5 6 14.5 7 16.5l1 3.5c1.8.5 2.4-1.5 4-1.5s2.2 2 4 1.5l1-3.5c1-2 3-4 3-8C20 5.5 18 4 15.5 4c-1 0-2 .7-3.5.7S9.5 4 8.5 4z"/>',
  atm: '<rect x="4" y="8" width="16" height="10"/><path d="M4 12h16"/><path d="M12 15h.01"/>',
  hospital: '<rect x="6" y="4" width="12" height="16"/><path d="M12 4v16M6 12h12M9 8v8M15 8v8"/>',
  community_centre: '<circle cx="9" cy="8" r="2.5"/><circle cx="16" cy="9" r="2"/><path d="M4 19c0-3 2.5-4 5-4s5 1 5 4"/><path d="M14 15c2.5 0 5 1 5 4"/>',
  car_wash: '<path d="M5 10l2-4h10l2 4"/><rect x="3" y="10" width="18" height="8"/><circle cx="8" cy="15" r="1.5"/><circle cx="16" cy="15" r="1.5"/><path d="M7 20v1M12 20v1M17 20v1"/>',
  internet_cafe: '<rect x="4" y="6" width="16" height="11"/><path d="M12 17v3M8 20h8"/>',
  courthouse: '<path d="M12 3v18M5 21h14"/><path d="M6 6h12"/><path d="M6 6l-3 5M6 6l3 5M18 6l-3 5M18 6l3 5"/>',
  animal_breeding: '<circle cx="8" cy="11" r="2"/><circle cx="16" cy="11" r="2"/><circle cx="12" cy="16" r="2.5"/><circle cx="5" cy="15" r="1.6"/><circle cx="19" cy="15" r="1.6"/>',
  nursing_home: '<path d="M12 20C7 15 4 12 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-3 6-8 11z"/>',
  vehicle_inspection: '<path d="M14 6a4.5 4.5 0 0 0-7 5L3 15a1.6 1.6 0 0 0 2.3 2.3l4-4A4.5 4.5 0 0 0 14 6z"/><path d="M15 4l3 3-1.5 1.5L13.5 5.5z"/>',
  drinking_water: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  payment_terminal: '<rect x="3" y="6" width="18" height="12"/><path d="M6 12h5"/>',
  childcare: '<circle cx="9" cy="9" r="2.5"/><circle cx="16" cy="10" r="2"/><path d="M4 19c.7-3 3-4.5 5-4.5S13 16 14 19"/><path d="M13 16c2.5 0 5 1 6 3"/>',
  water_point: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/><path d="M10 13a2 2 0 0 0 2 2"/>',
  prep_school: '<path d="M4 6h6a2 2 0 0 1 2 2v12c-1-1-3-1-8-1V6z"/><path d="M20 6h-6a2 2 0 0 0-2 2v12c1-1 3-1 8-1V6z"/>',
  charging_station: '<path d="M13 3L5 13h5l-2 8 8-10h-5z"/>',
  bus_station: '<rect x="4" y="6" width="16" height="12"/><path d="M4 11h16"/><circle cx="8" cy="15" r="1.5"/><circle cx="16" cy="15" r="1.5"/><path d="M6 18v2M18 18v2"/>',
  surf_school: '<path d="M6 4c5-2 11 0 13 3-2 4-8 6-13 4l3-7z"/><path d="M5 21c0-3 3-5 7-5s7 2 7 5"/>',
  fountain: '<path d="M12 4v5"/><circle cx="12" cy="3" r="1"/><path d="M5 21h14c-1-3-3-5-7-5s-6 2-7 5z"/><path d="M8 9c1 1 2 1 4 1s3 0 4-1"/>',
  toilets: '<path d="M4 8h6v11H6a2 2 0 0 1-2-2V8z"/><path d="M14 8h6v11h-4a2 2 0 0 1-2-2V8z"/><path d="M5 8l1-4h4l1 4M15 8l1-4h4l1 4"/>',
  hunting_stand: '<circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
  '': '<circle cx="12" cy="12" r="5"/>',
}
const EQUIP_FALLBACK_SYMBOL = '<circle cx="12" cy="12" r="5"/>'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  id_parcelle: 'Identifiant parcelle',
  num_titre_foncier: 'Titre foncier',
  type_immatriculation: 'Immatriculation',
  nature_juridique: 'Nature juridique',
  superficie_m2: 'Superficie (m²)',
  commune: 'Commune',
  cercle: 'Cercle',
  province: 'Province',
  nature_occupation_code: 'Code occupation',
  nature_occupation_libelle: 'Occupation du sol',
  zone_amenagement: "Zone d'aménagement",
  statut_foncier: 'Statut foncier',
  origine: 'Origine',
  reference_plan: 'Référence plan',
  echelle_leve: 'Échelle du levé',
  date_creation: 'Date de création',
  date_derniere_maj: 'Dernière mise à jour',
  full_id: 'Identifiant complet',
  osm_id: 'Identifiant OSM',
  amenity: 'Type d\'équipement',
  highway: 'Type de route',
  name: 'Nom',
  surface: 'Revêtement',
}

function attributeLabel(key: string): string {
  const known = ATTRIBUTE_LABELS[key]
  if (known) return known
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function propsToHtml(props: Record<string, unknown>): string {
  return Object.entries(props)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<div><strong>${escapeHtml(attributeLabel(k))}</strong> : ${escapeHtml(v)}</div>`)
    .join('')
}

type CardMode = 'search' | 'loading' | 'results' | 'empty'

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

function handleResetFilters(): void {
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
          {scoreRow(t('ranking.score_accessibilite'), tr.score_accessibilite, '#3b82f6')}
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
  const [cardHidden, setCardHidden] = useState(false)
  const [cardMode, setCardMode] = useState<CardMode>('search')
  const [selectedTerrain, setSelectedTerrain] = useState<AnalyseResultat | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [coord, setCoord] = useState('Lat: — , Lng: —')
  const [layersPopupOpen, setLayersPopupOpen] = useState(false)
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
  const [savedAnalyse, setSavedAnalyse] = useState<AnalyseDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSavedBanner, setShowSavedBanner] = useState(false)
  const [cadastreQuery, setCadastreQuery] = useState('')
  const [cadastreSearchResults, setCadastreSearchResults] = useState<CoucheFeature[]>([])
  const [cadastreSearchMsg, setCadastreSearchMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [cadastreSearchFocused, setCadastreSearchFocused] = useState<string | null>(null)

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
  const layersBarRef = useRef<HTMLDivElement>(null)
  const accordionContentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingSearchRef = useRef<string | null>(null)
  const searchParcelleRef = useRef<string | null>(null)

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
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.circleMarker([lat, lng], {
          radius: 8, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.8, weight: 2,
        }).addTo(map)
      }
      markerRef.current.bindPopup(
        `<div class="geoportal-popup">
          <div class="geoportal-popup-title">${t('ranking.selected_point')}</div>
          <div class="geoportal-popup-coords">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</div>
        </div>`
      ).openPopup()
      setCoord(`Lat: ${lat.toFixed(6)} , Lng: ${lng.toFixed(6)}`)
    })

    setupCustomDistances()

    return () => {
      map.remove()
      mapRef.current = null
      typeLayersRef.current = {}
    }
  }, [projet])

  useEffect(() => {
    if (!projet) return
    let cancelled = false
    fetchCouches()
      .then((list) => {
        if (cancelled) return
        setCouchesDispo(list.filter((c) => c.nom === 'cadastre' || c.nom === 'reseau_routier' || c.nom === 'equipements_publics'))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [projet])

  useEffect(() => {
    if (couchesDispo.length === 0) return
    let cancelled = false
    Promise.all(couchesDispo.map((c) => fetchCoucheGeoJSON(c.id)))
      .then((collections) => {
        if (cancelled) return
        const routes: CoucheType[] = []
        const equips: CoucheType[] = []
        couchesDispo.forEach((c, i) => {
          coucheDataRef.current[c.id] = collections[i]
          if (c.nom === 'cadastre') setCadastreReady(true)
          if (c.nom !== 'reseau_routier' && c.nom !== 'equipements_publics') return
          const attrKey = c.nom === 'reseau_routier' ? 'highway' : 'amenity'
          const counts = new Map<string, number>()
          collections[i].features.forEach((f) => {
            const v = String(f.properties?.[attrKey] ?? 'autre')
            counts.set(v, (counts.get(v) ?? 0) + 1)
          })
          const items = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => ({ key: `${c.id}:${type}`, coucheId: c.id, type, count }))
          if (c.nom === 'reseau_routier') routes.push(...items)
          else equips.push(...items)
        })
        if (cancelled) return
        setRouteTypes(routes)
        setEquipTypes(equips)
      })
      .catch(() => {})
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
      return L.geoJSON(fc, {
        style: { color: style.color, weight: style.weight, opacity: 0.9, dashArray: style.dashArray },
      }).addTo(map)
    }
    const label = TYPE_LABELS[type] ?? type
    const symbol = EQUIP_SYMBOLS[type] ?? EQUIP_FALLBACK_SYMBOL
    return L.geoJSON(fc, {
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
        if (feature?.properties && Object.keys(feature.properties).length > 0) {
          layerItem.bindPopup(
            `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(label)}</div><div class="geoportal-popup-coords">${propsToHtml(feature.properties)}</div></div>`
          )
        }
      },
    }).addTo(map)
  }

  const buildCadastreLayer = (map: any, fc: CoucheFeatureCollection): any =>
    L.geoJSON(fc, {
      style: CADASTRE_STYLE,
      onEachFeature: (feature: any, layerItem: any) => {
        layerItem.on('click', () => {
          const idP = feature?.properties?.id_parcelle
          if (idP == null) return
          const tr = analyseResultatsRef.current.find(
            (r) => String(r.infos_generales?.reference_cadastrale) === String(idP)
          )
          if (tr) selectTerrain(tr.id)
        })
        if (feature?.properties && Object.keys(feature.properties).length > 0) {
          const p = feature.properties
          const idParcelle = p.id_parcelle ? `Parcelle ${p.id_parcelle}` : 'Parcelle cadastrale'
          layerItem.bindPopup(
            `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(idParcelle)}</div><div class="geoportal-popup-coords">${propsToHtml(feature.properties)}</div></div>`
          )
        }
      },
    }).addTo(map)

  const buildParcellePopup = (tr: AnalyseResultat, p: Record<string, unknown>): string => {
    const color = getScoreColor(tr.score_final)
    const rentaRow = tr.score_rentabilite != null
      ? `<div class="geoportal-popup-row"><span>${t('ranking.rentabilite')}</span><strong>${tr.score_rentabilite.toFixed(1)}/100</strong></div>`
      : ''
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
        <div class="geoportal-popup-coords">${propsToHtml(p)}</div>
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
      const idP = props.id_parcelle
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
      l.bindPopup(buildParcellePopup(tr, props))
    })
  }

  const fitToParcelle = (tr: AnalyseResultat): void => {
    const layer = cadastreLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return
    const ref = tr.infos_generales?.reference_cadastrale
    layer.eachLayer((l: any) => {
      const idP = l.feature?.properties?.id_parcelle
      if (idP != null && String(idP) === String(ref)) {
        map.flyToBounds(l.getBounds().pad(0.4), { duration: 1.2, easeLinearity: 0.25 })
      }
    })
  }

  const cadastreParcelPopup = (props: Record<string, unknown>): string => {
    const idParcelle = props.id_parcelle ? `Parcelle ${props.id_parcelle}` : 'Parcelle cadastrale'
    return `<div class="geoportal-popup"><div class="geoportal-popup-title">${escapeHtml(idParcelle)}</div><div class="geoportal-popup-coords">${propsToHtml(props)}</div></div>`
  }

  const focusCadastreParcelle = (idParcelle: string): void => {
    const layer = cadastreLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return
    searchParcelleRef.current = idParcelle
    setCadastreSearchFocused(idParcelle)
    layer.eachLayer((l: any) => {
      const props = l.feature?.properties as Record<string, unknown> | undefined
      if (!props || props.id_parcelle == null) return
      l.setStyle(CADASTRE_STYLE)
      l.bindPopup(cadastreParcelPopup(props))
    })
    colorCadastreParcels(selectedTerrainIdRef.current ?? undefined)
    layer.eachLayer((l: any) => {
      const props = l.feature?.properties as Record<string, unknown> | undefined
      if (!props || props.id_parcelle == null) return
      if (String(props.id_parcelle) === idParcelle) {
        l.setStyle(CADASTRE_SEARCH_STYLE)
        l.bringToFront()
        map.flyToBounds(l.getBounds().pad(0.4), { duration: 1, easeLinearity: 0.25 })
        l.bindPopup(cadastreParcelPopup(props)).openPopup()
      }
    })
  }

  const focusSearchParcelle = (idParcelle: string): void => {
    const tr = analyseResultatsRef.current.find(
      (r) => String(r.infos_generales?.reference_cadastrale) === idParcelle
    )
    if (tr) {
      selectedTerrainIdRef.current = tr.id
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
      setCadastreSearchMsg({ type: 'error', text: t('ranking.search_ref_empty') })
      setCadastreSearchResults([])
      return
    }
    const cadastreId = couchesDispo.find((c) => c.nom === 'cadastre')?.id
    const fc = cadastreId != null ? coucheDataRef.current[cadastreId] : undefined
    if (cadastreId == null || !fc) {
      setCadastreSearchMsg({ type: 'error', text: t('ranking.search_ref_unavailable') })
      setCadastreSearchResults([])
      return
    }
    const needle = raw.toUpperCase()
    const exact = fc.features.filter(
      (f) => String(f.properties?.id_parcelle ?? '').toUpperCase() === needle
    )
    const partial = fc.features.filter(
      (f) => String(f.properties?.id_parcelle ?? '').toUpperCase().includes(needle)
    )
    const matches = exact.length > 0 ? exact : partial
    if (matches.length === 0) {
      setCadastreSearchMsg({ type: 'error', text: t('ranking.search_ref_not_found') })
      setCadastreSearchResults([])
      return
    }
    setCadastreSearchResults(matches)
    setCadastreSearchMsg(null)
    const targetId = String(matches[0].properties?.id_parcelle)
    focusSearchParcelle(targetId)
  }

  const handleCadastreSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleCadastreSearch()
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    Object.entries(typeToggles).forEach(([key, checked]) => {
      const existing = typeLayersRef.current[key]
      if (checked && !existing) {
        const [cidStr, type] = key.split(':')
        const id = Number(cidStr)
        const fc = coucheDataRef.current[id]
        if (!fc) return
        const couche = couchesDispo.find((c) => c.id === id)
        const attrKey = couche?.nom === 'reseau_routier' ? 'highway' : 'amenity'
        const features = fc.features.filter((f) => String(f.properties?.[attrKey] ?? 'autre') === type)
        typeLayersRef.current[key] = buildTypeLayer(map, id, type, { type: 'FeatureCollection', features })
      } else if (!checked && existing) {
        map.removeLayer(existing)
        delete typeLayersRef.current[key]
      }
    })
  }, [typeToggles, projet])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const id = couchesDispo.find((c) => c.nom === 'cadastre')?.id
    if (!id) return
    if (cadastreEnabled && !cadastreLayerRef.current) {
      const fc = coucheDataRef.current[id]
      if (!fc) return
      cadastreLayerRef.current = buildCadastreLayer(map, fc)
      if (analyseResultatsRef.current.length > 0) {
        colorCadastreParcels(selectedTerrainIdRef.current ?? analyseResultatsRef.current[0]?.id)
        const focusId = focusParcelleRef.current
        if (focusId != null) {
          const focus = analyseResultatsRef.current.find((tr) => tr.id === focusId)
          if (focus) fitToParcelle(focus)
          focusParcelleRef.current = null
        }
        if (analyzePendingRef.current) {
          analyzePendingRef.current = false
          map.fitBounds(cadastreLayerRef.current.getBounds().pad(0.08))
        }
      }
      const pendingSearch = pendingSearchRef.current
      if (pendingSearch != null) {
        pendingSearchRef.current = null
        focusCadastreParcelle(pendingSearch)
      }
    } else if (!cadastreEnabled && cadastreLayerRef.current) {
      map.removeLayer(cadastreLayerRef.current)
      cadastreLayerRef.current = null
    }
  }, [cadastreEnabled, cadastreReady, couchesDispo, projet])

  useEffect(() => {
    if (!projet) return
    const params = new URLSearchParams(window.location.search)
    const analyseId = params.get('analyse')
    if (!analyseId) return
    setCardMode('loading')
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
        const target = parcelle
          ? mapped.find((m) => m.infos_generales.reference_cadastrale === parcelle)
          : mapped[0]
        const selected = target ?? mapped[0]
        selectedTerrainIdRef.current = selected.id
        focusParcelleRef.current = selected.id
        setSelectedTerrain(selected)
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
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [layersPopupOpen])

  const toggleAccordion = (section: string): void => {
    setOpenSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  const toggleCoucheSection = (key: string): void => {
    setCoucheSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const selectTerrain = (terrainId: number): void => {
    const terrain = analyseResultatsRef.current.find((tr) => tr.id === terrainId)
    if (!terrain) return
    selectedTerrainIdRef.current = terrainId
    colorCadastreParcels(terrainId)
    setSelectedTerrain(terrain)
    setCardMode('results')
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
    try {
      const response = await fetchAnalyse(projetId, filtres)
      analyseResultatsRef.current = response.resultats

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
      selectTerrain(analyseResultatsRef.current[0].id)
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

  if (projetError) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" hideSidebar topbarTitle={t('ranking.geoportal_title')}>
        <div className="admin-error-state">
          <p>{projetError}</p>
          <Link to="/projets" className="btn btn-primary">{t('projects.error_login')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  if (!projet) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" hideSidebar topbarTitle={t('ranking.geoportal_title')}>
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>{t('ranking.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  const currentBasemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]
  const cardTitle = cardMode === 'search' ? t('ranking.terrain_info') : t('ranking.analyse_title')

  return (
    <DashboardLayout role="investisseur" activePage="ranking" hideSidebar topbarTitle={t('ranking.geoportal_title')}>
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
                <div className="geo-coord-display" id="coord-display">{coord}</div>

                <div className="geo-map-layers-bar" id="layers-bar" ref={layersBarRef}>
                  <div className="geo-layers-trigger" id="layers-trigger">
                    <button
                      type="button"
                      className="geo-basemap-btn geo-basemap-btn--active"
                      data-basemap={currentBasemap.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setLayersPopupOpen((v) => !v)
                      }}
                    >
                      <img className="geo-basemap-btn-img" src={currentBasemap.img} alt={currentBasemap.name} />
                      <span className="geo-basemap-btn-label">{currentBasemap.name}</span>
                      <span className="geo-basemap-chevron">{icons.chevron}</span>
                    </button>
                  </div>
                  <div className={`geo-layers-popup${layersPopupOpen ? ' geo-layers-popup--open' : ''}`} id="layers-popup">
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
                              setLayersPopupOpen(false)
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
                    <div className="geo-layers-popup-divider"></div>
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
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: EQUIP_SYMBOLS[et.type] ?? EQUIP_FALLBACK_SYMBOL }} />
                                    </span>
                                    <span>{TYPE_LABELS[et.type] ?? et.type} <em className="geo-couche-count">({et.count})</em></span>
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

                <button
                  type="button"
                  className={`geo-fab geo-fab-sidebar${sidebarCollapsed ? '' : ' geo-fab--active'}`}
                  id="sidebar-toggle"
                  title={t('ranking.filter_title')}
                  onClick={() => setSidebarCollapsed((v) => !v)}
                >
                  {icons.menu}
                </button>

                <div className={`geo-terrain-card${cardHidden ? ' geo-terrain-card--hidden' : ''}`} id="terrain-card">
                  <div className="geo-terrain-card-header">
                    <h3 id="card-title">{cardTitle}</h3>
                    <div className="geo-card-header-actions">
                      <button type="button" className="geo-card-back" id="card-back-btn" hidden={cardMode === 'search'} onClick={() => setCardMode('search')}>{icons.chevronLeft}</button>
                      <button type="button" className="geo-terrain-card-close" id="terrain-card-toggle" onClick={() => setCardHidden(true)}>
                        {icons.close}
                      </button>
                    </div>
                  </div>
                  <div className="geo-terrain-card-body" id="card-body">
                    <div className="geo-card-search-section">
                      <div className="geo-field">
                        <label className="geo-field-label" htmlFor="terrain-search">{t('ranking.search_terrain')}</label>
                        <input
                          type="search"
                          id="terrain-search"
                          className="geo-field-input"
                          placeholder={t('ranking.search_ref_placeholder')}
                          value={cadastreQuery}
                          onChange={(e) => setCadastreQuery(e.target.value)}
                          onKeyDown={handleCadastreSearchEnter}
                        />
                      </div>
                      <button type="button" className="btn btn-primary geo-card-btn" id="search-terrain-btn" onClick={handleCadastreSearch}>
                        {icons.search} {t('ranking.search_btn')}
                      </button>
                      {cadastreSearchMsg ? (
                        <div className={`geo-cadastre-search-msg${cadastreSearchMsg.type === 'error' ? ' geo-cadastre-search-msg--error' : ''}`}>
                          {cadastreSearchMsg.text}
                        </div>
                      ) : null}
                      {cadastreSearchResults.length > 0 ? (
                        <div className="geo-cadastre-search-results">
                          <div className="geo-cadastre-search-results-title">
                            {cadastreSearchResults.length === 1
                              ? t('ranking.search_ref_single')
                              : t('ranking.search_ref_multi').replace('{n}', String(cadastreSearchResults.length))}
                          </div>
                          <ul className="geo-cadastre-search-list">
                            {cadastreSearchResults.map((f) => {
                              const p = f.properties
                              const idP = String(p?.id_parcelle ?? '')
                              const commune = String(p?.commune ?? '—')
                              const surface = p?.superficie_m2 != null ? `${Number(p.superficie_m2).toLocaleString()} m²` : '—'
                              const isFocused = cadastreSearchFocused === idP
                              return (
                                <li key={idP}>
                                  <button
                                    type="button"
                                    className={`geo-cadastre-search-item${isFocused ? ' geo-cadastre-search-item--active' : ''}`}
                                    onClick={() => focusSearchParcelle(idP)}
                                  >
                                    <span className="geo-cadastre-search-item-ref">{idP || '—'}</span>
                                    <span className="geo-cadastre-search-item-meta">{commune} · {surface}</span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                    <div className="geo-card-divider"></div>
                    <div className="geo-card-results" id="card-results">
                      {cardError ? (
                        <div className="geo-sr-empty"><p>{cardError}</p></div>
                      ) : cardMode === 'loading' ? (
                        <div className="geo-sr-loading"><div className="geo-sr-spinner"></div> {t('ranking.analyse_running')}</div>
                      ) : cardMode === 'empty' ? (
                        <div className="geo-sr-empty">
                          <span className="geo-sr-empty-icon">{icons.search}</span>
                          <p className="geo-sr-empty-text">{t('ranking.no_terrains_found')}</p>
                        </div>
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
                  onClick={() => setCardHidden(false)}
                >
                  {icons.building}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

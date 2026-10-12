import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import area from '@turf/area'
import centroid from '@turf/centroid'
import { fetchCouches, fetchCoucheGeoJSON, type CoucheFeatureCollection } from '../api/couches'
import { attributeLabel, CADASTRE_ATTRIBUTE_LABELS, formatParcelleRef } from '../utils/attributeLabels'
import { t } from '../i18n/index'
import { extractRing } from '../utils/terrainDims'
import { buildLimiteMask, clipRingToLimite, libelleLimite, type LimiteMask } from '../utils/limitesAdmin'

export type TerrainGeomMode = 'cadastre' | 'geojson' | 'manual'

export interface TerrainVertex {
  lat: number
  lng: number
}

export interface TerrainGeom {
  mode: TerrainGeomMode
  vertices: TerrainVertex[]
  geometry: string
  areaM2: number | null
  centroid: { lat: number; lng: number } | null
  source: string
}

// Champs descriptifs du formulaire « Ajouter un terrain » qui peuvent être
// pré-remplis depuis les attributs d'une entité GeoJSON importée.
export interface TerrainImportFields {
  num_parcelle?: string
  indice?: string
  complement?: string
  consistance?: string
}

// Terrain issu d'un import GeoJSON multi-sélection : champs descriptifs + géométrie
// déjà découpée sur la limite administrative.
export interface TerrainImportItem {
  label: string
  fields: TerrainImportFields
  geom: TerrainGeom
}

// Traduction avec valeur de secours si la clé n'existe pas encore dans le dictionnaire i18n.
function tr(key: string, fallback: string): string {
  const v = t(key)
  return v && v !== key ? v : fallback
}

interface TerrainGeometryEditorProps {
  value: TerrainGeom
  onChange: (v: TerrainGeom) => void
  // Features de la couche cadastrale (couche « cadastre » de la plateforme),
  // déjà chargées par la carte principale. Recherche sur `properties.num`.
  cadastre?: CoucheFeatureCollection | null
  // Couche « limites_admin » (limite administrative de référence). Les polygones
  // saisis sont automatiquement découpés sur cette limite.
  limites?: CoucheFeatureCollection | null
  // Appelé lors de l'import d'un GeoJSON avec les attributs descriptifs de
  // l'entité choisie, afin de remplir les champs du formulaire parent.
  onImportFields?: (fields: TerrainImportFields) => void
  // Appelé quand l'utilisateur coche PLUSIEURS entités dans l'import GeoJSON
  // (liste vide sinon : une seule entité remplit le formulaire comme avant).
  onImportItems?: (items: TerrainImportItem[]) => void
  /** Carte plus haute + cadrage sur la zone d'étude (modal « Ajouter un terrain »). */
  layout?: 'compact' | 'expanded'
}

const INITIAL_CENTER: [number, number] = [33.97, -6.85]
const BASEMAP_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

// Zoom minimum requis avant de pouvoir placer le premier sommet (Mode 3).
const MIN_DRAW_ZOOM = 17

const CADASTRE_EDITOR_STYLE = { color: '#b45309', weight: 1.3, opacity: 0.9, fillColor: '#f59e0b', fillOpacity: 0.15 }
const CADASTRE_HOVER_STYLE = { color: '#b45309', weight: 2.4, opacity: 1, fillColor: '#f59e0b', fillOpacity: 0.3 }
const CADASTRE_SELECTED_STYLE = { color: '#16a34a', weight: 4, opacity: 1, fillColor: '#16a34a', fillOpacity: 0.45 }
const MANUAL_PATH_STYLE = { color: '#dc2626', weight: 2, fillColor: '#ef4444', fillOpacity: 0.18 }
const MANUAL_PREVIEW_STYLE = { color: '#dc2626', weight: 2, dashArray: '4 4' }
const ZONE_ETUDE_FILL_STYLE = { color: '#1d4ed8', weight: 1, opacity: 0.35, fillColor: '#3b82f6', fillOpacity: 0.12 }
const ADMIN_LIMIT_OUTLINE_STYLE = { color: '#0d9488', weight: 3, opacity: 1, dashArray: '8 6', fillOpacity: 0, fillColor: 'transparent' }

const emptyGeom = (mode: TerrainGeomMode = 'geojson'): TerrainGeom => ({
  mode,
  vertices: [],
  geometry: '',
  areaM2: null,
  centroid: null,
  source: '',
})

function clampLat(v: number): number {
  return Math.min(90, Math.max(-90, v))
}

function clampLng(v: number): number {
  return Math.min(180, Math.max(-180, v))
}

// Normalise une clé d'attribut GeoJSON pour la comparer sans tenir compte de la
// casse, des accents ni des séparateurs (ex: « N°_Parcelle » → «nparcelle »).
function normalizeKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Retourne la première valeur non vide parmi les alias possibles d'un attribut.
function pickField(props: Record<string, unknown> | null | undefined, aliases: string[]): string | undefined {
  if (!props) return undefined
  const wanted = new Set(aliases.map(normalizeKey))
  for (const [key, value] of Object.entries(props)) {
    if (!wanted.has(normalizeKey(key))) continue
    const raw = typeof value === 'string' ? value.trim() : value
    if (raw == null) continue
    const text = String(raw).trim()
    if (text === '' || text === '—' || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') continue
    return text
  }
  return undefined
}

// Extrait les champs du formulaire à partir des attributs d'une entité GeoJSON.
// Les clés couvrent les variantes courantes (cadastre national, exports SIG).
export function extractTerrainImportFields(props: Record<string, unknown> | null | undefined): TerrainImportFields {
  const num = pickField(props, [
    'num',
    'num_parcelle',
    'numero_parcelle',
    'num_titre_foncier',
    'numero_titre_foncier',
    'id_parcelle',
    'ref',
    'reference_cadastrale',
    'parcelle',
  ])
  const indice = pickField(props, ['indice', 'ind', 'sufixe'])
  const complement = pickField(props, ['complement', 'compl', 'complementaire', 'complem'])
  const consistance = pickField(props, ['consistance', 'nature', 'nature_parcelle'])
  const fields: TerrainImportFields = {}
  if (num != null) {
    // Si le numéro contient déjà l'indice (« T17010/R »), on garde le numéro
    // seul et l'indice est renseigné séparément.
    const slash = num.indexOf('/')
    fields.num_parcelle = slash > 0 ? num.slice(0, slash).trim() : num
    if (indice == null && slash > 0 && slash < num.length - 1) {
      const fromNum = num.slice(slash + 1).trim()
      if (fromNum) fields.indice = fromNum
    }
  }
  if (indice != null) fields.indice = indice
  if (complement != null) fields.complement = complement
  if (consistance != null) fields.consistance = consistance
  return fields
}

// Arrondit une coordonnée à 6 décimales, précision du champ `lat`/`lng` du
// modèle Terrain. Indispensable : les flottants renvoyés par turf (ex:
// 33.93755735251871) font 17 chiffres et sont rejetés par l'API
// (DecimalField max_digits=9, decimal_places=6).
function roundCoord(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? Number(n.toFixed(6)) : 0
}

// Centroïde d'un polygone GeoJSON au format du formulaire.
function centroidOf(gj: unknown): { lat: number; lng: number } | null {
  try {
    const cen = centroid(gj as any)
    const coords = cen?.geometry?.coordinates
    if (Array.isArray(coords) && coords.length === 2) {
      return { lat: roundCoord(coords[1]), lng: roundCoord(coords[0]) }
    }
  } catch {
    return null
  }
  return null
}

// Construit le GeoJSON `Polygon` (anneau fermé [lng, lat]) à partir des sommets.
function geometryFromVertices(vertices: TerrainVertex[]): string {
  if (vertices.length < 3) return ''
  const ring = vertices.map((v) => [v.lng, v.lat])
  ring.push([ring[0][0], ring[0][1]])
  return JSON.stringify({ type: 'Polygon', coordinates: [ring] })
}

// Extrait le premier polygone d'un GeoJSON (FeatureCollection / Feature /
// Polygon / MultiPolygon) et renvoie son anneau externe [lng, lat].
function firstRing(geometry: unknown): { ring: number[][]; type: string } | null {
  if (!geometry || typeof geometry !== 'object') return null
  const g = geometry as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown[] }
  if (g.type === 'FeatureCollection' && Array.isArray(g.features)) {
    for (const f of g.features) {
      const r = firstRing(f)
      if (r) return r
    }
    return null
  }
  if (g.type === 'Feature') return firstRing(g.geometry)
  if (g.type === 'Polygon' && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0])) {
    return { ring: (g.coordinates[0] as number[][]).filter((p) => p.length >= 2), type: 'Polygon' }
  }
  if (
    g.type === 'MultiPolygon' &&
    Array.isArray(g.coordinates) &&
    Array.isArray(g.coordinates[0]) &&
    Array.isArray(g.coordinates[0][0])
  ) {
    return { ring: ((g.coordinates[0] as number[][][])[0] as number[][]).filter((p) => p.length >= 2), type: 'MultiPolygon' }
  }
  return null
}

// Convertit un anneau externe [lng, lat] (fermé ou non) en sommets + GeoJSON +
// superficie (turf) + centroïde (turf). Retourne un objet sans géométrie si < 3 sommets.
function ringToGeom(ring: number[][]): { vertices: TerrainVertex[]; geometry: string; areaM2: number | null; centroid: { lat: number; lng: number } | null } {
  const unique = ring.filter((p, i, arr) => {
    const prev = arr[i - 1]
    return !prev || prev[0] !== p[0] || prev[1] !== p[1]
  })
  const first = unique[0]
  const last = unique[unique.length - 1]
  if (first && last && first[0] === last[0] && first[1] === last[1]) unique.pop()
  if (unique.length < 3) return { vertices: [], geometry: '', areaM2: null, centroid: null }
  const vertices: TerrainVertex[] = unique.map((p) => ({
    lat: clampLat(Number(p[1])),
    lng: clampLng(Number(p[0])),
  }))
  const geometry = geometryFromVertices(vertices)
  try {
    const gj = JSON.parse(geometry)
    const areaM2 = area(gj)
    return { vertices, geometry, areaM2, centroid: centroidOf(gj) }
  } catch {
    return { vertices, geometry, areaM2: null, centroid: null }
  }
}

export function TerrainGeometryEditor({
  value,
  onChange,
  cadastre,
  limites,
  onImportFields,
  onImportItems,
  layout = 'compact',
}: TerrainGeometryEditorProps): React.JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const basemapRef = useRef<any>(null)
  const previewLayerRef = useRef<any>(null)
  const clickHandlerRef = useRef<any>(null)
  const dblClickHandlerRef = useRef<any>(null)
  const cadastreLayerRef = useRef<any>(null)
  const cadastreFittedRef = useRef(false)
  const etudeZoneLayerRef = useRef<any>(null)
  const limitesLayerRef = useRef<any>(null)
  const limitesFittedRef = useRef(false)
  const limiteMaskRef = useRef<LimiteMask | null>(null)
  // Couche « limites_admin » chargée automatiquement si le parent ne la fournit
  // pas, afin que la zone d'étude et la limite administrative s'affichent
  // toujours dans le popup « Ajouter un terrain ».
  const [autoLimites, setAutoLimites] = useState<CoucheFeatureCollection | null>(null)
  const sourceLimites = limites && Array.isArray(limites.features) && limites.features.length > 0 ? limites : autoLimites
  limiteMaskRef.current = useMemo(() => buildLimiteMask(sourceLimites), [sourceLimites])
  const manualMarkersRef = useRef<any>(null)
  const manualPathRef = useRef<any>(null)
  const ptsRef = useRef<{ lat: number; lng: number }[]>([])
  const closedRef = useRef(false)
  const zoomOkRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const [geojsonError, setGeojsonError] = useState<string | null>(null)
  const [limiteMsg, setLimiteMsg] = useState<{ type: 'warn' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  interface ImportRow {
    id: number
    label: string
    attrs: string
    ring: number[][]
    properties: Record<string, unknown>
    areaM2: number | null
  }

  const [importRows, setImportRows] = useState<ImportRow[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [batchItems, setBatchItems] = useState<TerrainImportItem[]>([])
  const batchLayerRef = useRef<any>(null)
  const coordsDirtyRef = useRef(false)
  const [importFileName, setImportFileName] = useState('')

  const [cadastreQuery, setCadastreQuery] = useState('')
  const [cadastreMsg, setCadastreMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [selectedNum, setSelectedNum] = useState<string | null>(null)
  const [zoomOk, setZoomOk] = useState(false)
  const [activeTab, setActiveTab] = useState<'coords' | 'geojson' | 'manual'>('coords')
  const [coordRows, setCoordRows] = useState<{ lat: string; lng: string }[]>([{ lat: '', lng: '' }])
  const [coordMsg, setCoordMsg] = useState<string | null>(null)

  // Affiche le polygone appliqué (cadastre / geojson) sur la mini-carte.
  const redrawPreview = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (previewLayerRef.current) {
      previewLayerRef.current.clearLayers()
    } else {
      previewLayerRef.current = L.layerGroup().addTo(map)
    }
    const layer = previewLayerRef.current
    const pts = value.vertices

    if (pts.length >= 3) {
      const ring = pts.map((p) => [p.lat, p.lng])
      L.polygon(ring, { color: '#16a34a', weight: 2, fillColor: '#16a34a', fillOpacity: 0.15 }).addTo(layer)
    } else if (pts.length === 2) {
      L.polyline(pts.map((p) => [p.lat, p.lng]), { color: '#16a34a', weight: 2, dashArray: '4 4' }).addTo(layer)
    }
    pts.forEach((p, i) => {
      L.circleMarker([p.lat, p.lng], {
        radius: i === 0 && pts.length > 1 ? 6 : 4,
        color: '#fff',
        weight: 2,
        fillColor: '#16a34a',
        fillOpacity: 1,
      }).addTo(layer)
    })
  }, [value.vertices])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      center: INITIAL_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    basemapRef.current = L.tileLayer(BASEMAP_URL, { maxZoom: 19 }).addTo(map)
    mapRef.current = map

    const onZoom = (): void => setZoomOk((map.getZoom() ?? 0) >= MIN_DRAW_ZOOM)
    map.on('zoomend', onZoom)
    setZoomOk((map.getZoom() ?? 0) >= MIN_DRAW_ZOOM)

    // Le formulaire vit dans une popup masquée au montage : on recalcule la
    // taille de la carte dès que son conteneur devient visible.
    const container = mapContainerRef.current
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    setTimeout(() => map.invalidateSize(), 60)
    return () => {
      observer.disconnect()
      map.off('zoomend', onZoom)
      map.remove()
      mapRef.current = null
      previewLayerRef.current = null
      clickHandlerRef.current = null
      dblClickHandlerRef.current = null
      cadastreLayerRef.current = null
      etudeZoneLayerRef.current = null
      limitesLayerRef.current = null
      manualMarkersRef.current = null
      manualPathRef.current = null
    }
  }, [])

  // Charge la couche « limites_admin » si le parent ne la fournit pas, afin que
  // la zone d'étude et la limite administrative s'affichent toujours dans le popup.
  useEffect(() => {
    if (limites && Array.isArray(limites.features) && limites.features.length > 0) return
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchCouches()
        const couche = list.find((c) => c.nom === 'limites_admin')
        if (!couche) return
        const fc = await fetchCoucheGeoJSON(couche.id)
        if (!cancelled) setAutoLimites(fc)
      } catch {
        /* limite optionnelle : on ignore les erreurs de chargement */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [limites])

  useEffect(() => {
    zoomOkRef.current = zoomOk
  }, [zoomOk])

  // Au (re)montage, aucune multi-sélection n'est active côté parent.
  useEffect(() => {
    onImportItems?.([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aperçu sur la carte des terrains cochés : contour bleu pointillé = géométrie
  // du fichier (toujours affichée), vert plein = partie retenue dans la limite.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (batchLayerRef.current) {
      map.removeLayer(batchLayerRef.current)
      batchLayerRef.current = null
    }
    const selectedRows = (importRows ?? []).filter((r) => selectedIds.has(r.id))
    if (activeTab !== 'geojson' || selectedRows.length === 0) return
    const group = L.featureGroup()
    selectedRows.slice(0, 500).forEach((row) => {
      L.polygon(row.ring.map(([lng, lat]) => [lat, lng]), {
        color: '#2563eb',
        weight: 2,
        dashArray: '6 4',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
      })
        .bindTooltip(row.label, { sticky: true })
        .addTo(group)
    })
    batchItems.slice(0, 500).forEach((it) => {
      const ring = it.geom.vertices.map((v) => [v.lat, v.lng])
      if (ring.length < 3) return
      L.polygon(ring, { color: '#16a34a', weight: 2, fillColor: '#16a34a', fillOpacity: 0.3 })
        .bindTooltip(it.label, { sticky: true })
        .addTo(group)
    })
    group.addTo(map)
    batchLayerRef.current = group
    try {
      const b = group.getBounds()
      if (b.isValid()) map.flyToBounds(b.pad(0.25), { maxZoom: 18, duration: 0.6 })
    } catch {
      /* ignore */
    }
  }, [selectedIds, importRows, batchItems, activeTab])

  // ---- Zone d'étude + limite administrative ----

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (etudeZoneLayerRef.current) {
      map.removeLayer(etudeZoneLayerRef.current)
      etudeZoneLayerRef.current = null
    }
    if (limitesLayerRef.current) {
      map.removeLayer(limitesLayerRef.current)
      limitesLayerRef.current = null
    }
    const mask = limiteMaskRef.current
    if (!mask) {
      limitesFittedRef.current = false
      return
    }
    etudeZoneLayerRef.current = L.geoJSON(mask.feature as never, {
      style: () => ZONE_ETUDE_FILL_STYLE,
      interactive: false,
      bubblingMouseEvents: false,
    }).addTo(map)
    limitesLayerRef.current = L.geoJSON(mask.feature as never, {
      style: () => ADMIN_LIMIT_OUTLINE_STYLE,
      interactive: false,
      bubblingMouseEvents: false,
    }).addTo(map)
    if (layout === 'expanded' && !limitesFittedRef.current) {
      limitesFittedRef.current = true
      try {
        const bounds = limitesLayerRef.current.getBounds()
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.06), { maxZoom: 16 })
      } catch {
        /* ignore */
      }
    }
  }, [sourceLimites, layout])

  useEffect(() => {
    limitesFittedRef.current = false
  }, [layout])

  const formaterM2 = (m2: number): string => Math.round(m2).toLocaleString('fr-FR')

  // Point d'entrée unique de toute saisie de géométrie (cadastre, GeoJSON,
  // dessin manuel) : la limite administrative est appliquée avant la mise à jour
  // du formulaire, donc le polygone affiché, la superficie et le centroïde
  // transmis à l'API sont toujours ceux de la partie retenue dans la limite.
  // Retourne les sommets retenus, ou null si le polygone a été refusé
  // (entièrement hors limite ou géométrie dégénérée).
  const applyRingToForm = useCallback(
    (ring: number[][], base: Omit<TerrainGeom, 'vertices' | 'geometry' | 'areaM2' | 'centroid'>): TerrainVertex[] | null => {
      const limited = clipRingToLimite(ring, limiteMaskRef.current)
      if (limited.status === 'hors-limite') {
        setLimiteMsg({
          type: 'error',
          text: t('ranking.geo_limite_hors').replace('{nom}', limited.nomLimite || t('ranking.geo_limite_generique')),
        })
        return null
      }
      const geom = ringToGeom(limited.ring)
      if (!geom.geometry || geom.vertices.length < 3) return null
      if (limited.clipped) {
        setLimiteMsg({
          type: 'warn',
          text: t('ranking.geo_limite_ajuste')
            .replace('{nom}', limited.nomLimite || t('ranking.geo_limite_generique'))
            .replace('{surface}', formaterM2(limited.aireAvant - limited.aireApres)),
        })
      } else {
        setLimiteMsg(null)
      }
      onChange({ ...base, ...geom })
      return geom.vertices
    },
    [onChange]
  )

  // Fond de carte : satellite imposé en Mode 3 (dessin manuel), OSM sinon.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const wantSatellite = value.mode === 'manual'
    const url = wantSatellite ? SATELLITE_URL : BASEMAP_URL
    if (basemapRef.current && basemapRef.current._url === url) return
    if (basemapRef.current) map.removeLayer(basemapRef.current)
    basemapRef.current = L.tileLayer(url, { maxZoom: 19 }).addTo(map)
  }, [value.mode])

  // ---- Couche cadastrale affichée / cliquable (Mode 1) ----
  const selectedNumRef = useRef<string | null>(null)
  selectedNumRef.current = selectedNum
  const itemStyleFor = useCallback((feature: any): Record<string, unknown> => {
    const num = String(feature?.properties?.num ?? '')
    if (selectedNumRef.current != null && num === selectedNumRef.current) return CADASTRE_SELECTED_STYLE
    return CADASTRE_EDITOR_STYLE
  }, [])

  const refreshCadastreStyles = useCallback(() => {
    const layer = cadastreLayerRef.current
    if (!layer) return
    layer.eachLayer((l: any) => {
      l.setStyle(itemStyleFor(l.feature))
    })
  }, [itemStyleFor])

  const selectCadastreFeature = useCallback(
    (feature: any): void => {
      const num = String(feature?.properties?.num ?? '')
      const ring = extractRing(feature?.geometry)
      if (!ring || ring.length < 3) {
        setCadastreMsg({ type: 'error', text: t('ranking.geo_cadastre_invalid') })
        return
      }
      if (!applyRingToForm(ring, { mode: 'cadastre', source: num })) return
      setSelectedNum(num)
      setCadastreMsg(null)
      refreshCadastreStyles()
      const map = mapRef.current
      if (map) {
        const bounds = L.latLngBounds(ring.map(([lng, lat]) => [lat, lng]))
        map.flyToBounds(bounds.pad(0.3), { maxZoom: 19, duration: 0.7 })
      }
    },
    [applyRingToForm, refreshCadastreStyles]
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (cadastreLayerRef.current) {
      map.removeLayer(cadastreLayerRef.current)
      cadastreLayerRef.current = null
    }
    cadastreFittedRef.current = false
    const fc = cadastre
    if (!fc) return
    const features = fc.features.filter((f) => {
      const g = f?.geometry
      return !!g && typeof g === 'object' && !Array.isArray(g) && typeof (g as any).type === 'string' && Array.isArray((g as any).coordinates)
    })
    if (features.length === 0) {
      setCadastreMsg({ type: 'error', text: t('ranking.geo_cadastre_unavailable') })
      return
    }
    const layer = L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        style: itemStyleFor,
        onEachFeature: (feature: any, item: any) => {
          item.on('click', () => {
            if (valueRef.current.mode === 'cadastre') selectCadastreFeature(feature)
          })
          item.on('mouseover', () => {
            if (valueRef.current.mode !== 'cadastre') return
            item.setStyle(CADASTRE_HOVER_STYLE)
            item.bringToFront()
          })
          item.on('mouseout', () => item.setStyle(itemStyleFor(feature)))
        },
      }
    )
    cadastreLayerRef.current = layer
    if (valueRef.current.mode === 'cadastre') {
      layer.addTo(map)
      if (!cadastreFittedRef.current) {
        cadastreFittedRef.current = true
        if (layer.getBounds().isValid()) map.flyToBounds(layer.getBounds().pad(0.05), { maxZoom: 17 })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastre, itemStyleFor])

  // La couche cadastre n'est visible / cliquable que dans le Mode 1.
  useEffect(() => {
    const map = mapRef.current
    const layer = cadastreLayerRef.current
    if (!map || !layer) return
    if (value.mode === 'cadastre') {
      if (!map.hasLayer(layer)) layer.addTo(map)
    } else if (map.hasLayer(layer)) {
      map.removeLayer(layer)
    }
  }, [value.mode])

  // Applique le style « sélectionnée » à la parcelle choisie.
  useEffect(() => {
    refreshCadastreStyles()
  }, [selectedNum, refreshCadastreStyles])

  const searchCadastre = (): void => {
    const raw = cadastreQuery.trim()
    if (!raw || !cadastre) return
    const needle = raw.toUpperCase()
    const exact = cadastre.features.filter((f) => String(f.properties?.num ?? '').toUpperCase() === needle)
    const partial =
      exact.length === 0
        ? cadastre.features.filter((f) => String(f.properties?.num ?? '').toUpperCase().includes(needle))
        : []
    const matches = exact.length > 0 ? exact : partial
    if (matches.length === 0) {
      setSelectedNum(null)
      setCadastreMsg({ type: 'error', text: t('ranking.geo_cadastre_notfound').replace('{q}', `« ${needle} »`) })
      refreshCadastreStyles()
      return
    }
    selectCadastreFeature(matches[0])
  }

  const clearCadastre = (): void => {
    setSelectedNum(null)
    setCadastreQuery('')
    setCadastreMsg(null)
    setLimiteMsg(null)
    onChange({ ...value, mode: 'cadastre', vertices: [], geometry: '', areaM2: null, centroid: null, source: '' })
    refreshCadastreStyles()
  }

  // ---- Dessin manuel (Mode 3) ----
  const rebuildManualMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (!manualMarkersRef.current) manualMarkersRef.current = L.layerGroup().addTo(map)
    const group = manualMarkersRef.current
    group.clearLayers()
    ptsRef.current.forEach((p, i) => {
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'geo-draw-vertex-marker',
          html: `<span>${i + 1}</span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        draggable: true,
        zIndexOffset: 100 + i,
      })
      marker.on('drag', () => {
        const ll = marker.getLatLng()
        ptsRef.current[i] = { lat: clampLat(ll.lat), lng: clampLng(ll.lng) }
        rebuildManualPath()
      })
      marker.on('dragend', () => {
        if (closedRef.current) commitManual()
      })
      marker.addTo(group)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rebuildManualPath = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (manualPathRef.current) {
      manualPathRef.current.remove()
      manualPathRef.current = null
    }
    const pts = ptsRef.current
    if (pts.length < 2) return
    const ll: [number, number][] = pts.map((p) => [p.lat, p.lng])
    if (closedRef.current && pts.length >= 3) {
      manualPathRef.current = L.polygon(ll, MANUAL_PATH_STYLE)
    } else {
      manualPathRef.current = L.polyline(ll, MANUAL_PREVIEW_STYLE)
    }
    manualPathRef.current.addTo(map)
  }, [])

  const rebuildManual = useCallback(() => {
    rebuildManualMarkers()
    rebuildManualPath()
  }, [rebuildManualMarkers, rebuildManualPath])

  const commitManual = useCallback((): void => {
    const pts = ptsRef.current.slice()
    if (pts.length < 3 || !closedRef.current) {
      onChange({ mode: 'manual', vertices: pts, geometry: '', areaM2: null, centroid: null, source: '' })
      return
    }
    const ring = pts.map((p) => [p.lng, p.lat])
    const retained = applyRingToForm(ring, { mode: 'manual', source: '' })
    if (retained) {
      // Les points de saisie deviennent les sommets effectivement retenus.
      ptsRef.current = retained.map((v) => ({ ...v }))
    } else {
      // Polygone refusé (entièrement hors limite) : on rouvre la saisie.
      closedRef.current = false
    }
    rebuildManual()
  }, [applyRingToForm, onChange, rebuildManual])

  const clearManualLayers = useCallback(() => {
    if (manualMarkersRef.current) manualMarkersRef.current.clearLayers()
    if (manualPathRef.current) {
      manualPathRef.current.remove()
      manualPathRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (value.mode === 'manual') map.doubleClickZoom.disable()
    else map.doubleClickZoom.enable()
  }, [value.mode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const el = map.getContainer()
    const drawing =
      value.mode === 'manual' && !closedRef.current && zoomOk && !value.geometry
    el.style.cursor = drawing ? 'crosshair' : ''
    el.classList.toggle('geo-terrain-geom-map--draw-blocked', value.mode === 'manual' && !zoomOk)
  }, [value.mode, value.geometry, zoomOk])

  // Saisie des sommets au clic ; double-clic pour fermer (comme l'admin).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (clickHandlerRef.current) {
      map.off('click', clickHandlerRef.current)
      clickHandlerRef.current = null
    }
    if (dblClickHandlerRef.current) {
      map.off('dblclick', dblClickHandlerRef.current)
      dblClickHandlerRef.current = null
    }
    if (value.mode !== 'manual') return
    const handler = (e: any): void => {
      if (closedRef.current || !zoomOkRef.current) return
      const lat = clampLat(Number(e.latlng.lat))
      const lng = clampLng(Number(e.latlng.lng))
      const last = ptsRef.current[ptsRef.current.length - 1]
      // Un double-clic déclenche deux « click » au même endroit : on ignore le
      // second pour ne pas ajouter un sommet dupliqué avant la fermeture.
      if (last && Math.abs(last.lat - lat) < 1e-7 && Math.abs(last.lng - lng) < 1e-7) return
      ptsRef.current = [...ptsRef.current, { lat, lng }]
      rebuildManual()
      forceRender()
    }
    const dblHandler = (e: any): void => {
      L.DomEvent.stop(e)
      if (closedRef.current || !zoomOkRef.current) return
      // Sécurité : retire les éventuels sommets identiques en fin de liste.
      const pts = ptsRef.current
      while (pts.length >= 2) {
        const a = pts[pts.length - 1]
        const b = pts[pts.length - 2]
        if (Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7) pts.pop()
        else break
      }
      if (pts.length < 3) return
      closedRef.current = true
      rebuildManual()
      commitManual()
      forceRender()
    }
    clickHandlerRef.current = handler
    dblClickHandlerRef.current = dblHandler
    map.on('click', handler)
    map.on('dblclick', dblHandler)
  }, [value.mode, rebuildManual, commitManual])

  useEffect(() => {
    if (value.mode === 'manual') {
      if (value.geometry && value.vertices.length >= 3) {
        ptsRef.current = value.vertices.map((v) => ({ ...v }))
        closedRef.current = true
        rebuildManual()
      } else {
        ptsRef.current = []
        closedRef.current = false
        clearManualLayers()
      }
      forceRender()
    } else {
      ptsRef.current = []
      closedRef.current = false
      clearManualLayers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mode])

  const undoLastPoint = (): void => {
    if (closedRef.current || ptsRef.current.length === 0) return
    ptsRef.current = ptsRef.current.slice(0, -1)
    rebuildManual()
    forceRender()
  }

  const closePolygon = (): void => {
    if (closedRef.current || ptsRef.current.length < 3) return
    closedRef.current = true
    rebuildManual()
    commitManual()
    forceRender()
  }

  const restartManual = (): void => {
    ptsRef.current = []
    closedRef.current = false
    setLimiteMsg(null)
    clearManualLayers()
    onChange({ ...value, mode: 'manual', vertices: [], geometry: '', areaM2: null, centroid: null, source: '' })
    forceRender()
  }

  // ---- Saisie des points par coordonnées (onglet indépendant) ----

  const selectTab = (tab: 'coords' | 'geojson' | 'manual'): void => {
    if (tab === 'coords') {
      coordsDirtyRef.current = false
      if (selectedIds.size > 1) clearImportSelection()
      // Si un tracé est déjà présent, on pré-remplit le tableau avec ses points.
      const currentPts =
        value.mode === 'manual' && ptsRef.current.length > 0 && !value.geometry ? ptsRef.current : value.vertices
      setCoordRows((rows) =>
        currentPts.length > 0
          ? currentPts.map((p) => ({ lat: String(p.lat), lng: String(p.lng) }))
          : rows.length > 0
            ? rows
            : [{ lat: '', lng: '' }]
      )
      setCoordMsg(null)
      setActiveTab('coords')
      return
    }
    // Onglets « Import GeoJSON » / « Dessin manuel » : chaque onglet a son propre
    // contenu et son propre mode de saisie.
    setCoordMsg(null)
    switchMode(tab)
    setActiveTab(tab)
    const map = mapRef.current
    if (map) setTimeout(() => map.invalidateSize(), 80)
  }

  const addCoordRow = (): void => {
    coordsDirtyRef.current = true
    setCoordRows((rows) => [...rows, { lat: '', lng: '' }])
  }

  const removeCoordRow = (i: number): void => {
    coordsDirtyRef.current = true
    setCoordRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i)))
  }

  const setCoordCell = (i: number, field: 'lat' | 'lng', raw: string): void => {
    coordsDirtyRef.current = true
    setCoordRows((rows) => rows.map((row, idx) => (idx === i ? { ...row, [field]: raw } : row)))
  }

  const parseCoordInput = (raw: string): number | null => {
    const n = Number(raw.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  const isValidCoordRow = (row: { lat: string; lng: string }): boolean => {
    const lat = parseCoordInput(row.lat)
    const lng = parseCoordInput(row.lng)
    return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  }

  const validCoordCount = coordRows.filter(isValidCoordRow).length

  // Le polygone est construit automatiquement (sans bouton) dès qu'au moins
  // 3 points valides sont saisis ; la limite administrative est appliquée comme
  // pour le dessin / l'import. Déclenché uniquement par une saisie de l'utilisateur.
  const applyRingRef = useRef(applyRingToForm)
  applyRingRef.current = applyRingToForm
  useEffect(() => {
    if (activeTab !== 'coords' || !coordsDirtyRef.current) return
    const timer = setTimeout(() => {
      const verts: TerrainVertex[] = []
      coordRows.forEach((row) => {
        const lat = parseCoordInput(row.lat)
        const lng = parseCoordInput(row.lng)
        if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return
        verts.push({ lat: clampLat(Number(lat.toFixed(6))), lng: clampLng(Number(lng.toFixed(6))) })
      })
      const current = valueRef.current
      if (verts.length < 3) {
        if (current.geometry) {
          setLimiteMsg(null)
          onChange({ ...current, vertices: [], geometry: '', areaM2: null, centroid: null, source: '' })
        }
        return
      }
      const ring = verts.map((v) => [v.lng, v.lat])
      const retained = applyRingRef.current(ring, { mode: current.mode, source: '' })
      if (retained && current.mode === 'manual') {
        ptsRef.current = retained.map((v) => ({ ...v }))
        closedRef.current = true
        rebuildManual()
        forceRender()
      }
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordRows, activeTab])

  useEffect(() => {
    if (value.mode === 'manual') {
      if (previewLayerRef.current) previewLayerRef.current.clearLayers()
      return
    }
    redrawPreview()
  }, [redrawPreview, value.vertices, value.mode])

  const switchMode = (mode: TerrainGeomMode): void => {
    if (value.mode === mode) return
    setCoordMsg(null)
    if (mode !== 'geojson') {
      setGeojsonError(null)
      setImportRows(null)
      setImportFileName('')
      setSelectedIds(new Set())
      setBatchItems([])
      onImportItems?.([])
    }
    setCadastreMsg(null)
    setLimiteMsg(null)
    onChange({ ...value, mode, vertices: [], geometry: '', areaM2: null, centroid: null, source: '' })
  }

  const collectFeatures = (parsed: unknown): any[] => {
    if (!parsed || typeof parsed !== 'object') return []
    const p = parsed as any
    if (p.type === 'FeatureCollection' && Array.isArray(p.features)) return p.features
    if (p.type === 'Feature') return [p]
    if (p.type === 'Polygon' || p.type === 'MultiPolygon') {
      return [{ type: 'Feature', properties: {}, geometry: p }]
    }
    if (Array.isArray(p)) {
      const out: any[] = []
      for (const item of p) {
        out.push(...collectFeatures(item))
      }
      return out
    }
    return []
  }

  const ROW_ATTR_EXCLUDE = new Set(['geometry', 'id', 'gid', 'ogc_fid'])

  const buildImportRows = (features: any[]): ImportRow[] => {
    const rows: ImportRow[] = []
    features.forEach((feat: any, i: number) => {
      const ring = firstRing(feat?.geometry)
      if (!ring || ring.ring.length < 3) return
      const props = feat?.properties
      const num = props?.num ?? props?.num_parcelle ?? props?.num_titre_foncier ?? props?.id_parcelle ?? ''
      const indice = props?.indice ?? ''
      const ref = formatParcelleRef(num, indice)
      const label = ref || `Parcelle ${i + 1}`
      const attrs = Object.entries(props || {})
        .filter(([k, v]) => !ROW_ATTR_EXCLUDE.has(k) && v != null && v !== '' && String(v).trim() !== '')
        .slice(0, 6)
        .map(([k, v]) => `${attributeLabel(k, CADASTRE_ATTRIBUTE_LABELS)} : ${v}`)
        .join(' · ')
      rows.push({
        id: i,
        label,
        attrs,
        ring: ring.ring,
        properties: (props && typeof props === 'object' ? props : {}) as Record<string, unknown>,
        areaM2: ringToGeom(ring.ring).areaM2,
      })
    })
    return rows
  }

  const clearGeomValue = (): void =>
    onChange({ ...valueRef.current, mode: 'geojson', vertices: [], geometry: '', areaM2: null, centroid: null, source: '' })

  const applyImportRow = (row: ImportRow): void => {
    if (!applyRingToForm(row.ring, { mode: 'geojson', source: row.label })) {
      clearGeomValue()
      return
    }
    setGeojsonError(null)
    // Pré-remplit les champs descriptifs du formulaire parent à partir des
    // attributs de l'entité choisie dans le fichier GeoJSON.
    onImportFields?.(extractTerrainImportFields(row.properties))
  }

  // Géométrie d'une entité importée, découpée sur la limite administrative
  // (sans toucher au formulaire) — utilisé pour la multi-sélection.
  const buildImportItem = (row: ImportRow): TerrainImportItem | null => {
    const limited = clipRingToLimite(row.ring, limiteMaskRef.current)
    if (limited.status === 'hors-limite') return null
    const geom = ringToGeom(limited.ring)
    if (!geom.geometry || geom.vertices.length < 3) return null
    return {
      label: row.label,
      fields: extractTerrainImportFields(row.properties),
      geom: { mode: 'geojson', source: row.label, ...geom },
    }
  }

  const updateImportSelection = (next: Set<number>): void => {
    try {
      updateImportSelectionUnsafe(next)
    } catch (err) {
      setBatchItems([])
      onImportItems?.([])
      setGeojsonError(err instanceof Error ? err.message : String(err))
    }
  }

  const updateImportSelectionUnsafe = (next: Set<number>): void => {
    setSelectedIds(next)
    setGeojsonError(null)
    const rows = (importRows ?? []).filter((r) => next.has(r.id))
    if (rows.length === 0) {
      setBatchItems([])
      onImportItems?.([])
      setLimiteMsg(null)
      clearGeomValue()
      return
    }
    if (rows.length === 1) {
      setBatchItems([])
      onImportItems?.([])
      applyImportRow(rows[0])
      return
    }
    const items: TerrainImportItem[] = []
    const skippedLabels: string[] = []
    rows.forEach((r) => {
      const it = buildImportItem(r)
      if (it) items.push(it)
      else skippedLabels.push(r.label)
    })
    setLimiteMsg(
      skippedLabels.length > 0
        ? {
            type: 'error',
            text: `${tr('ranking.geo_import_skipped', 'Hors de la limite administrative (non importé) :')} ${skippedLabels.slice(0, 4).join(', ')}${skippedLabels.length > 4 ? '…' : ''}`,
          }
        : null
    )
    if (items.length <= 1) {
      setBatchItems([])
      onImportItems?.([])
      if (items.length === 1) {
        onChange(items[0].geom)
        onImportFields?.(items[0].fields)
      } else {
        clearGeomValue()
      }
      return
    }
    clearGeomValue()
    setBatchItems(items)
    onImportItems?.(items)
  }

  const toggleImportRow = (id: number): void => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    updateImportSelection(next)
  }

  const toggleAllImportRows = (): void => {
    if (!importRows) return
    updateImportSelection(selectedIds.size === importRows.length ? new Set() : new Set(importRows.map((r) => r.id)))
  }

  const clearImportSelection = (): void => {
    setSelectedIds(new Set())
    setBatchItems([])
    onImportItems?.([])
    clearGeomValue()
  }

  const resetImport = (): void => {
    setImportRows(null)
    setImportFileName('')
    setGeojsonError(null)
    setLimiteMsg(null)
    setSelectedIds(new Set())
    setBatchItems([])
    onImportItems?.([])
    onChange({ ...value, vertices: [], geometry: '', areaM2: null, centroid: null, source: '' })
  }

  const handleFile = (file: File): void => {
    setGeojsonError(null)
    const reader = new FileReader()
    reader.onload = () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(reader.result ?? ''))
      } catch {
        setImportRows(null)
        setImportFileName('')
        setGeojsonError(t('ranking.geo_geojson_invalid'))
        return
      }
      const features = collectFeatures(parsed)
      const rows = buildImportRows(features)
      if (rows.length === 0) {
        setImportRows(null)
        setImportFileName('')
        setGeojsonError(t('ranking.geo_geojson_invalid'))
        return
      }
      setImportRows(rows)
      setImportFileName(file.name)
      setSelectedIds(new Set())
      setBatchItems([])
      onImportItems?.([])
    }
    reader.onerror = () => {
      setImportRows(null)
      setImportFileName('')
      setGeojsonError(t('ranking.geo_geojson_invalid'))
    }
    reader.readAsText(file)
  }

  const manualCount = ptsRef.current.length
  const manualClosed = closedRef.current

  const limiteMask = limiteMaskRef.current
  const limiteNom = limiteMask ? libelleLimite(limiteMask) : ''

  return (
    <div className={`geo-terrain-geom${layout === 'expanded' ? ' geo-terrain-geom--expanded' : ''}`}>
      <div className="geo-terrain-geom-modes">
        <button
          type="button"
          className={`geo-terrain-geom-mode geo-terrain-geom-mode--coords${activeTab === 'coords' ? ' is-active' : ''}`}
          onClick={() => selectTab('coords')}
          title={t('ranking.geo_coords_btn')}
        >
          {t('ranking.geo_coords_btn')}
        </button>
        <button
          type="button"
          className={`geo-terrain-geom-mode${activeTab === 'geojson' ? ' is-active' : ''}`}
          onClick={() => selectTab('geojson')}
        >
          {t('ranking.geo_mode_geojson')}
        </button>
        <button
          type="button"
          className={`geo-terrain-geom-mode${activeTab === 'manual' ? ' is-active' : ''}`}
          onClick={() => selectTab('manual')}
        >
          {t('ranking.geo_mode_manual')}
        </button>
      </div>

      <div className="geo-terrain-geom-map-wrap" style={activeTab === 'coords' ? { display: 'none' } : undefined}>
        <div className="geo-terrain-geom-map" ref={mapContainerRef}></div>
        {value.mode === 'manual' && !zoomOk ? (
          <div className="geo-terrain-geom-map-zoom-banner geo-terrain-geom-map-zoom-banner--blocked" role="status">
            {t('ranking.geo_manual_zoom_required').replace('17', String(MIN_DRAW_ZOOM))}
          </div>
        ) : null}
        {value.mode === 'manual' && zoomOk && !manualClosed && !value.geometry ? (
          <div className="geo-terrain-geom-map-zoom-banner geo-terrain-geom-map-zoom-banner--ok" role="status">
            {t('ranking.geo_manual_zoom_ok')}
          </div>
        ) : null}
      </div>

      {activeTab === 'coords' ? (
        <div className="geo-terrain-geom-coords">
          <div className="geo-terrain-geom-coords-top">
            <span className="geo-terrain-geom-coords-title">{t('ranking.geo_coords_title')}</span>
            <span className={`geo-terrain-geom-coords-count${validCoordCount >= 3 ? ' is-ok' : ''}`}>
              {validCoordCount} {tr('ranking.geo_coords_valid_points', 'point(s) valide(s)')}
            </span>
          </div>
          <p className="geo-terrain-geom-hint">{t('ranking.geo_coords_hint')}</p>
          <div className="geo-terrain-geom-coords-table-wrap">
            <table className="geo-terrain-geom-coords-table">
              <thead>
                <tr>
                  <th className="geo-terrain-geom-coords-th--num">#</th>
                  <th>{t('ranking.geo_coords_lat')}</th>
                  <th>{t('ranking.geo_coords_lng')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {coordRows.map((row, i) => {
                  const latBad = row.lat.trim() !== '' && (parseCoordInput(row.lat) == null || Math.abs(parseCoordInput(row.lat) as number) > 90)
                  const lngBad = row.lng.trim() !== '' && (parseCoordInput(row.lng) == null || Math.abs(parseCoordInput(row.lng) as number) > 180)
                  return (
                    <tr key={i}>
                      <td className="geo-terrain-geom-coords-index">{i + 1}</td>
                      <td>
                        <input
                          className={`modal-input geo-terrain-geom-coords-input${latBad ? ' is-invalid' : ''}`}
                          inputMode="decimal"
                          placeholder="33.940000"
                          value={row.lat}
                          onChange={(e) => setCoordCell(i, 'lat', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={`modal-input geo-terrain-geom-coords-input${lngBad ? ' is-invalid' : ''}`}
                          inputMode="decimal"
                          placeholder="-6.850000"
                          value={row.lng}
                          onChange={(e) => setCoordCell(i, 'lng', e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="geo-terrain-geom-coords-remove"
                          onClick={() => removeCoordRow(i)}
                          disabled={coordRows.length <= 1}
                          aria-label={t('ranking.geo_coords_remove')}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="geo-terrain-geom-coords-actions">
            <button type="button" className="geo-tg-btn geo-tg-btn--outline" onClick={addCoordRow}>
              <span aria-hidden="true">+</span> {t('ranking.geo_coords_add')}
            </button>
            <span className="geo-terrain-geom-coords-status">
              {validCoordCount < 3
                ? t('ranking.geo_min_points')
                : value.geometry
                  ? tr('ranking.geo_coords_auto_ok', 'Polygone généré automatiquement')
                  : ''}
            </span>
          </div>
          {coordMsg ? <p className="geo-terrain-geom-error">{coordMsg}</p> : null}
        </div>
      ) : null}

      {limiteMask && activeTab !== 'coords' ? (
        <div className="geo-terrain-geom-limites-legend">
          <p className="geo-terrain-geom-limite">
            <span className="geo-terrain-geom-limite-swatch geo-terrain-geom-limite-swatch--etude"></span>
            {t('ranking.geo_limite_etude_legende')}
          </p>
          <p className="geo-terrain-geom-limite">
            <span className="geo-terrain-geom-limite-swatch geo-terrain-geom-limite-swatch--admin"></span>
            {t('ranking.geo_limite_admin_legende').replace('{nom}', limiteNom || t('ranking.geo_limite_generique'))}
          </p>
        </div>
      ) : null}

      {limiteMsg ? (
        <p className={limiteMsg.type === 'error' ? 'geo-terrain-geom-error' : 'geo-terrain-geom-warn'}>{limiteMsg.text}</p>
      ) : null}

      {value.mode === 'cadastre' ? (
        <div className="geo-terrain-geom-cadastre">
          <p className="geo-terrain-geom-hint">{t('ranking.geo_cadastre_hint')}</p>
          <div className="geo-terrain-geom-cadastre-search">
            <input
              className="modal-input geo-terrain-geom-cadastre-input"
              placeholder={t('ranking.geo_cadastre_search_placeholder')}
              value={cadastreQuery}
              onChange={(e) => setCadastreQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchCadastre()
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={searchCadastre}
              disabled={!cadastreQuery.trim() || !cadastre}
            >
              {t('ranking.geo_cadastre_search')}
            </button>
          </div>
          {!cadastre ? (
            <p className="geo-terrain-geom-error">{t('ranking.geo_cadastre_unavailable')}</p>
          ) : null}
          {cadastreMsg ? (
            <p className={cadastreMsg.type === 'ok' ? 'geo-terrain-geom-ok' : 'geo-terrain-geom-error'}>{cadastreMsg.text}</p>
          ) : null}
          {value.geometry && value.source ? (
            <div className="geo-terrain-geom-cadastre-selected">
              <span>
                {t('ranking.geo_cadastre_selected')} : <strong>{value.source}</strong>
              </span>
              <button type="button" className="geo-terrain-geom-cadastre-clear" onClick={clearCadastre}>
                {t('ranking.geo_cadastre_clear')}
              </button>
            </div>
          ) : null}
          {value.geometry && value.areaM2 != null ? (
            <p className="geo-terrain-geom-ok">
              {t('ranking.geo_area')} : <strong>{Math.round(value.areaM2).toLocaleString('fr-FR')} m²</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'geojson' ? (
        <div className="geo-terrain-geom-geojson">
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              if (file) handleFile(file)
              e.currentTarget.value = ''
            }}
          />
          {importRows === null ? (
            <button type="button" className="geo-import-drop" onClick={() => fileInputRef.current?.click()}>
              <span className="geo-import-drop-icon" aria-hidden="true">⬆</span>
              <span className="geo-import-drop-title">{t('ranking.geo_import')}</span>
              <span className="geo-import-drop-hint">{tr('ranking.geo_import_formats', 'Formats acceptés : .geojson, .json')}</span>
            </button>
          ) : (
            <div className="geo-import-panel">
              <div className="geo-import-head">
                <div className="geo-import-head-info">
                  <span className="geo-import-file" title={importFileName}>{importFileName}</span>
                  <span className="geo-import-count">
                    {importRows.length} {tr('ranking.geo_import_found', 'terrain(s) trouvé(s)')} ·{' '}
                    <strong>{selectedIds.size}</strong> {tr('ranking.geo_import_selected', 'sélectionné(s)')}
                  </span>
                </div>
                <div className="geo-import-head-actions">
                  <button type="button" className="geo-tg-btn geo-tg-btn--ghost" onClick={toggleAllImportRows}>
                    {selectedIds.size === importRows.length
                      ? tr('ranking.geo_import_none', 'Tout désélectionner')
                      : tr('ranking.geo_import_all', 'Tout sélectionner')}
                  </button>
                  <button type="button" className="geo-tg-btn geo-tg-btn--outline" onClick={resetImport}>
                    {t('ranking.geo_import_rechoose')}
                  </button>
                </div>
              </div>
              <div className="geo-terrain-geom-import-list">
                {importRows.map((row) => {
                  const checked = selectedIds.has(row.id)
                  return (
                    <label key={row.id} className={`geo-terrain-geom-import-row${checked ? ' is-selected' : ''}`}>
                      <input type="checkbox" className="geo-import-check" checked={checked} onChange={() => toggleImportRow(row.id)} />
                      <span className="geo-import-row-body">
                        <span className="geo-terrain-geom-import-row-label"><strong>{row.label}</strong></span>
                        {row.attrs ? <span className="geo-terrain-geom-import-row-attrs">{row.attrs}</span> : null}
                      </span>
                      {row.areaM2 != null ? (
                        <span className="geo-import-row-area">{Math.round(row.areaM2).toLocaleString('fr-FR')} m²</span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {geojsonError ? <p className="geo-terrain-geom-error">{geojsonError}</p> : null}
          {batchItems.length > 1 ? (
            <p className="geo-terrain-geom-ok">
              {batchItems.length} {tr('ranking.geo_import_batch_ok', 'terrains sélectionnés — superficie totale')}{' '}
              <strong>
                {Math.round(batchItems.reduce((sum, it) => sum + (it.geom.areaM2 ?? 0), 0)).toLocaleString('fr-FR')} m²
              </strong>
            </p>
          ) : value.geometry && value.areaM2 != null ? (
            <p className="geo-terrain-geom-ok">
              {value.source ? `« ${value.source} » — ` : ''}
              {t('ranking.geo_geojson_ok')}{' '}
              <strong>{Math.round(value.areaM2).toLocaleString('fr-FR')} m²</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'manual' ? (
        <div className="geo-terrain-geom-manual">
          <div className="geo-terrain-geom-manual-warning">{t('ranking.geo_manual_warning')}</div>
          {!zoomOk ? <p className="geo-terrain-geom-manual-zoom">{t('ranking.geo_manual_zoom_required')}</p> : null}
          {!manualClosed ? (
            <>
              <p className="geo-terrain-geom-hint">{t('ranking.geo_manual_draw_hint')}</p>
              <div className="geo-terrain-geom-manual-actions">
                <button
                  type="button"
                  className="geo-tg-btn geo-tg-btn--outline"
                  onClick={undoLastPoint}
                  disabled={manualCount === 0}
                >
                  {t('ranking.geo_manual_undo')}
                </button>
                <button
                  type="button"
                  className="geo-tg-btn geo-tg-btn--primary"
                  onClick={closePolygon}
                  disabled={manualCount < 3}
                >
                  {t('ranking.geo_manual_finish')}
                </button>
              </div>
              {manualCount < 3 ? <p className="geo-terrain-geom-min-points">{t('ranking.geo_min_points')}</p> : null}
            </>
          ) : (
            <>
              <p className="geo-terrain-geom-hint">{t('ranking.geo_manual_closed_hint')}</p>
              <div className="geo-terrain-geom-manual-actions">
                <button type="button" className="geo-tg-btn geo-tg-btn--outline" onClick={restartManual}>
                  {t('ranking.geo_manual_restart')}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

export { emptyGeom }
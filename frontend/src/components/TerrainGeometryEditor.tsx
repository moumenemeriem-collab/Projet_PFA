import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import area from '@turf/area'
import centroid from '@turf/centroid'
import { type CoucheFeatureCollection } from '../api/couches'
import { t } from '../i18n/index'
import { extractRing } from '../utils/terrainDims'

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

interface TerrainGeometryEditorProps {
  value: TerrainGeom
  onChange: (v: TerrainGeom) => void
  // Features de la couche cadastrale (couche « cadastre » de la plateforme),
  // déjà chargées par la carte principale. Recherche sur `properties.num`.
  cadastre?: CoucheFeatureCollection | null
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

const emptyGeom = (mode: TerrainGeomMode = 'cadastre'): TerrainGeom => ({
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
    const cen = centroid(gj)
    const c =
      cen && Array.isArray(cen.geometry.coordinates) && cen.geometry.coordinates.length === 2
        ? { lat: cen.geometry.coordinates[1], lng: cen.geometry.coordinates[0] }
        : null
    return { vertices, geometry, areaM2, centroid: c }
  } catch {
    return { vertices, geometry, areaM2: null, centroid: null }
  }
}

export function TerrainGeometryEditor({ value, onChange, cadastre }: TerrainGeometryEditorProps): React.JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const basemapRef = useRef<any>(null)
  const previewLayerRef = useRef<any>(null)
  const clickHandlerRef = useRef<any>(null)
  const cadastreLayerRef = useRef<any>(null)
  const cadastreFittedRef = useRef(false)
  const manualMarkersRef = useRef<any>(null)
  const manualPathRef = useRef<any>(null)
  const ptsRef = useRef<{ lat: number; lng: number }[]>([])
  const closedRef = useRef(false)
  const zoomOkRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const [geojsonText, setGeojsonText] = useState('')
  const [geojsonError, setGeojsonError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [cadastreQuery, setCadastreQuery] = useState('')
  const [cadastreMsg, setCadastreMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [selectedNum, setSelectedNum] = useState<string | null>(null)
  const [zoomOk, setZoomOk] = useState(false)

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
      cadastreLayerRef.current = null
      manualMarkersRef.current = null
      manualPathRef.current = null
    }
  }, [])

  useEffect(() => {
    zoomOkRef.current = zoomOk
  }, [zoomOk])

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
      const geom = ringToGeom(ring)
      setSelectedNum(num)
      setCadastreMsg(null)
      onChange({ mode: 'cadastre', ...geom, source: num })
      refreshCadastreStyles()
      const map = mapRef.current
      if (map) {
        const bounds = L.latLngBounds(ring.map(([lng, lat]) => [lat, lng]))
        map.flyToBounds(bounds.pad(0.3), { maxZoom: 19, duration: 0.7 })
      }
    },
    [onChange, refreshCadastreStyles]
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
    const geometry = geometryFromVertices(pts)
    let areaM2: number | null = null
    let cen: { lat: number; lng: number } | null = null
    try {
      const gj = JSON.parse(geometry)
      areaM2 = area(gj)
      const c = centroid(gj)
      if (c && Array.isArray(c.geometry.coordinates) && c.geometry.coordinates.length === 2) {
        cen = { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] }
      }
    } catch {
      areaM2 = null
    }
    onChange({ mode: 'manual', vertices: pts, geometry, areaM2, centroid: cen, source: '' })
  }, [onChange])

  const clearManualLayers = useCallback(() => {
    if (manualMarkersRef.current) manualMarkersRef.current.clearLayers()
    if (manualPathRef.current) {
      manualPathRef.current.remove()
      manualPathRef.current = null
    }
  }, [])

  // Saisie des sommets au clic (Mode 3, seulement si zoom OK et polygone non fermé).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (clickHandlerRef.current) {
      map.off('click', clickHandlerRef.current)
      clickHandlerRef.current = null
    }
    if (value.mode !== 'manual') return
    const handler = (e: any): void => {
      if (closedRef.current || !zoomOkRef.current) return
      const lat = clampLat(Number(e.latlng.lat))
      const lng = clampLng(Number(e.latlng.lng))
      ptsRef.current = [...ptsRef.current, { lat, lng }]
      rebuildManual()
      forceRender()
    }
    clickHandlerRef.current = handler
    map.on('click', handler)
  }, [value.mode, rebuildManual])

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
    clearManualLayers()
    onChange({ ...value, mode: 'manual', vertices: [], geometry: '', areaM2: null, centroid: null, source: '' })
    forceRender()
  }

  useEffect(() => {
    if (value.mode === 'manual') {
      if (previewLayerRef.current) previewLayerRef.current.clearLayers()
      return
    }
    redrawPreview()
  }, [redrawPreview, value.vertices, value.mode])

  const switchMode = (mode: TerrainGeomMode): void => {
    if (value.mode === mode) return
    if (mode !== 'geojson') {
      setGeojsonError(null)
      setGeojsonText('')
    }
    setCadastreMsg(null)
    onChange({ ...value, mode, vertices: [], geometry: '', areaM2: null, centroid: null, source: '' })
  }

  const applyImportedRing = (ring: number[][], label: string): void => {
    if (!ring || ring.length < 3) {
      setGeojsonError(t('ranking.geo_geojson_invalid'))
      return
    }
    const geom = ringToGeom(ring)
    if (!geom.geometry || geom.vertices.length < 3) {
      setGeojsonError(t('ranking.geo_geojson_invalid'))
      return
    }
    setGeojsonError(null)
    onChange({ ...geom, mode: 'geojson', source: label })
  }

  const parseAndImport = (raw: string, label: string): void => {
    setGeojsonError(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      setGeojsonError(t('ranking.geo_geojson_invalid'))
      return
    }
    const ring = firstRing(parsed)
    if (!ring) {
      setGeojsonError(t('ranking.geo_geojson_invalid'))
      return
    }
    applyImportedRing(ring.ring, label)
  }

  const handleFile = (file: File): void => {
    const reader = new FileReader()
    reader.onload = () => parseAndImport(String(reader.result ?? ''), file.name)
    reader.onerror = () => setGeojsonError(t('ranking.geo_geojson_invalid'))
    reader.readAsText(file)
  }

  const manualCount = ptsRef.current.length
  const manualClosed = closedRef.current

  return (
    <div className="geo-terrain-geom">
      <div className="geo-terrain-geom-modes">
        <button
          type="button"
          className={`geo-terrain-geom-mode geo-terrain-geom-mode--recommended${value.mode === 'cadastre' ? ' is-active' : ''}`}
          onClick={() => switchMode('cadastre')}
        >
          {t('ranking.geo_mode_cadastre')}
          <span className="geo-terrain-geom-mode-badge">{t('ranking.geo_recommended')}</span>
        </button>
        <button
          type="button"
          className={`geo-terrain-geom-mode${value.mode === 'geojson' ? ' is-active' : ''}`}
          onClick={() => switchMode('geojson')}
        >
          {t('ranking.geo_mode_geojson')}
        </button>
        <button
          type="button"
          className={`geo-terrain-geom-mode${value.mode === 'manual' ? ' is-active' : ''}`}
          onClick={() => switchMode('manual')}
        >
          {t('ranking.geo_mode_manual')}
          <span className="geo-terrain-geom-mode-badge geo-terrain-geom-mode-badge--warn">{t('ranking.geo_last_resort')}</span>
        </button>
      </div>

      <div className="geo-terrain-geom-map" ref={mapContainerRef}></div>

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
      ) : value.mode === 'geojson' ? (
        <div className="geo-terrain-geom-geojson">
          <div className="geo-terrain-geom-geojson-row">
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
            <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              {t('ranking.geo_import_file')}
            </button>
            <textarea
              className="geo-terrain-geom-geojson-text"
              placeholder={t('ranking.geo_paste_geojson')}
              value={geojsonText}
              onChange={(e) => setGeojsonText(e.target.value)}
              rows={3}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!geojsonText.trim()}
              onClick={() => parseAndImport(geojsonText, t('ranking.geo_import_pasted'))}
            >
              {t('ranking.geo_import')}
            </button>
          </div>
          {geojsonError ? <p className="geo-terrain-geom-error">{geojsonError}</p> : null}
          {value.geometry && value.areaM2 != null ? (
            <p className="geo-terrain-geom-ok">
              {value.source ? `« ${value.source} » — ` : ''}
              {t('ranking.geo_geojson_ok')}{' '}
              <strong>{Math.round(value.areaM2).toLocaleString('fr-FR')} m²</strong>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="geo-terrain-geom-manual">
          <div className="geo-terrain-geom-manual-warning">{t('ranking.geo_manual_warning')}</div>
          {!zoomOk ? <p className="geo-terrain-geom-manual-zoom">{t('ranking.geo_manual_zoom_required')}</p> : null}
          {!manualClosed ? (
            <>
              <p className="geo-terrain-geom-hint">{t('ranking.geo_manual_draw_hint')}</p>
              <div className="geo-terrain-geom-manual-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-action"
                  onClick={undoLastPoint}
                  disabled={manualCount === 0}
                >
                  {t('ranking.geo_manual_undo')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
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
                <button type="button" className="btn btn-outline btn-action" onClick={restartManual}>
                  {t('ranking.geo_manual_restart')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export { emptyGeom }
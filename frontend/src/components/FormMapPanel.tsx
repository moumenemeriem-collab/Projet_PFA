import { useCallback, useEffect, useRef, useState } from 'react'
import { icons } from './icons'
import { fetchCouches, fetchCoucheGeoJSON, type Couche, type CoucheFeatureCollection } from '../api/couches'

const BASEMAPS = [
  { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap' },
  { id: 'satellite', name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  { id: 'topo', name: 'Topographique', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap' },
]

type DrawMode = 'none' | 'point' | 'polyline' | 'polygon'

interface FormMapPanelProps {
  onGeometry?: (geometry: { type: string; coordinates: any } | null) => void
}

export function FormMapPanel({ onGeometry }: FormMapPanelProps): React.JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const basemapLayerRef = useRef<any>(null)
  const coucheLayersRef = useRef<Record<number, any>>({})
  const drawLayerRef = useRef<any>(null)
  const drawMarkersRef = useRef<any[]>([])
  const drawTempLineRef = useRef<any>(null)
  const clickHandlerRef = useRef<any>(null)
  const dblClickHandlerRef = useRef<any>(null)
  const [basemapId, setBasemapId] = useState('osm')
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false)
  const [couches, setCouches] = useState<Couche[]>([])
  const [couchesData, setCouchesData] = useState<Record<number, CoucheFeatureCollection>>({})
  const [activeCouches, setActiveCouches] = useState<Set<number>>(new Set())
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const basemapMenuRef = useRef<HTMLDivElement>(null)
  const drawVerticesRef = useRef<{ lat: number; lng: number }[]>([])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      center: [33.97, -6.85],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    basemapLayerRef.current = L.tileLayer(BASEMAPS[0].url, { attribution: BASEMAPS[0].attribution, maxZoom: 19 }).addTo(map)
    drawLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 100)
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const bm = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]
    if (basemapLayerRef.current) map.removeLayer(basemapLayerRef.current)
    basemapLayerRef.current = L.tileLayer(bm.url, { attribution: bm.attribution, maxZoom: 19 }).addTo(map)
  }, [basemapId])

  useEffect(() => {
    fetchCouches()
      .then((list) => {
        const MAP_EXCLUDED = new Set(['mnt', 'reglement_pa', 'prix_fonciers'])
        const filtered = list.filter((c) => c.table_liee && !MAP_EXCLUDED.has(c.nom))
        setCouches(filtered)
        Promise.allSettled(filtered.map((c) => fetchCoucheGeoJSON(c.id)))
          .then((results) => {
            const data: Record<number, CoucheFeatureCollection> = {}
            results.forEach((r, i) => {
              if (r.status === 'fulfilled') data[filtered[i].id] = r.value
            })
            setCouchesData(data)
          })
          .catch(() => {})
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    activeCouches.forEach((id) => {
      if (coucheLayersRef.current[id]) return
      const fc = couchesData[id]
      if (!fc) return
      const layer = L.geoJSON(fc, {
        style: () => ({
          color: '#3b82f6',
          weight: 2,
          opacity: 0.7,
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
        }),
        onEachFeature: (feature: any, l: any) => {
          const props = feature.properties || {}
          const lines = Object.entries(props).filter(([, v]) => v != null).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>')
          l.bindPopup(`<div style="font-size:12px;line-height:1.5;max-width:280px">${lines || '<em>Aucun attribut</em>'}</div>`)
        },
      }).addTo(map)
      coucheLayersRef.current[id] = layer
      try { map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 16 }) } catch {}
    })
    Object.keys(coucheLayersRef.current).forEach((k) => {
      const id = Number(k)
      if (!activeCouches.has(id)) {
        map.removeLayer(coucheLayersRef.current[id])
        delete coucheLayersRef.current[id]
      }
    })
  }, [activeCouches, couchesData])

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (basemapMenuOpen && basemapMenuRef.current && !basemapMenuRef.current.contains(e.target as Node)) {
        setBasemapMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [basemapMenuOpen])

  const clearDraw = useCallback((): void => {
    const map = mapRef.current
    if (!map) return
    if (clickHandlerRef.current) { map.off('click', clickHandlerRef.current); clickHandlerRef.current = null }
    if (dblClickHandlerRef.current) { map.off('dblclick', dblClickHandlerRef.current); dblClickHandlerRef.current = null }
    drawLayerRef.current.clearLayers()
    drawMarkersRef.current = []
    drawVerticesRef.current = []
    if (drawTempLineRef.current) { drawTempLineRef.current = null }
    onGeometry?.(null)
  }, [onGeometry])

  const finishDraw = useCallback((vertices: { lat: number; lng: number }[], mode: DrawMode): void => {
    const map = mapRef.current
    if (!map) return
    if (clickHandlerRef.current) { map.off('click', clickHandlerRef.current); clickHandlerRef.current = null }
    if (dblClickHandlerRef.current) { map.off('dblclick', dblClickHandlerRef.current); dblClickHandlerRef.current = null }
    drawLayerRef.current.clearLayers()
    drawMarkersRef.current = []

    if (mode === 'point' && vertices.length === 1) {
      const v = vertices[0]
      L.circleMarker([v.lat, v.lng], { radius: 8, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.9, weight: 2 }).addTo(drawLayerRef.current)
      onGeometry?.({ type: 'Point', coordinates: [v.lng, v.lat] })
    } else if (mode === 'polyline' && vertices.length >= 2) {
      const coords = vertices.map((v) => [v.lat, v.lng])
      L.polyline(coords, { color: '#dc2626', weight: 3, dashArray: '6 4' }).addTo(drawLayerRef.current)
      vertices.forEach((v) => {
        L.circleMarker([v.lat, v.lng], { radius: 5, color: '#dc2626', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(drawLayerRef.current)
      })
      onGeometry?.({ type: 'MultiLineString', coordinates: [vertices.map((v) => [v.lng, v.lat])] })
    } else if (mode === 'polygon' && vertices.length >= 3) {
      const ring = [...vertices, vertices[0]].map((v) => [v.lat, v.lng])
      L.polygon(ring, { color: '#dc2626', weight: 3, fillColor: '#dc2626', fillOpacity: 0.15, dashArray: '6 4' }).addTo(drawLayerRef.current)
      vertices.forEach((v) => {
        L.circleMarker([v.lat, v.lng], { radius: 5, color: '#dc2626', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(drawLayerRef.current)
      })
      onGeometry?.({ type: 'MultiPolygon', coordinates: [[vertices.map((v) => [v.lng, v.lat])]] })
    }
  }, [onGeometry])

  const activateDraw = useCallback((mode: DrawMode): void => {
    const map = mapRef.current
    if (!map) return
    clearDraw()
    if (mode === 'none') return
    setDrawMode(mode)

    if (mode === 'point') {
      const handler = (e: any) => {
        drawVerticesRef.current = [{ lat: e.latlng.lat, lng: e.latlng.lng }]
        finishDraw(drawVerticesRef.current, 'point')
        setDrawMode('none')
      }
      clickHandlerRef.current = handler
      map.on('click', handler)
      map.getContainer().style.cursor = 'crosshair'
    } else {
      const tempLine = L.polyline([], { color: '#dc2626', weight: 2, dashArray: '6 4', interactive: false }).addTo(drawLayerRef.current)
      drawTempLineRef.current = tempLine

      const clickHandler = (e: any) => {
        const v = { lat: e.latlng.lat, lng: e.latlng.lng }
        drawVerticesRef.current.push(v)
        const marker = L.circleMarker([v.lat, v.lng], { radius: 5, color: '#dc2626', fillColor: '#fff', fillOpacity: 1, weight: 2, interactive: false }).addTo(drawLayerRef.current)
        drawMarkersRef.current.push(marker)
        tempLine.addLatLng([v.lat, v.lng])
      }

      const dblClickHandler = (e: any) => {
        L.DomEvent.stop(e)
        if (drawVerticesRef.current.length >= (mode === 'polygon' ? 3 : 2)) {
          finishDraw(drawVerticesRef.current, mode)
          setDrawMode('none')
        }
      }

      clickHandlerRef.current = clickHandler
      dblClickHandlerRef.current = dblClickHandler
      map.on('click', clickHandler)
      map.on('dblclick', dblClickHandler)
      map.getContainer().style.cursor = 'crosshair'
    }
  }, [clearDraw, finishDraw])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (drawMode === 'none') {
      map.getContainer().style.cursor = ''
    }
  }, [drawMode])

  useEffect(() => {
    return () => { clearDraw() }
  }, [])

  const handleModeClick = (mode: DrawMode): void => {
    if (drawMode === mode) {
      setDrawMode('none')
      clearDraw()
    } else {
      activateDraw(mode)
    }
  }

  const toggleCouche = (id: number): void => {
    setActiveCouches((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="form-map-panel">
      <div className="form-map-topbar">
        <span className="form-map-topbar-label">{icons.layers} Couches</span>
        <div className="form-map-topbar-items">
          {couches.map((c) => (
            <label className="form-map-layer-toggle" key={c.id}>
              <input
                type="checkbox"
                checked={activeCouches.has(c.id)}
                onChange={() => toggleCouche(c.id)}
              />
              <span className="form-map-layer-dot" style={{ background: activeCouches.has(c.id) ? '#3b82f6' : '#94a3b8' }}></span>
              <span>{c.nom_affichage}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="form-map-toolbar">
        <button
          type="button"
          className={`form-map-draw-btn${drawMode === 'point' ? ' form-map-draw-btn--active' : ''}`}
          title="Placer un point"
          onClick={() => handleModeClick('point')}
        >
          {icons.mapPin}
          <span>Point</span>
        </button>
        <button
          type="button"
          className={`form-map-draw-btn${drawMode === 'polyline' ? ' form-map-draw-btn--active' : ''}`}
          title="Dessiner une ligne"
          onClick={() => handleModeClick('polyline')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><path d="M4 20L20 4" /><circle cx="4" cy="20" r="2" fill="currentColor" /><circle cx="20" cy="4" r="2" fill="currentColor" /></svg>
          <span>Ligne</span>
        </button>
        <button
          type="button"
          className={`form-map-draw-btn${drawMode === 'polygon' ? ' form-map-draw-btn--active' : ''}`}
          title="Dessiner un polygone"
          onClick={() => handleModeClick('polygon')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="15" height="15"><polygon points="12,2 22,8.5 18,20 6,20 2,8.5" /></svg>
          <span>Surface</span>
        </button>
        {drawMode !== 'none' ? (
          <button
            type="button"
            className="form-map-draw-btn form-map-draw-btn--cancel"
            title="Annuler le dessin"
            onClick={() => { clearDraw(); setDrawMode('none') }}
          >
            {icons.close}
            <span>Annuler</span>
          </button>
        ) : null}
      </div>
      {drawMode !== 'none' ? (
        <div className="form-map-draw-hint">
          {drawMode === 'point' ? 'Cliquez sur la carte pour placer le point' :
           drawMode === 'polyline' ? 'Cliquez pour ajouter des points, double-cliquez pour terminer' :
           'Cliquez pour ajouter des sommets, double-cliquez pour fermer'}
        </div>
      ) : null}
      <div className="form-map-container" ref={mapContainerRef}></div>
      <div className="form-map-basemap" ref={basemapMenuRef}>
        <button
          type="button"
          className={`form-map-basemap-btn${basemapMenuOpen ? ' form-map-basemap-btn--active' : ''}`}
          title="Fond de carte"
          onClick={(e) => { e.stopPropagation(); setBasemapMenuOpen((v) => !v) }}
        >
          {icons.layers}
        </button>
        {basemapMenuOpen ? (
          <div className="form-map-basemap-popup">
            {BASEMAPS.map((bm) => (
              <button
                type="button"
                className={`form-map-basemap-option${bm.id === basemapId ? ' form-map-basemap-option--active' : ''}`}
                key={bm.id}
                onClick={(e) => { e.stopPropagation(); setBasemapId(bm.id); setBasemapMenuOpen(false) }}
              >
                <span className="form-map-basemap-radio"></span>
                <span>{bm.name}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

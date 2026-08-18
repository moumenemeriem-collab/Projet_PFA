import { useEffect, useRef, useState } from 'react'
import { icons } from './icons'
import { fetchCouches, fetchCoucheGeoJSON, type Couche, type CoucheFeatureCollection } from '../api/couches'

const BASEMAPS = [
  { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap' },
  { id: 'satellite', name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  { id: 'topo', name: 'Topographique', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap' },
]

const MAP_EXCLUDED = new Set(['reglement_pa', 'prix_fonciers'])

interface VisualiserModalProps {
  onClose: () => void
}

export function VisualiserModal({ onClose }: VisualiserModalProps): React.JSX.Element {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const basemapLayerRef = useRef<any>(null)
  const coucheLayersRef = useRef<Record<number, any>>({})
  const [basemapId, setBasemapId] = useState('osm')
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false)
  const [couches, setCouches] = useState<Couche[]>([])
  const [couchesData, setCouchesData] = useState<Record<number, CoucheFeatureCollection>>({})
  const [activeCouches, setActiveCouches] = useState<Set<number>>(new Set())
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const basemapMenuRef = useRef<HTMLDivElement>(null)

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
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 100)
    return () => { map.remove(); mapRef.current = null }
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
      const couche = couches.find((c) => c.id === id)
      const color = getCoucheColor(couche?.categorie)
      const layer = L.geoJSON(fc, {
        style: () => ({
          color,
          weight: 2,
          opacity: 0.7,
          fillColor: color,
          fillOpacity: 0.1,
        }),
        onEachFeature: (feature: any, l: any) => {
          const props = feature.properties || {}
          const lines = Object.entries(props).filter(([, v]) => v != null).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>')
          l.bindPopup(`<div style="font-size:12px;line-height:1.5;max-width:280px">${lines || '<em>Aucun attribut</em>'}</div>`)
        },
      }).addTo(map)
      coucheLayersRef.current[id] = layer
    })
    Object.keys(coucheLayersRef.current).forEach((k) => {
      const id = Number(k)
      if (!activeCouches.has(id)) {
        map.removeLayer(coucheLayersRef.current[id])
        delete coucheLayersRef.current[id]
      }
    })
    const allBounds: any[] = []
    Object.values(coucheLayersRef.current).forEach((l) => { try { allBounds.push(l.getBounds()) } catch {} })
    if (allBounds.length > 0) {
      const combined = allBounds.reduce((acc, b) => acc.extend(b), allBounds[0])
      try { map.fitBounds(combined, { padding: [20, 20], maxZoom: 16 }) } catch {}
    }
  }, [activeCouches, couchesData, couches])

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (basemapMenuOpen && basemapMenuRef.current && !basemapMenuRef.current.contains(e.target as Node)) {
        setBasemapMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [basemapMenuOpen])

  const toggleCouche = (id: number): void => {
    setActiveCouches((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpand = (id: number): void => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="admin-modal-overlay ligne-form-overlay" onClick={onClose}>
      <div className="ligne-form-split visu-split" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="visu-left">
          <div className="visu-left-header">
            <h3>Couches disponibles</h3>
            <button type="button" className="couche-modal-close" aria-label="Fermer" onClick={onClose}>{icons.close}</button>
          </div>
          <div className="visu-list">
            {couches.map((c) => {
              const isActive = activeCouches.has(c.id)
              const isExpanded = expandedId === c.id
              const color = getCoucheColor(c.categorie)
              return (
                <div className={`visu-card${isActive ? ' visu-card--active' : ''}`} key={c.id}>
                  <div className="visu-card-header">
                    <label className="visu-card-toggle">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleCouche(c.id)}
                      />
                      <span className="visu-card-dot" style={{ background: isActive ? color : '#cbd5e1' }}></span>
                      <div className="visu-card-info">
                        <span className="visu-card-name">{c.nom_affichage}</span>
                        <span className="visu-card-cat">{c.categorie}</span>
                      </div>
                    </label>
                    <button
                      type="button"
                      className={`visu-card-expand${isExpanded ? ' visu-card-expand--open' : ''}`}
                      onClick={() => toggleExpand(c.id)}
                      title="Afficher les attributs"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width="16" height="16"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  </div>
                  {isExpanded ? (
                    <div className="visu-card-attrs">
                      {c.attributs.length === 0 ? (
                        <span className="visu-attr-empty">Aucun attribut</span>
                      ) : (
                        c.attributs.map((a) => (
                          <span className="visu-attr-chip" key={a.nom}>
                            <span className="visu-attr-name">{a.nom}</span>
                            <span className="visu-attr-type">{a.type}</span>
                          </span>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
            {couches.length === 0 ? (
              <div className="visu-empty">Aucune couche disponible</div>
            ) : null}
          </div>
          <div className="visu-left-footer">
            <span className="visu-active-count">{activeCouches.size} couche(s) active(s)</span>
          </div>
        </div>
        <div className="visu-right">
          <div className="visu-map" ref={mapContainerRef}></div>
          <div className="visu-basemap" ref={basemapMenuRef}>
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
      </div>
    </div>
  )
}

function getCoucheColor(categorie: string | undefined): string {
  switch (categorie) {
    case 'foncier': return '#3b82f6'
    case 'transport': return '#f59e0b'
    case 'amenagement': return '#10b981'
    case 'environnement': return '#22c55e'
    case 'habitat': return '#8b5cf6'
    case 'equipement': return '#ef4444'
    default: return '#6366f1'
  }
}

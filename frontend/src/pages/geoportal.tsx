import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { formatApiErrors } from '../api/auth'
import { fetchProjet, type Projet } from '../api/projets'
import { fetchAnalyse, type AnalyseFiltres, type AnalyseResultat } from '../api/terrains'
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
          {scoreRow(t('ranking.score_global'), tr.score_global, '#8b5cf6')}
        </div>
        <div className="geo-sr-classement">
          {t('ranking.classement_sur')} : <strong>{tr.classement}<sup>{ordinalSuffix(tr.classement)}</sup></strong> / {total}
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

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const currentLayerRef = useRef<any>(null)
  const terrainMarkersRef = useRef<any[]>([])
  const analyseResultatsRef = useRef<AnalyseResultat[]>([])
  const overlayLayersRef = useRef<Record<string, any>>({})
  const layersBarRef = useRef<HTMLDivElement>(null)
  const accordionContentRefs = useRef<Record<string, HTMLDivElement | null>>({})

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
    const map = L.map(mapEl, { center: [33.8, -6.5], zoom: 12, zoomControl: false })
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
    }
  }, [projet])

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

  const clearTerrainMarkers = (): void => {
    const map = mapRef.current
    terrainMarkersRef.current.forEach((m) => {
      if (map) map.removeLayer(m)
    })
    terrainMarkersRef.current = []
  }

  const selectTerrain = (terrainId: number): void => {
    const terrain = analyseResultatsRef.current.find((tr) => tr.id === terrainId)
    if (!terrain) return
    terrainMarkersRef.current.forEach((m, i) => {
      const tr = analyseResultatsRef.current[i]
      const isSelected = tr.id === terrainId
      m.setRadius(isSelected ? 12 : 9)
      m.setStyle({ weight: isSelected ? 3.5 : 2.5 })
    })
    setSelectedTerrain(terrain)
    setCardMode('results')
  }

  const displayTerrainMarkers = (): void => {
    const map = mapRef.current
    if (!map) return
    analyseResultatsRef.current.forEach((tr) => {
      const color = getScoreColor(tr.score_global)
      const marker = L.circleMarker([tr.lat, tr.lng], {
        radius: 9,
        color: '#fff',
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2.5,
      }).addTo(map)

      marker.bindTooltip(`${tr.nom} — ${tr.score_global.toFixed(0)}/100`, {
        direction: 'top', offset: [0, -6], className: 'geo-marker-tooltip',
      })

      marker.on('click', () => {
        selectTerrain(tr.id)
      })

      terrainMarkersRef.current.push(marker)
    })

    if (terrainMarkersRef.current.length > 0) {
      const group = L.featureGroup(terrainMarkersRef.current)
      map.fitBounds(group.getBounds().pad(0.15))
    }
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

      clearTerrainMarkers()

      if (analyseResultatsRef.current.length === 0) {
        setCardMode('empty')
        return
      }

      displayTerrainMarkers()
      selectTerrain(analyseResultatsRef.current[0].id)
    } catch (err) {
      setCardError(err instanceof Error ? err.message : String(err))
    }
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
              <button type="button" className="btn btn-primary geo-btn-analyze" id="filter-analyze" onClick={() => { void handleAnalyse() }}>
                {icons.search} {t('ranking.run_analysis')}
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
                  <div className="geo-layers-popup" id="layers-popup">
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
                  </div>
                </div>

                <button
                  type="button"
                  className={`geo-fab geo-fab-sidebar${sidebarCollapsed ? '' : ' geo-fab--active'}`}
                  id="sidebar-toggle"
                  title={t('ranking.filter_title')}
                  onClick={() => setSidebarCollapsed((v) => !v)}
                >
                  {icons.filter}
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
                        <input type="search" id="terrain-search" className="geo-field-input" placeholder={t('ranking.search_placeholder')} />
                      </div>
                      <button type="button" className="btn btn-primary geo-card-btn" id="search-terrain-btn">
                        {icons.search} {t('ranking.search_btn')}
                      </button>
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
                          {renderInfoGenerale(selectedTerrain)}
                          {renderDetailCriteres(selectedTerrain)}
                          {renderScores(selectedTerrain, analyseResultatsRef.current.length)}
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

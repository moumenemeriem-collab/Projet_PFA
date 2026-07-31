import { icons } from '../components/icons.ts'
import { clearSession, getStoredUser, formatApiErrors } from '../api/auth.ts'
import { fetchProjet, type Projet } from '../api/projets.ts'
import { fetchAnalyse, type AnalyseResultat, type AnalyseFiltres } from '../api/terrains.ts'
import { t, langSwitcherHTML, setupLangSwitcher } from '../i18n/index'
import { fetchNotifications, deleteNotification, markNotificationsRead } from '../api/messagerie.ts'

import osmImg from '../assets/features/OSM.png'
import satImg from '../assets/features/osm_sat.jpg'
import topoImg from '../assets/features/osm_topo.jpeg'

declare const L: any

let map: any = null
let marker: any = null
let currentLayer: any = null

const BASEMAPS: { id: string; name: string; url: string; attribution: string; img: string }[] = [
  { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap', img: osmImg },
  { id: 'satellite', name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri', img: satImg },
  { id: 'topo', name: 'Topographique', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap', img: topoImg },
]

const OVERLAY_LAYERS: { id: string; name: string; url: string; attribution: string; opacity: number }[] = [
  { id: 'transport', name: 'Transport', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '&copy; OSM FR', opacity: 0.6 },
  { id: 'dark', name: 'Sombre', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CARTO', opacity: 0.5 },
]

function getProjectIdFromUrl(): number {
  const match = window.location.pathname.match(/\/projets\/(\d+)\/classement\/ajouter/)
  return match ? Number(match[1]) : 0
}

function renderGeoportalPage(projet: Projet): string {
  const user = getStoredUser()!
  const initials = user.prenom.charAt(0) + user.nom.charAt(0)

  return `
    <div class="geo-layout">
      <header class="geo-topbar">
        <div class="geo-topbar-left">
          <span class="geo-topbar-logo">${icons.logo}</span>
          <span class="geo-topbar-brand">${t('ranking.geoportal_title')}</span>
          <span class="geo-topbar-label">${t('ranking.sidebar_title')}</span>
          <span class="geo-topbar-sep">:</span>
          <span class="geo-topbar-subtitle">${projet.nom}</span>
        </div>
        <div class="geo-topbar-right">
          <div class="notification-wrapper" id="notif-wrapper">
            <button type="button" class="notification-bell" id="notif-bell" title="${t('notif.title')}">
              ${icons.bell}
            </button>
            <div class="notification-dropdown" id="notif-dropdown" hidden></div>
          </div>
          ${langSwitcherHTML('lang-switcher--topbar')}
          <div class="geo-topbar-user">
            <span class="geo-topbar-user-name">${user.prenom} ${user.nom}</span>
            <a href="/profil" class="geo-topbar-avatar">${initials}</a>
          </div>
        </div>
      </header>

      <div class="geo-body">
        <aside class="geo-sidebar">
          <div class="geo-sidebar-scroll">
          <div class="geo-sidebar-header">
            <div class="geo-sidebar-header-row">
              <span class="geo-sidebar-header-icon">${icons.filter}</span>
              <h2 class="geo-sidebar-title">${t('ranking.filter_title')}</h2>
            </div>
            <p class="geo-sidebar-desc">${t('ranking.filter_desc')}</p>
          </div>

          <div class="geo-accordion" id="filter-accordion">
            ${renderAccessibiliteSection()}
            ${renderPositionnementSection()}
            ${renderTopographieSection()}
          </div>
        </div>

        <div class="geo-sidebar-footer">
          <button type="button" class="btn geo-btn-reset" id="filter-reset">
            ${icons.close} ${t('ranking.reset_filters')}
          </button>
          <button type="button" class="btn btn-primary geo-btn-analyze" id="filter-analyze">
            ${icons.search} ${t('ranking.run_analysis')}
          </button>
          <a href="/projets/${projet.id}/classement" class="geo-back-link">
            ${icons.chevronLeft} ${t('ranking.back_to_classement')}
          </a>
        </div>
        </aside>

        <div class="geo-main">
          <div class="geo-main-body">
          <div class="geo-map-container">
            <div id="map"></div>
            <div class="geo-coord-display" id="coord-display">Lat: — , Lng: —</div>

            <div class="geo-map-layers-bar" id="layers-bar">
              <div class="geo-layers-trigger" id="layers-trigger">
                <button type="button" class="geo-basemap-btn geo-basemap-btn--active" data-basemap="${BASEMAPS[0].id}">
                  <img class="geo-basemap-btn-img" src="${BASEMAPS[0].img}" alt="${BASEMAPS[0].name}" />
                  <span class="geo-basemap-btn-label">${BASEMAPS[0].name}</span>
                  <span class="geo-basemap-chevron">${icons.chevron}</span>
                </button>
              </div>
              <div class="geo-layers-popup" id="layers-popup">
                <div class="geo-layers-popup-section">
                  <span class="geo-layers-popup-label">${t('ranking.basemap')}</span>
                  <div class="geo-layers-popup-basemaps" id="basemap-selector">
                    ${BASEMAPS.map((bm) => `
                      <button type="button" class="geo-popup-basemap-btn${bm.id === BASEMAPS[0].id ? ' geo-popup-basemap-btn--active' : ''}" data-basemap="${bm.id}">
                        <img class="geo-popup-basemap-img" src="${bm.img}" alt="${bm.name}" />
                        <span class="geo-popup-basemap-label">${bm.name}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>
                <div class="geo-layers-popup-divider"></div>
                <div class="geo-layers-popup-section">
                  <span class="geo-layers-popup-label">${t('ranking.overlays')}</span>
                  <div class="geo-layers-popup-overlays" id="overlay-layers">
                    ${OVERLAY_LAYERS.map((ol) => `
                      <label class="geo-popup-overlay-item">
                        <input type="checkbox" data-overlay-toggle="${ol.id}" />
                        <span class="geo-popup-overlay-dot"></span>
                        <span>${ol.name}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <button type="button" class="geo-fab geo-fab-sidebar" id="sidebar-toggle" title="${t('ranking.filter_title')}">
              ${icons.filter}
            </button>

            <div class="geo-terrain-card" id="terrain-card">
              <div class="geo-terrain-card-header">
                <h3 id="card-title">${t('ranking.terrain_info')}</h3>
                <div class="geo-card-header-actions">
                  <button type="button" class="geo-card-back" id="card-back-btn" hidden>${icons.chevronLeft}</button>
                  <button type="button" class="geo-terrain-card-close" id="terrain-card-toggle">
                    ${icons.close}
                  </button>
                </div>
              </div>
              <div class="geo-terrain-card-body" id="card-body">
                ${renderSearchMode()}
              </div>
            </div>

            <button type="button" class="geo-fab geo-fab-terrain" id="terrain-card-reopen" title="${t('ranking.terrain_info')}">
              ${icons.building}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  `
}

function renderSearchMode(): string {
  return `
    <div class="geo-card-search-section">
      <div class="geo-field">
        <label class="geo-field-label" for="terrain-search">${t('ranking.search_terrain')}</label>
        <input type="search" id="terrain-search" class="geo-field-input" placeholder="${t('ranking.search_placeholder')}" />
      </div>
      <button type="button" class="btn btn-primary geo-card-btn" id="search-terrain-btn">
        ${icons.search} ${t('ranking.search_btn')}
      </button>
    </div>
    <div class="geo-card-divider"></div>
    <div class="geo-card-results" id="card-results">
      <div class="geo-sr-empty">
        <span class="geo-sr-empty-icon">${icons.search}</span>
        <p class="geo-sr-empty-text">${t('ranking.analyse_empty')}</p>
      </div>
    </div>
  `
}

function renderAccessibiliteSection(): string {
  return `
    <div class="geo-accordion-item" data-section="accessibilite">
      <button type="button" class="geo-accordion-trigger">
        <span class="geo-accordion-icon geo-accordion-icon--blue">${icons.layers}</span>
        <span class="geo-accordion-label">${t('ranking.filter_access')}</span>
        <span class="geo-accordion-chevron">${icons.chevron}</span>
      </button>
      <div class="geo-accordion-content">
        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_road_type')}</span>
          ${['route_nationale', 'route_regionale', 'route_provinciale', 'route_locale', 'peu_importe'].map((val, i) => `
            <label class="geo-checkbox">
              <input type="checkbox" name="route_type" value="${val}" ${i === 4 ? '' : ''} />
              <span class="geo-checkbox-mark"></span>
              <span class="geo-checkbox-label">${t(`ranking.route_type_${val}`)}</span>
            </label>
          `).join('')}
        </div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_max_distance_road')}</span>
          <select class="geo-select" name="distance_route" data-custom-input="distance_route_custom">
            <option value="">${t('ranking.filter_any')}</option>
            <option value="100">100 m</option>
            <option value="250">250 m</option>
            <option value="500">500 m</option>
            <option value="1000">1 km</option>
            <option value="2000">2 km</option>
            <option value="__custom__">${t('ranking.distance_custom')}</option>
          </select>
          <input type="number" min="1" step="1" class="geo-distance-input geo-distance-input--full" name="distance_route_custom" placeholder="${t('ranking.distance_custom_placeholder')}" hidden />
        </div>

        <div class="geo-filter-divider"></div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_health')}</span>
          <div class="geo-filter-row">
            <div class="geo-filter-checks">
              <label class="geo-checkbox">
                <input type="checkbox" name="health" value="hopital" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.health_hopital')}</span>
              </label>
              <label class="geo-checkbox">
                <input type="checkbox" name="health" value="clinique" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.health_clinique')}</span>
              </label>
            </div>
            <select class="geo-select" name="distance_health" data-custom-input="distance_health_custom">
              <option value="500">500 m</option>
              <option value="1000">1 km</option>
              <option value="2000">2 km</option>
              <option value="5000">5 km</option>
              <option value="__custom__">${t('ranking.distance_custom')}</option>
            </select>
            <input type="number" min="1" step="1" class="geo-distance-input" name="distance_health_custom" placeholder="${t('ranking.distance_custom_placeholder')}" hidden />
          </div>
        </div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_education')}</span>
          <div class="geo-filter-row">
            <div class="geo-filter-checks">
              <label class="geo-checkbox">
                <input type="checkbox" name="education" value="ecole" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.edu_ecole')}</span>
              </label>
              <label class="geo-checkbox">
                <input type="checkbox" name="education" value="lycee" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.edu_lycee')}</span>
              </label>
              <label class="geo-checkbox">
                <input type="checkbox" name="education" value="universite" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.edu_universite')}</span>
              </label>
            </div>
            <select class="geo-select" name="distance_education" data-custom-input="distance_education_custom">
              <option value="500">500 m</option>
              <option value="1000">1 km</option>
              <option value="2000">2 km</option>
              <option value="5000">5 km</option>
              <option value="__custom__">${t('ranking.distance_custom')}</option>
            </select>
            <input type="number" min="1" step="1" class="geo-distance-input" name="distance_education_custom" placeholder="${t('ranking.distance_custom_placeholder')}" hidden />
          </div>
        </div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_commerce')}</span>
          <div class="geo-filter-row">
            <div class="geo-filter-checks">
              <label class="geo-checkbox">
                <input type="checkbox" name="commerce" value="centre_commercial" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.commerce_centre')}</span>
              </label>
              <label class="geo-checkbox">
                <input type="checkbox" name="commerce" value="marche" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.commerce_marche')}</span>
              </label>
            </div>
            <select class="geo-select" name="distance_commerce" data-custom-input="distance_commerce_custom">
              <option value="500">500 m</option>
              <option value="1000">1 km</option>
              <option value="2000">2 km</option>
              <option value="5000">5 km</option>
              <option value="__custom__">${t('ranking.distance_custom')}</option>
            </select>
            <input type="number" min="1" step="1" class="geo-distance-input" name="distance_commerce_custom" placeholder="${t('ranking.distance_custom_placeholder')}" hidden />
          </div>
        </div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_transport')}</span>
          <div class="geo-filter-row">
            <div class="geo-filter-checks">
              <label class="geo-checkbox">
                <input type="checkbox" name="transport" value="gare_routiere" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.transport_gare')}</span>
              </label>
              <label class="geo-checkbox">
                <input type="checkbox" name="transport" value="arret_bus" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.transport_bus')}</span>
              </label>
            </div>
            <select class="geo-select" name="distance_transport" data-custom-input="distance_transport_custom">
              <option value="250">250 m</option>
              <option value="500">500 m</option>
              <option value="1000">1 km</option>
              <option value="__custom__">${t('ranking.distance_custom')}</option>
            </select>
            <input type="number" min="1" step="1" class="geo-distance-input" name="distance_transport_custom" placeholder="${t('ranking.distance_custom_placeholder')}" hidden />
          </div>
        </div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_admin')}</span>
          <div class="geo-filter-row">
            <div class="geo-filter-checks">
              <label class="geo-checkbox">
                <input type="checkbox" name="admin" value="commune" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.admin_commune')}</span>
              </label>
              <label class="geo-checkbox">
                <input type="checkbox" name="admin" value="poste" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.admin_poste')}</span>
              </label>
              <label class="geo-checkbox">
                <input type="checkbox" name="admin" value="police" />
                <span class="geo-checkbox-mark"></span>
                <span class="geo-checkbox-label">${t('ranking.admin_police')}</span>
              </label>
            </div>
            <select class="geo-select" name="distance_admin" data-custom-input="distance_admin_custom">
              <option value="1000">1 km</option>
              <option value="2000">2 km</option>
              <option value="5000">5 km</option>
              <option value="__custom__">${t('ranking.distance_custom')}</option>
            </select>
            <input type="number" min="1" step="1" class="geo-distance-input" name="distance_admin_custom" placeholder="${t('ranking.distance_custom_placeholder')}" hidden />
          </div>
        </div>
      </div>
    </div>
  `
}

function renderPositionnementSection(): string {
  return `
    <div class="geo-accordion-item" data-section="positionnement">
      <button type="button" class="geo-accordion-trigger">
        <span class="geo-accordion-icon geo-accordion-icon--green">${icons.mapPin}</span>
        <span class="geo-accordion-label">${t('ranking.filter_position')}</span>
        <span class="geo-accordion-chevron">${icons.chevron}</span>
      </button>
      <div class="geo-accordion-content">
        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_localisation')}</span>
          ${['centre_ville', 'periurbaine', 'rurale'].map((val) => `
            <label class="geo-checkbox">
              <input type="checkbox" name="localisation" value="${val}" />
              <span class="geo-checkbox-mark"></span>
              <span class="geo-checkbox-label">${t(`ranking.loc_${val}`)}</span>
            </label>
          `).join('')}
        </div>

        <div class="geo-filter-divider"></div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_distance_poles')}</span>
          <div class="geo-poles-grid">
            ${['pole_centre', 'pole_industriel', 'pole_commercial', 'pole_gare', 'pole_port', 'pole_aeroport'].map((val) => `
              <div class="geo-pole-item">
                <label class="geo-checkbox">
                  <input type="checkbox" name="pole" value="${val}" />
                  <span class="geo-checkbox-mark"></span>
                  <span class="geo-checkbox-label">${t(`ranking.${val}`)}</span>
                </label>
              </div>
            `).join('')}
          </div>
          <select class="geo-select geo-select--full" name="distance_poles" data-custom-input="distance_poles_custom">
            <option value="1000">1 km</option>
            <option value="2000">2 km</option>
            <option value="5000">5 km</option>
            <option value="10000">10 km</option>
            <option value="__custom__">${t('ranking.distance_custom')}</option>
          </select>
          <input type="number" min="1" step="1" class="geo-distance-input geo-distance-input--full" name="distance_poles_custom" placeholder="${t('ranking.distance_custom_placeholder')}" hidden />
        </div>

        <div class="geo-filter-divider"></div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_situation_admin')}</span>
          ${['interieur_perimetre', 'exterieur_perimetre'].map((val) => `
            <label class="geo-checkbox">
              <input type="checkbox" name="situation_admin" value="${val}" />
              <span class="geo-checkbox-mark"></span>
              <span class="geo-checkbox-label">${t(`ranking.situation_${val}`)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderTopographieSection(): string {
  return `
    <div class="geo-accordion-item" data-section="topographie">
      <button type="button" class="geo-accordion-trigger">
        <span class="geo-accordion-icon geo-accordion-icon--amber">${icons.ranking}</span>
        <span class="geo-accordion-label">${t('ranking.filter_topo')}</span>
        <span class="geo-accordion-chevron">${icons.chevron}</span>
      </button>
      <div class="geo-accordion-content">
        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_pente')}</span>
          ${['0_5', '5_10', '10_15', 'gt15'].map((val) => `
            <label class="geo-checkbox">
              <input type="checkbox" name="pente" value="${val}" />
              <span class="geo-checkbox-mark"></span>
              <span class="geo-checkbox-label">${t(`ranking.pente_${val}`)}</span>
            </label>
          `).join('')}
        </div>

        <div class="geo-filter-divider"></div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_denivele')}</span>
          ${['lt5', '5_20', 'gt20'].map((val) => `
            <label class="geo-checkbox">
              <input type="checkbox" name="denivele" value="${val}" />
              <span class="geo-checkbox-mark"></span>
              <span class="geo-checkbox-label">${t(`ranking.denivele_${val}`)}</span>
            </label>
          `).join('')}
        </div>

        <div class="geo-filter-divider"></div>

        <div class="geo-filter-group">
          <span class="geo-filter-group-title">${t('ranking.filter_altitude')}</span>
          ${['any', 'lt100', '100_300', 'gt300'].map((val) => `
            <label class="geo-checkbox">
              <input type="checkbox" name="altitude" value="${val}" />
              <span class="geo-checkbox-mark"></span>
              <span class="geo-checkbox-label">${t(`ranking.altitude_${val}`)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function initMap(): void {
  const mapEl = document.querySelector<HTMLDivElement>('#map')
  if (!mapEl) return

  map = L.map(mapEl, { center: [33.8, -6.5], zoom: 12, zoomControl: false })
  L.control.zoom({ position: 'bottomright' }).addTo(map)

  currentLayer = L.tileLayer(BASEMAPS[0].url, { attribution: BASEMAPS[0].attribution, maxZoom: 19 }).addTo(map)

  map.on('click', (e: any) => {
    const { lat, lng } = e.latlng
    if (marker) {
      marker.setLatLng([lat, lng])
    } else {
      marker = L.circleMarker([lat, lng], {
        radius: 8, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.8, weight: 2,
      }).addTo(map)
    }
    marker.bindPopup(`
      <div class="geoportal-popup">
        <div class="geoportal-popup-title">${t('ranking.selected_point')}</div>
        <div class="geoportal-popup-coords">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</div>
      </div>
    `).openPopup()

    const coordDisplay = document.querySelector<HTMLElement>('#coord-display')
    if (coordDisplay) {
      coordDisplay.textContent = `Lat: ${lat.toFixed(6)} , Lng: ${lng.toFixed(6)}`
    }
  })
}

function setupAccordions(): void {
  document.querySelectorAll<HTMLElement>('.geo-accordion-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.geo-accordion-item')
      if (!item) return
      const content = item.querySelector<HTMLElement>('.geo-accordion-content')
      if (!content) return
      const isOpen = item.classList.contains('is-open')
      if (isOpen) {
        item.classList.remove('is-open')
        content.style.maxHeight = '0'
      } else {
        item.classList.add('is-open')
        content.style.maxHeight = content.scrollHeight + 'px'
      }
    })
  })
}

function setupBasemapSwitcher(): void {
  const trigger = document.getElementById('layers-trigger')
  const popup = document.getElementById('layers-popup')
  const triggerBtn = trigger?.querySelector<HTMLButtonElement>('.geo-basemap-btn')
  const triggerImg = triggerBtn?.querySelector<HTMLImageElement>('.geo-basemap-btn-img')
  const triggerLabel = triggerBtn?.querySelector('.geo-basemap-btn-label')
  const popupBtns = document.querySelectorAll<HTMLButtonElement>('.geo-popup-basemap-btn')

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation()
    popup?.classList.toggle('geo-layers-popup--open')
  })

  popupBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = btn.dataset.basemap
      const basemap = BASEMAPS.find((b) => b.id === id)
      if (!basemap || !map) return
      if (currentLayer) map.removeLayer(currentLayer)
      currentLayer = L.tileLayer(basemap.url, { attribution: basemap.attribution, maxZoom: 19 }).addTo(map)

      popupBtns.forEach((el) => el.classList.remove('geo-popup-basemap-btn--active'))
      btn.classList.add('geo-popup-basemap-btn--active')

      if (triggerImg) triggerImg.src = basemap.img
      if (triggerImg) triggerImg.alt = basemap.name
      if (triggerBtn) triggerBtn.dataset.basemap = basemap.id
      if (triggerLabel) triggerLabel.textContent = basemap.name

      popup?.classList.remove('geo-layers-popup--open')
    })
  })

  document.addEventListener('click', (e) => {
    const bar = document.getElementById('layers-bar')
    if (popup && bar && !bar.contains(e.target as Node)) {
      popup.classList.remove('geo-layers-popup--open')
    }
  })
}

function setupOverlayToggles(): void {
  const activeOverlays: Record<string, any> = {}
  document.querySelectorAll<HTMLInputElement>('[data-overlay-toggle]').forEach((chk) => {
    chk.addEventListener('change', () => {
      const id = chk.dataset.overlayToggle!
      const overlay = OVERLAY_LAYERS.find((o) => o.id === id)
      if (!overlay || !map) return
      if (chk.checked) {
        activeOverlays[id] = L.tileLayer(overlay.url, { attribution: overlay.attribution, opacity: overlay.opacity, maxZoom: 19 }).addTo(map)
      } else {
        if (activeOverlays[id]) {
          map.removeLayer(activeOverlays[id])
          delete activeOverlays[id]
        }
      }
    })
  })
}

function setupSidebarToggle(): void {
  const toggle = document.querySelector<HTMLElement>('#sidebar-toggle')
  const sidebar = document.querySelector<HTMLElement>('.geo-sidebar')
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('geo-sidebar--collapsed')
      const isCollapsed = sidebar.classList.contains('geo-sidebar--collapsed')
      toggle.classList.toggle('geo-fab--active', !isCollapsed)
    })
  }
}

function setupTerrainCardToggle(): void {
  const card = document.querySelector<HTMLElement>('#terrain-card')
  const closeBtn = document.querySelector<HTMLElement>('#terrain-card-toggle')
  const reopenBtn = document.querySelector<HTMLElement>('#terrain-card-reopen')
  const backBtn = document.querySelector<HTMLElement>('#card-back-btn')
  if (closeBtn && card) {
    closeBtn.addEventListener('click', () => {
      card.classList.add('geo-terrain-card--hidden')
      if (reopenBtn) reopenBtn.classList.add('geo-fab--visible')
    })
  }
  if (reopenBtn && card) {
    reopenBtn.addEventListener('click', () => {
      card.classList.remove('geo-terrain-card--hidden')
      reopenBtn.classList.remove('geo-fab--visible')
    })
  }
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      showCardEditMode()
    })
  }
}

function setupCustomDistances(): void {
  document.querySelectorAll<HTMLSelectElement>('#filter-accordion select[data-custom-input]').forEach((sel) => {
    const inputName = sel.dataset.customInput
    if (!inputName) return
    const input = document.querySelector<HTMLInputElement>(`input[name="${inputName}"]`)
    if (!input) return
    const sync = () => {
      input.hidden = sel.value !== '__custom__'
      if (sel.value !== '__custom__') input.value = ''
    }
    sel.addEventListener('change', sync)
    sync()
  })
}

function setupResetFilters(): void {
  document.querySelector('#filter-reset')?.addEventListener('click', () => {
    document.querySelectorAll<HTMLInputElement>('#filter-accordion input[type="checkbox"]').forEach((cb) => { cb.checked = false })
    document.querySelectorAll<HTMLSelectElement>('#filter-accordion select').forEach((sel) => { sel.selectedIndex = 0 })
    document.querySelectorAll<HTMLInputElement>('#filter-accordion input.geo-distance-input').forEach((inp) => { inp.hidden = true; inp.value = '' })
  })
}

function setupNotifications(root: HTMLElement): void {
  const bell = root.querySelector('#notif-bell')
  const dropdown = root.querySelector<HTMLElement>('#notif-dropdown')
  if (!bell || !dropdown) return

  fetchNotifications().then(data => {
    if (data.non_lues > 0) {
      const badge = document.createElement('span')
      badge.className = 'notification-badge'
      badge.textContent = String(data.non_lues)
      bell.appendChild(badge)
    }
  }).catch(() => {})

  bell.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!dropdown.hidden) { dropdown.hidden = true; return }
    try {
      const data = await fetchNotifications()
      dropdown.innerHTML = `
        <div class="notif-header">${t('notif.title')}</div>
        <div class="notif-list">
          ${data.results.length > 0
            ? data.results.map(n => `
              <div class="notif-item${n.lu ? '' : ' notif-item--unread'}" data-notif-id="${n.id}" data-msg-id="${n.message_id ?? ''}">
                <div class="notif-item-body">
                  <div class="notif-item-title">${n.titre}</div>
                  <div class="notif-item-content">${n.contenu}</div>
                </div>
                <button type="button" class="notif-dismiss" data-dismiss-id="${n.id}" title="Masquer">${icons.close}</button>
              </div>
            `).join('')
            : `<div class="notif-empty">${t('notif.empty')}</div>`}
        </div>
      `
      dropdown.hidden = false

      dropdown.querySelectorAll('.notif-dismiss').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation()
          const id = Number((btn as HTMLElement).dataset.dismissId)
          try {
            await deleteNotification(id)
            const item = dropdown.querySelector(`[data-notif-id="${id}"]`)
            if (item) item.remove()
            if (!dropdown.querySelector('.notif-item')) {
              dropdown.innerHTML = `<div class="notif-header">${t('notif.title')}</div><div class="notif-list"><div class="notif-empty">${t('notif.empty')}</div></div>`
            }
            const badge = bell.querySelector('.notification-badge')
            if (badge) {
              const count = parseInt(badge.textContent || '1') - 1
              if (count <= 0) badge.remove()
              else badge.textContent = String(count)
            }
          } catch { /* ignore */ }
        })
      })

      if (data.non_lues > 0) {
        await markNotificationsRead()
        const badge = bell.querySelector('.notification-badge')
        if (badge) badge.remove()
      }
    } catch { /* ignore */ }
  })

  document.addEventListener('click', () => { dropdown.hidden = true })
  dropdown.addEventListener('click', (e) => { e.stopPropagation() })
}

/* ── Analyse multicritère ── */

let analyseResultats: AnalyseResultat[] = []
let terrainMarkers: any[] = []

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

function setupAnalyse(projetId: number): void {
  document.querySelector('#filter-analyze')?.addEventListener('click', async () => {
    const filtres = collectFilterFiltres()
    if (!hasAnyFilter(filtres)) {
      alert('Veuillez sélectionner au moins un critère avant de lancer l\'analyse.')
      return
    }

    showCardResults('loading')

      try {
        const response = await fetchAnalyse(projetId, filtres)
        analyseResultats = response.resultats

        clearTerrainMarkers()

        if (analyseResultats.length === 0) {
          showCardResults('empty')
          return
        }

        displayTerrainMarkers()
        selectTerrain(analyseResultats[0].id)
      } catch (err: any) {
        const resultsEl = document.getElementById('card-results')
        if (resultsEl) resultsEl.innerHTML = `<div class="geo-sr-empty"><p>${err.message}</p></div>`
      }
  })
}

function clearTerrainMarkers(): void {
  terrainMarkers.forEach((m) => { if (map) map.removeLayer(m) })
  terrainMarkers = []
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#eab308'
  return '#dc2626'
}

function displayTerrainMarkers(): void {
  analyseResultats.forEach((tr) => {
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

    terrainMarkers.push(marker)
  })

  if (terrainMarkers.length > 0) {
    const group = L.featureGroup(terrainMarkers)
    map.fitBounds(group.getBounds().pad(0.15))
  }
}

function selectTerrain(terrainId: number): void {
  const terrain = analyseResultats.find((t) => t.id === terrainId)
  if (!terrain) return

  terrainMarkers.forEach((m, i) => {
    const tr = analyseResultats[i]
    const isSelected = tr.id === terrainId
    m.setRadius(isSelected ? 12 : 9)
    m.setStyle({ weight: isSelected ? 3.5 : 2.5 })
  })

  showCardResults('results', terrain)
}

function showCardResults(mode: 'loading' | 'results' | 'empty', terrain?: AnalyseResultat): void {
  const card = document.getElementById('terrain-card')
  const title = document.getElementById('card-title')
  const resultsEl = document.getElementById('card-results')
  const backBtn = document.getElementById('card-back-btn')
  if (!card || !resultsEl) return

  card.classList.remove('geo-terrain-card--hidden')
  if (title) title.textContent = t('ranking.analyse_title')
  if (backBtn) backBtn.hidden = false

  if (mode === 'loading') {
    resultsEl.innerHTML = `<div class="geo-sr-loading"><div class="geo-sr-spinner"></div> ${t('ranking.analyse_running')}</div>`
    return
  }

  if (mode === 'empty') {
    resultsEl.innerHTML = `
      <div class="geo-sr-empty">
        <span class="geo-sr-empty-icon">${icons.search}</span>
        <p class="geo-sr-empty-text">${t('ranking.no_terrains_found')}</p>
      </div>
    `
    return
  }

  if (!terrain) return
  resultsEl.innerHTML = `
    ${renderInfoGenerale(terrain)}
    ${renderDetailCriteres(terrain)}
    ${renderScores(terrain)}
    ${renderConclusion(terrain)}
  `
}

function showCardEditMode(): void {
  const title = document.getElementById('card-title')
  const resultsEl = document.getElementById('card-results')
  const backBtn = document.getElementById('card-back-btn')
  if (!resultsEl) return
  if (title) title.textContent = t('ranking.terrain_info')
  if (backBtn) backBtn.hidden = true
  resultsEl.innerHTML = `
    <div class="geo-sr-empty">
      <span class="geo-sr-empty-icon">${icons.search}</span>
      <p class="geo-sr-empty-text">${t('ranking.analyse_empty')}</p>
    </div>
  `
}

function renderInfoGenerale(tr: AnalyseResultat): string {
  const info = tr.infos_generales
  return `
    <div class="geo-sr-card">
      <div class="geo-sr-card-header">
        <span class="geo-sr-card-header-icon">${icons.mapPin}</span>
        <h4 class="geo-sr-card-title">${t('ranking.terrain_infos')}</h4>
      </div>
      <div class="geo-sr-card-body">
        <div class="geo-sr-info-grid">
          <div class="geo-sr-info-item">
            <span class="geo-sr-info-label">${t('ranking.terrain_reference')}</span>
            <span class="geo-sr-info-value">${info.reference_cadastrale}</span>
          </div>
          <div class="geo-sr-info-item">
            <span class="geo-sr-info-label">${t('ranking.terrain_commune')}</span>
            <span class="geo-sr-info-value">${info.commune}</span>
          </div>
          <div class="geo-sr-info-item">
            <span class="geo-sr-info-label">${t('ranking.terrain_province')}</span>
            <span class="geo-sr-info-value">${info.province}</span>
          </div>
          <div class="geo-sr-info-item">
            <span class="geo-sr-info-label">${t('ranking.terrain_region')}</span>
            <span class="geo-sr-info-value">${info.region}</span>
          </div>
          <div class="geo-sr-info-item">
            <span class="geo-sr-info-label">${t('ranking.terrain_surface')}</span>
            <span class="geo-sr-info-value">${info.superficie}</span>
          </div>
          <div class="geo-sr-info-item">
            <span class="geo-sr-info-label">${t('ranking.terrain_perimetre')}</span>
            <span class="geo-sr-info-value">${info.perimetre}</span>
          </div>
          <div class="geo-sr-info-item geo-sr-info-item--full">
            <span class="geo-sr-info-label">${t('ranking.terrain_centre')}</span>
            <span class="geo-sr-info-value">${info.latitude.toFixed(6)}, ${info.longitude.toFixed(6)}</span>
          </div>
          <div class="geo-sr-info-item geo-sr-info-item--full">
            <span class="geo-sr-info-label">${t('ranking.terrain_zone')}</span>
            <span class="geo-sr-info-value">${info.zone_amenagement}</span>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderDetailCriteres(tr: AnalyseResultat): string {
  if (!tr.criteres || tr.criteres.length === 0) return ''
  return `
    <div class="geo-sr-card">
      <div class="geo-sr-card-header">
        <span class="geo-sr-card-header-icon">${icons.layers}</span>
        <h4 class="geo-sr-card-title">${t('ranking.resultats_criteres')}</h4>
      </div>
      ${tr.criteres.map((c) => `
        <div class="geo-sr-criteria">
          <div class="geo-sr-criteria-name">${c.critere}</div>
          <div class="geo-sr-criteria-details">
            <span class="geo-sr-criteria-dt">${t('ranking.critere_demande')}</span>
            <span class="geo-sr-criteria-dd">${c.critere_demande}</span>
            <span class="geo-sr-criteria-dt">${t('ranking.valeur_mesuree')}</span>
            <span class="geo-sr-criteria-dd">${c.valeur_mesuree}</span>
            <span class="geo-sr-criteria-dt">${t('ranking.point_interet')}</span>
            <span class="geo-sr-criteria-dd">${c.point_interet}</span>
          </div>
          <div class="geo-sr-criteria-status ${c.conforme ? 'geo-sr-criteria-status--ok' : 'geo-sr-criteria-status--ko'}">
            ${c.conforme ? '✅ ' + t('ranking.conforme') : '❌ ' + t('ranking.non_conforme')}
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function renderScores(tr: AnalyseResultat): string {
  const total = analyseResultats.length
  return `
    <div class="geo-sr-card">
      <div class="geo-sr-card-header">
        <span class="geo-sr-card-header-icon">${icons.ranking}</span>
        <h4 class="geo-sr-card-title">${t('ranking.scores_title')}</h4>
      </div>
      <div class="geo-sr-card-body">
        <div class="geo-sr-scores">
          ${scoreRow(t('ranking.score_accessibilite'), tr.score_accessibilite, '#3b82f6')}
          ${scoreRow(t('ranking.score_positionnement'), tr.score_positionnement, '#22c55e')}
          ${scoreRow(t('ranking.score_topographie'), tr.score_topographie, '#eab308')}
          ${scoreRow(t('ranking.score_global'), tr.score_global, '#8b5cf6')}
        </div>
        <div class="geo-sr-classement">
          ${t('ranking.classement_sur')} : <strong>${tr.classement}<sup>${ordinalSuffix(tr.classement)}</sup></strong> / ${total}
        </div>
      </div>
    </div>
  `
}

function scoreRow(label: string, score: number, color: string): string {
  const pct = Math.min(score, 100)
  return `
    <div class="geo-sr-score-row">
      <span class="geo-sr-score-label">${label}</span>
      <div class="geo-sr-score-bar-wrap">
        <div class="geo-sr-score-bar" style="width: ${pct}%; background: ${color};"></div>
      </div>
      <span class="geo-sr-score-value">${score.toFixed(0)}</span>
    </div>
  `
}

function ordinalSuffix(n: number): string {
  if (n === 1) return 'er'
  return 'ᵉ'
}

function renderConclusion(tr: AnalyseResultat): string {
  const s = tr.criteres_satisfaits
  const totalCriteres = tr.criteres_total
  return `
    <div class="geo-sr-card">
      <div class="geo-sr-card-header">
        <span class="geo-sr-card-header-icon">${icons.search}</span>
        <h4 class="geo-sr-card-title">${t('ranking.conclusion_title')}</h4>
      </div>
      <div class="geo-sr-conclusion">
        <p class="geo-sr-conclusion-text">${t('ranking.conclusion_conforme').replace('{s}', String(s)).replace('{t}', String(totalCriteres))}</p>
        ${tr.points_forts.length > 0 ? `
          <p class="geo-sr-conclusion-sub">${t('ranking.points_forts')}</p>
          <ul class="geo-sr-conclusion-list geo-sr-conclusion-list--forts">
            ${tr.points_forts.map((pf) => `<li>${pf.charAt(0).toUpperCase() + pf.slice(1)}</li>`).join('')}
          </ul>
        ` : ''}
        ${tr.points_faibles.length > 0 ? `
          <p class="geo-sr-conclusion-sub">${t('ranking.points_faibles')}</p>
          <ul class="geo-sr-conclusion-list geo-sr-conclusion-list--faibles">
            ${tr.points_faibles.map((pf) => `<li>${pf.charAt(0).toUpperCase() + pf.slice(1)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    </div>
  `
}

export async function mountGeoportalPage(root: HTMLElement): Promise<void> {
  const user = getStoredUser()
  if (!user) return

  const projetId = getProjectIdFromUrl()
  if (!projetId) {
    window.history.replaceState({}, '', '/projets')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return
  }

  try {
    const projet = await fetchProjet(projetId)

    root.innerHTML = renderGeoportalPage(projet)

    root.querySelector('#logout-btn')?.addEventListener('click', () => {
      clearSession()
      window.location.href = '/login'
    })

    initMap()
    setupAccordions()
    setupBasemapSwitcher()
    setupOverlayToggles()
    setupSidebarToggle()
    setupTerrainCardToggle()
    setupResetFilters()
    setupCustomDistances()
    setupAnalyse(projet.id)
    setupNotifications(root)
    setupLangSwitcher(root)

    const firstAccordion = document.querySelector<HTMLElement>('.geo-accordion-item')
    if (firstAccordion) {
      firstAccordion.classList.add('is-open')
      const content = firstAccordion.querySelector<HTMLElement>('.geo-accordion-content')
      if (content) content.style.maxHeight = content.scrollHeight + 'px'
    }
  } catch (error) {
    root.innerHTML = `
      <div class="admin-error-state">
        <p>${formatApiErrors(error)}</p>
        <a href="/projets" class="btn btn-primary">${t('projects.error_login')}</a>
      </div>
    `
  }
}

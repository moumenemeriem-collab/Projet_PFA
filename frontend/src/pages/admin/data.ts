import { icons } from '../../components/icons.ts'
import { renderAppLayout, setupAppLayout } from '../../components/layout/AppLayout.ts'
import { formatApiErrors, getStoredUser } from '../../api/auth.ts'
import {
  type Couche,
  fetchCouche,
  fetchCouches,
  importerCouche,
} from '../../api/couches.ts'

interface DataState {
  couches: Couche[]
  importLoading: number | null
}

const stateRef: { current: DataState | null } = { current: null }
let pageRoot: HTMLElement | null = null

const CATEGORIE_LABELS: Record<string, string> = {
  foncier: 'Foncier',
  urbanisme: 'Urbanisme',
  administratif: 'Administratif',
  equipements: 'Équipements',
  infrastructure: 'Infrastructure',
  topographie: 'Topographie',
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function renderContent(state: DataState): string {
  return `
    <div class="data-page">
      <div id="page-alert" class="contact-alert" hidden></div>
      <div id="page-error" class="contact-alert contact-alert--error" hidden></div>
      <div class="data-toolbar">
        <h2 class="data-page-title">Couches disponibles</h2>
        <span class="data-count">${state.couches.length} couche(s)</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom de la couche</th>
            <th>Catégorie</th>
            <th>Format</th>
            <th>Volume</th>
            <th>Date MAJ</th>
            <th>Mise à jour</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          ${state.couches.map(c => renderRow(c, state)).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderRow(c: Couche, state: DataState): string {
  const loading = state.importLoading === c.id
  const catLabel = CATEGORIE_LABELS[c.categorie] || c.categorie

  return `
    <tr class="data-tr" data-couche-id="${c.id}">
      <td class="data-td-name">
        <span class="data-table-icon">${icons.layers}</span>
        <span class="data-table-name">${c.nom_affichage}</span>
      </td>
      <td><span class="data-cat-badge data-cat--${c.categorie}">${catLabel}</span></td>
      <td class="data-td-format">${c.format_fichier || 'GeoJSON'}</td>
      <td class="data-td-volume">${c.taille_affichage || '-'}</td>
      <td class="data-td-date">${formatDate(c.date_mise_a_jour)}</td>
      <td class="data-td-actions">
        <form class="data-import-row-form" style="display:inline">
          <button type="button" class="btn btn-sm btn-outline import-trigger" ${loading ? 'disabled' : ''}>
            ${loading ? '<span class="spinner-sm"></span>' : icons.download} Importer
          </button>
          <input type="file" accept=".geojson,.json" class="import-file-input" hidden />
        </form>
      </td>
      <td class="data-td-detail">
        <button type="button" class="btn btn-sm btn-outline detail-trigger" data-couche-id="${c.id}">
          ${icons.eye} Détails
        </button>
      </td>
    </tr>
  `
}

function renderDetailModal(c: Couche): string {
  const fields = [
    { label: 'Description', value: c.description || '-' },
    { label: 'Type géométrie', value: c.type_geometrie },
    { label: 'Table liée', value: c.table_liee || '-' },
    { label: 'Format', value: c.format_fichier || 'GeoJSON' },
    { label: 'Volume', value: c.taille_affichage || '-' },
    { label: 'État', value: c.etat },
    { label: 'Attributs', value: c.attributs.map(a => `${a.nom} (${a.type})`).join(', ') || '-' },
  ]
  return `
    <div class="admin-modal-overlay" id="detail-modal">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h3>${c.nom_affichage}</h3>
          <button type="button" class="admin-modal-close" id="detail-modal-close" aria-label="Fermer">${icons.close}</button>
        </div>
        <div class="admin-modal-body">
          ${fields.map(f => `
            <div class="detail-field">
              <span class="detail-field-label">${f.label}</span>
              <span class="detail-field-value">${f.value}</span>
            </div>
          `).join('')}
        </div>
        <div class="admin-modal-actions">
          <button type="button" class="btn btn-outline" id="detail-modal-close-btn">Fermer</button>
        </div>
      </div>
    </div>
  `
}

function showAlert(id: string, message: string, isError = false): void {
  if (!pageRoot) return
  const el = pageRoot.querySelector<HTMLElement>(`#${id}`)
  if (!el) return
  el.textContent = message
  el.className = `contact-alert ${isError ? 'contact-alert--error' : 'contact-alert--success'}`
  el.hidden = false
  setTimeout(() => { el.hidden = true }, 5000)
}

function renderPage(state: DataState): void {
  if (!pageRoot) return
  stateRef.current = state
  const contentRoot = pageRoot.querySelector('.app-content')
  if (!contentRoot) return
  contentRoot.innerHTML = renderContent(state)
  bindEvents()
}

async function loadCouches(): Promise<void> {
  try {
    const couches = await fetchCouches()
    renderPage({ couches, importLoading: null })
  } catch (error) {
    showAlert('page-error', formatApiErrors(error), true)
  }
}

function bindEvents(): void {
  if (!pageRoot || !stateRef.current) return

  pageRoot.querySelectorAll('.import-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const fileInput = (btn as HTMLElement).closest('form')?.querySelector('.import-file-input') as HTMLInputElement
      fileInput?.click()
    })
  })

  pageRoot.querySelectorAll('.detail-trigger').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number((btn as HTMLElement).dataset.coucheId)
      if (!id) return
      try {
        const couche = await fetchCouche(id)
        const overlay = document.createElement('div')
        overlay.innerHTML = renderDetailModal(couche)
        document.body.appendChild(overlay.firstElementChild!)

        const closeModal = () => {
          const modal = document.querySelector('#detail-modal')
          if (modal) modal.remove()
        }

        document.querySelector('#detail-modal-close')?.addEventListener('click', closeModal)
        document.querySelector('#detail-modal-close-btn')?.addEventListener('click', closeModal)
        document.querySelector('#detail-modal')?.addEventListener('click', (e) => {
          if (e.target === e.currentTarget) closeModal()
        })
      } catch (error) {
        showAlert('page-error', formatApiErrors(error), true)
      }
    })
  })

  pageRoot.querySelectorAll('.import-file-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const fileInput = e.target as HTMLInputElement
      if (!fileInput.files || !fileInput.files.length) return
      const file = fileInput.files[0]
      const tr = fileInput.closest('tr') as HTMLElement
      const id = Number(tr?.dataset.coucheId)
      if (!id) return

      const state = stateRef.current
      if (!state) return
      renderPage({ ...state, importLoading: id })

      try {
        await importerCouche(id, file)
        showAlert('page-alert', `Import réussi pour ${file.name}`)
        await loadCouches()
      } catch (error) {
        showAlert('page-error', formatApiErrors(error), true)
        if (stateRef.current) renderPage({ ...stateRef.current, importLoading: null })
      }
    })
  })
}

export async function mountAdminDataPage(root: HTMLElement): Promise<void> {
  pageRoot = root
  const storedUser = getStoredUser()
  if (!storedUser) return

  root.innerHTML = renderAppLayout({
    user: storedUser,
    role: 'admin',
    activePage: 'data',
    content: '<div class="admin-loading"><div class="admin-loading-spinner"></div><p>Chargement...</p></div>',
  })
  setupAppLayout(root)

  try {
    const couches = await fetchCouches()
    renderPage({ couches, importLoading: null })
  } catch (error) {
    root.querySelector('.app-content')!.innerHTML = `
      <div class="admin-error-state">
        <p>${formatApiErrors(error)}</p>
      </div>
    `
  }
}

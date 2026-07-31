import { icons } from '../components/icons.ts'
import { renderAppLayout, setupAppLayout } from '../components/layout/AppLayout.ts'
import { getStoredUser } from '../api/auth.ts'
import {
  fetchProjets,
  fetchTypesProjet,
  createProjet,
  updateProjet,
  deleteProjet,
  type Projet,
  type TypeProjet,
  type ProjetPayload,
} from '../api/projets.ts'
import { t } from '../i18n/index'

let allTypes: TypeProjet[] = []

function getTypeIcon(typeNom: string): string {
  const lower = typeNom.toLowerCase()
  if (lower.includes('sidentiel') || lower.includes('residentiel')) return icons.building
  if (lower.includes('ommercial')) return icons.store
  if (lower.includes('ndustriel')) return icons.folder
  if (lower.includes('ouristique')) return icons.mapPin
  if (lower.includes('ixte')) return icons.layers
  if (lower.includes('dministratif')) return icons.user
  if (lower.includes('ducatif')) return icons.inbox
  if (lower.includes('anitaire')) return icons.check
  if (lower.includes('ogistique')) return icons.folder
  if (lower.includes('portif')) return icons.layers
  return icons.building
}

function formatBudget(value: string): string {
  const num = parseFloat(value)
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M MAD`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k MAD`
  return `${num} MAD`
}

function renderProjectCard(projet: Projet): string {
  const img = projet.image || projet.type_image_defaut || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=340&fit=crop'
  return `
    <article class="project-card" data-project-id="${projet.id}">
      <div class="project-card-image">
        <img src="${img}" alt="${projet.nom}" loading="lazy" />
      </div>
      <div class="project-card-body">
        <div class="project-card-header">
          <h3 class="project-card-title">${projet.nom}</h3>
          <button type="button" class="project-card-menu" data-action="menu" data-project-id="${projet.id}" aria-label="Options">
            ${icons.more}
          </button>
        </div>
        <span class="project-type-tag">
          ${getTypeIcon(projet.type_nom)}
          ${projet.type_nom}
        </span>
        <div class="project-metrics">
          <div class="project-metric">
            <span class="project-metric-label">${t('projects.budget')}</span>
            <span class="project-metric-value">${icons.euro} ${formatBudget(projet.budget_total)}</span>
          </div>
          <div class="project-metric">
            <span class="project-metric-label">${t('projects.surface')}</span>
            <span class="project-metric-value">${Number(projet.surface_souhaitee).toLocaleString()} m²</span>
          </div>
        </div>
        <div class="project-card-actions">
          <a href="/projets/${projet.id}/classement" class="project-classement-link">
            ${icons.ranking} ${t('projects.view_ranking')} ${icons.chevron}
          </a>
        </div>
      </div>
    </article>
  `
}

function renderProjectModal(projet: Projet | null, types: TypeProjet[]): string {
  const isEdit = !!projet
  return `
    <div class="admin-modal-overlay" id="project-modal">
      <div class="admin-modal admin-modal--wide" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h3>${isEdit ? t('projects.modal_edit') : t('projects.modal_create')}</h3>
          <button type="button" class="admin-modal-close" id="modal-close-btn" aria-label="${t('projects.btn_cancel')}">${icons.close}</button>
        </div>
        <form id="project-form" class="admin-modal-form" novalidate>
          <div id="modal-error" class="form-alert form-alert--error" hidden></div>
          <div class="form-row">
            <div class="form-field form-field--half">
              <label for="p-nom" class="form-label">${t('projects.field_nom')}</label>
              <input id="p-nom" name="nom" class="modal-input" value="${projet?.nom ?? ''}" required />
            </div>
            <div class="form-field form-field--half">
              <label for="p-id_type" class="form-label">${t('projects.field_type')}</label>
              <select id="p-id_type" name="id_type" class="modal-input" required>
                ${types.map((tp) => `<option value="${tp.id}" ${projet?.id_type === tp.id ? 'selected' : ''}>${tp.nom}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-field">
            <label for="p-description" class="form-label">${t('projects.field_description')}</label>
            <textarea id="p-description" name="description" class="modal-input" rows="3">${projet?.description ?? ''}</textarea>
          </div>
          <div class="form-row">
            <div class="form-field form-field--half">
              <label for="p-surface_souhaitee" class="form-label">${t('projects.field_surface')}</label>
              <input id="p-surface_souhaitee" name="surface_souhaitee" type="number" step="0.01" class="modal-input" value="${projet?.surface_souhaitee ?? ''}" required />
            </div>
            <div class="form-field form-field--half">
              <label for="p-budget_total" class="form-label">${t('projects.field_budget')}</label>
              <input id="p-budget_total" name="budget_total" type="number" step="0.01" class="modal-input" value="${projet?.budget_total ?? ''}" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field form-field--half">
              <label for="p-nombre_unites" class="form-label">${t('projects.field_unites')}</label>
              <input id="p-nombre_unites" name="nombre_unites" type="number" class="modal-input" value="${projet?.nombre_unites ?? ''}" />
            </div>
            <div class="form-field form-field--half">
              <label for="p-surface_construite" class="form-label">${t('projects.field_surface_construite')}</label>
              <input id="p-surface_construite" name="surface_construite" type="number" step="0.01" class="modal-input" value="${projet?.surface_construite ?? ''}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field form-field--half">
              <label for="p-prix_terrain" class="form-label">${t('projects.field_prix_terrain')}</label>
              <input id="p-prix_terrain" name="prix_terrain" type="number" step="0.01" class="modal-input" value="${projet?.prix_terrain ?? ''}" />
            </div>
            <div class="form-field form-field--half">
              <label for="p-cout_construction" class="form-label">${t('projects.field_cout_construction')}</label>
              <input id="p-cout_construction" name="cout_construction" type="number" step="0.01" class="modal-input" value="${projet?.cout_construction ?? ''}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field form-field--half">
              <label for="p-autres_charges" class="form-label">${t('projects.field_autres_charges')}</label>
              <input id="p-autres_charges" name="autres_charges" type="number" step="0.01" class="modal-input" value="${projet?.autres_charges ?? ''}" />
            </div>
            <div class="form-field form-field--half">
              <label for="p-prix_vente_unitaire" class="form-label">${t('projects.field_prix_vente')}</label>
              <input id="p-prix_vente_unitaire" name="prix_vente_unitaire" type="number" step="0.01" class="modal-input" value="${projet?.prix_vente_unitaire ?? ''}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field form-field--half">
              <label for="p-revenu_estime" class="form-label">${t('projects.field_revenu')}</label>
              <input id="p-revenu_estime" name="revenu_estime" type="number" step="0.01" class="modal-input" value="${projet?.revenu_estime ?? ''}" />
            </div>
          </div>
          <div class="form-field">
            <label for="p-image" class="form-label">${t('projects.field_image')}</label>
            <input id="p-image" name="image" type="url" class="modal-input" value="${projet?.image ?? ''}" placeholder="https://..." />
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="btn btn-outline" id="modal-cancel-btn">${t('projects.btn_cancel')}</button>
            <button type="submit" class="btn btn-primary" id="modal-submit-btn">${isEdit ? t('projects.btn_save') : t('projects.btn_create')}</button>
          </div>
        </form>
      </div>
    </div>
  `
}

function renderDetailPopup(projet: Projet): string {
  const img = projet.image || projet.type_image_defaut || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=450&fit=crop'
  const rentabilite = projet.revenu_estime
    ? (() => {
        const revenu = parseFloat(projet.revenu_estime)
        const coutTotal = [projet.prix_terrain, projet.cout_construction, projet.autres_charges]
          .filter((v): v is string => !!v)
          .reduce((acc, v) => acc + parseFloat(v), 0)
        if (coutTotal <= 0) return null
        return ((revenu - coutTotal) / coutTotal * 100).toFixed(1)
      })()
    : null

  return `
    <div class="admin-modal-overlay" id="project-detail-modal">
      <div class="admin-modal admin-modal--wide admin-modal--detail" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h3>${projet.nom}</h3>
          <button type="button" class="admin-modal-close" id="detail-close-btn" aria-label="${t('projects.btn_cancel')}">${icons.close}</button>
        </div>
        <div class="project-detail-content">
          <div class="project-detail-image">
            <img src="${img}" alt="${projet.nom}" />
            <span class="project-type-tag project-type-tag--overlay">${getTypeIcon(projet.type_nom)} ${projet.type_nom}</span>
          </div>
          <div class="project-detail-body">
            <div class="project-detail-section">
              <h4>${t('projects.detail_info')}</h4>
              <p>${projet.description || '—'}</p>
              <div class="project-detail-grid">
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.field_surface')}</span>
                  <span class="project-detail-value">${Number(projet.surface_souhaitee).toLocaleString()} m²</span>
                </div>
                ${projet.nombre_unites ? `
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.field_unites')}</span>
                  <span class="project-detail-value">${projet.nombre_unites}</span>
                </div>` : ''}
                ${projet.surface_construite ? `
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.field_surface_construite')}</span>
                  <span class="project-detail-value">${Number(projet.surface_construite).toLocaleString()} m²</span>
                </div>` : ''}
              </div>
            </div>
            <div class="project-detail-section">
              <h4>${t('projects.detail_finance')}</h4>
              <div class="project-detail-grid">
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.budget')}</span>
                  <span class="project-detail-value">${formatBudget(projet.budget_total)}</span>
                </div>
                ${projet.prix_terrain ? `
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.field_prix_terrain')}</span>
                  <span class="project-detail-value">${formatBudget(projet.prix_terrain)}</span>
                </div>` : ''}
                ${projet.cout_construction ? `
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.field_cout_construction')}</span>
                  <span class="project-detail-value">${formatBudget(projet.cout_construction)}</span>
                </div>` : ''}
                ${projet.autres_charges ? `
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.field_autres_charges')}</span>
                  <span class="project-detail-value">${formatBudget(projet.autres_charges)}</span>
                </div>` : ''}
                ${projet.prix_vente_unitaire ? `
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.field_prix_vente')}</span>
                  <span class="project-detail-value">${formatBudget(projet.prix_vente_unitaire)}</span>
                </div>` : ''}
                ${projet.revenu_estime ? `
                <div class="project-detail-item">
                  <span class="project-detail-label">${t('projects.revenu_estime')}</span>
                  <span class="project-detail-value">${formatBudget(projet.revenu_estime)}</span>
                </div>` : ''}
              </div>
            </div>
            ${rentabilite ? `
            <div class="project-detail-section">
              <h4>${t('projects.detail_rentabilite')}</h4>
              <div class="project-detail-grid">
                <div class="project-detail-item">
                  <span class="project-detail-label">ROI</span>
                  <span class="project-detail-value ${parseFloat(rentabilite) >= 0 ? 'text-success' : 'text-error'}">${rentabilite}%</span>
                </div>
              </div>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `
}

function renderMenuPopup(projet: Projet): string {
  return `
    <div class="admin-modal-overlay project-menu-overlay" id="project-menu-modal">
      <div class="project-menu-popup" role="menu">
        <button type="button" class="project-menu-item" data-action="details" data-project-id="${projet.id}">
          ${icons.eye} ${t('projects.details')}
        </button>
        <button type="button" class="project-menu-item" data-action="edit" data-project-id="${projet.id}">
          ${icons.edit} ${t('projects.btn_edit')}
        </button>
        <button type="button" class="project-menu-item project-menu-item--danger" data-action="delete" data-project-id="${projet.id}">
          ${icons.trash} ${t('projects.btn_delete')}
        </button>
      </div>
    </div>
  `
}

interface ProjectsPageState {
  projets: Projet[]
  totalCount: number
  page: number
  search: string
  typeId: number | null
  loading: boolean
  error: string | null
}

const state: ProjectsPageState = {
  projets: [],
  totalCount: 0,
  page: 1,
  search: '',
  typeId: null,
  loading: true,
  error: null,
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
let pageRoot: HTMLElement | null = null
const PAGE_SIZE = 12

function renderContent(): string {
  const total = state.totalCount
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return `
    <div class="projects-page">
      <div class="projects-page-header">
        <div>
          <h1 class="projects-title">${t('projects.title')}</h1>
          <p class="projects-subtitle">
            <span class="status-dot status-dot--inline"><span></span></span>
            ${t('projects.subtitle')}
          </p>
        </div>
        <button type="button" class="btn btn-primary btn-action btn-action--create" id="create-project-btn">
          ${icons.plus} ${t('projects.create')}
        </button>
      </div>

      <div class="projects-toolbar">
        <div class="search-field">
          ${icons.search}
          <input
            type="search"
            class="search-input"
            id="projects-search"
            placeholder="${t('projects.search_placeholder')}"
            value="${state.search}"
          />
        </div>
        <div class="toolbar-filters">
          <span class="toolbar-label">${t('projects.filter_by')}</span>
          <select class="toolbar-select" id="type-filter">
            <option value="">${t('projects.all_types')}</option>
            ${allTypes.map((tp) => `<option value="${tp.id}" ${state.typeId === tp.id ? 'selected' : ''}>${tp.nom}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-icon stat-icon--blue">${icons.folder}</span>
            <span class="stat-label">${t('projects.total_projects')}</span>
          </div>
          <p class="stat-value">${total}</p>
        </div>
      </div>

      <div class="projects-list-header">
        <h2 class="projects-list-title">${t('projects.list_title')}</h2>
        <div class="projects-list-meta">
          <span>${t('projects.showing')} ${state.projets.length} ${t('projects.on')} ${total}</span>
          ${totalPages > 1 ? `
          <div class="projects-progress">
            <div class="projects-progress-bar" style="width: ${(state.page / totalPages) * 100}%"></div>
          </div>` : ''}
        </div>
      </div>

      ${state.loading ? `
        <div class="admin-loading">
          <div class="admin-loading-spinner"></div>
          <p>${t('projects.loading')}</p>
        </div>
      ` : state.error ? `
        <div class="projects-error">
          <div class="projects-error-icon">!</div>
          <p class="projects-error-message">${state.error}</p>
          <button type="button" class="btn btn-primary" id="retry-load-btn">${t('common.retry') || 'Réessayer'}</button>
        </div>
      ` : state.projets.length === 0 ? `
        <div class="projects-grid projects-grid--empty">
          <p class="text-muted" style="grid-column: 1/-1; text-align:center; padding: 40px;">${t('projects.empty')}</p>
        </div>
      ` : `
        <div class="projects-grid">
          ${state.projets.map(renderProjectCard).join('')}
        </div>
      `}

      ${totalPages > 1 ? `
      <div class="projects-load-more">
        <button type="button" class="btn btn-outline" id="prev-page" ${state.page <= 1 ? 'disabled' : ''}>
          ${icons.chevronLeft} ${t('common.prev')}
        </button>
        <span style="padding: 0 12px; color: var(--text-muted); font-size: 0.875rem;">${state.page} / ${totalPages}</span>
        <button type="button" class="btn btn-outline" id="next-page" ${state.page >= totalPages ? 'disabled' : ''}>
          ${t('common.next')} ${icons.chevron}
        </button>
      </div>` : ''}
    </div>
  `
}

function render(): void {
  if (!pageRoot) return
  const contentRoot = pageRoot.querySelector('.app-content')
  if (!contentRoot) return
  contentRoot.innerHTML = renderContent()
  bindEvents()
}

async function loadProjets(): Promise<void> {
  state.loading = true
  state.error = null
  render()
  try {
    const params: Record<string, string | number> = { page: state.page, page_size: PAGE_SIZE }
    if (state.search) params.search = state.search
    if (state.typeId) params.type = state.typeId
    const res = await fetchProjets(params)
    state.projets = res.results
    state.totalCount = res.count
  } catch (err) {
    console.error('[projects] Failed to load projets:', err)
    state.projets = []
    state.totalCount = 0
    state.error = err instanceof Error ? err.message : 'Erreur lors du chargement des projets.'
  } finally {
    state.loading = false
    render()
  }
}

function bindEvents(): void {
  if (!pageRoot) return

  pageRoot.querySelector('#retry-load-btn')?.addEventListener('click', () => loadProjets())

  pageRoot.querySelector('#create-project-btn')?.addEventListener('click', () => {
    window.history.pushState({}, '', '/projets/nouveau')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  pageRoot.querySelector<HTMLInputElement>('#projects-search')?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      state.search = val
      state.page = 1
      loadProjets()
    }, 300)
  })

  pageRoot.querySelector<HTMLSelectElement>('#type-filter')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value
    state.typeId = val ? Number(val) : null
    state.page = 1
    loadProjets()
  })

  pageRoot.querySelector('#prev-page')?.addEventListener('click', () => {
    if (state.page > 1) { state.page--; loadProjets() }
  })

  pageRoot.querySelector('#next-page')?.addEventListener('click', () => {
    const totalPages = Math.ceil(state.totalCount / PAGE_SIZE)
    if (state.page < totalPages) { state.page++; loadProjets() }
  })

  pageRoot.querySelectorAll('[data-action="details"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number((btn as HTMLElement).dataset.projectId)
      const projet = state.projets.find((p) => p.id === id)
      if (projet) openDetailPopup(projet)
    })
  })

  pageRoot.querySelectorAll('[data-action="menu"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = Number((btn as HTMLElement).dataset.projectId)
      const projet = state.projets.find((p) => p.id === id)
      if (projet) openMenuPopup(projet, btn as HTMLElement)
    })
  })
}

function openModal(projet: Projet | null): void {
  if (!pageRoot) return
  const contentRoot = pageRoot.querySelector('.app-content')
  if (!contentRoot) return

  const existing = pageRoot.querySelector('#project-modal')
  if (existing) existing.remove()

  contentRoot.insertAdjacentHTML('beforeend', renderProjectModal(projet, allTypes))

  const overlay = pageRoot.querySelector('#project-modal')
  const form = pageRoot.querySelector<HTMLFormElement>('#project-form')
  const errorEl = pageRoot.querySelector<HTMLElement>('#modal-error')
  const submitBtn = pageRoot.querySelector<HTMLButtonElement>('#modal-submit-btn')

  const close = () => overlay?.remove()

  overlay?.querySelector('#modal-close-btn')?.addEventListener('click', close)
  overlay?.querySelector('#modal-cancel-btn')?.addEventListener('click', close)
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) close() })

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!form || !submitBtn) return
    errorEl!.hidden = true
    submitBtn.disabled = true

    const fd = new FormData(form)
    const payload: ProjetPayload = {
      nom: String(fd.get('nom') ?? '').trim(),
      description: String(fd.get('description') ?? '').trim(),
      id_type: Number(fd.get('id_type')),
      surface_souhaitee: Number(fd.get('surface_souhaitee')),
      budget_total: Number(fd.get('budget_total')),
      nombre_unites: fd.get('nombre_unites') ? Number(fd.get('nombre_unites')) : null,
      surface_construite: fd.get('surface_construite') ? Number(fd.get('surface_construite')) : null,
      prix_terrain: fd.get('prix_terrain') ? Number(fd.get('prix_terrain')) : null,
      cout_construction: fd.get('cout_construction') ? Number(fd.get('cout_construction')) : null,
      autres_charges: fd.get('autres_charges') ? Number(fd.get('autres_charges')) : null,
      prix_vente_unitaire: fd.get('prix_vente_unitaire') ? Number(fd.get('prix_vente_unitaire')) : null,
      revenu_estime: fd.get('revenu_estime') ? Number(fd.get('revenu_estime')) : null,
      image: String(fd.get('image') ?? '').trim(),
    }

    try {
      if (projet) {
        await updateProjet(projet.id, payload)
      } else {
        await createProjet(payload)
      }
      close()
      loadProjets()
    } catch (error) {
      if (errorEl) { errorEl.textContent = String(error); errorEl.hidden = false }
    } finally {
      submitBtn.disabled = false
    }
  })
}

function openDetailPopup(projet: Projet): void {
  if (!pageRoot) return
  const contentRoot = pageRoot.querySelector('.app-content')
  if (!contentRoot) return

  const existing = pageRoot.querySelector('#project-detail-modal')
  if (existing) existing.remove()

  contentRoot.insertAdjacentHTML('beforeend', renderDetailPopup(projet))

  const overlay = pageRoot.querySelector('#project-detail-modal')
  const close = () => overlay?.remove()

  overlay?.querySelector('#detail-close-btn')?.addEventListener('click', close)
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) close() })
}

function openMenuPopup(projet: Projet, anchor: HTMLElement): void {
  if (!pageRoot) return
  const contentRoot = pageRoot.querySelector('.app-content')
  if (!contentRoot) return

  const existing = pageRoot.querySelector('#project-menu-modal')
  if (existing) existing.remove()

  contentRoot.insertAdjacentHTML('beforeend', renderMenuPopup(projet))

  const popup = pageRoot.querySelector<HTMLElement>('.project-menu-popup')
  if (popup) {
    const rect = anchor.getBoundingClientRect()
    popup.style.position = 'fixed'
    popup.style.top = `${rect.bottom + 4}px`
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 180)}px`
  }

  const overlay = pageRoot.querySelector('#project-menu-modal')

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  overlay?.querySelectorAll('.project-menu-item').forEach((item) => {
    item.addEventListener('click', () => {
      overlay.remove()
      const action = (item as HTMLElement).dataset.action
      if (action === 'details') openDetailPopup(projet)
      if (action === 'edit') openModal(projet)
      if (action === 'delete') confirmDelete(projet)
    })
  })
}

async function confirmDelete(projet: Projet): Promise<void> {
  if (!confirm(t('projects.confirm_delete'))) return
  try {
    await deleteProjet(projet.id)
    loadProjets()
  } catch (error) {
    alert(String(error))
  }
}

export async function mountProjectsPage(root: HTMLElement): Promise<void> {
  pageRoot = root
  const user = getStoredUser()
  if (!user) return

  try {
    allTypes = await fetchTypesProjet()
  } catch {
    allTypes = []
  }

  root.innerHTML = renderAppLayout({
    user,
    role: 'investisseur',
    activePage: 'projects',
    content: `
      <div class="projects-page">
        <div class="admin-loading">
          <div class="admin-loading-spinner"></div>
          <p>${t('projects.loading')}</p>
        </div>
      </div>
    `,
  })
  setupAppLayout(root)

  loadProjets()
}

import { icons } from '../components/icons.ts'
import { renderAppLayout, setupAppLayout } from '../components/layout/AppLayout.ts'
import { formatApiErrors, getStoredUser } from '../api/auth.ts'
import { fetchProjet, type Projet } from '../api/projets.ts'
import { fetchTerrains, deleteTerrain, type Terrain } from '../api/terrains.ts'
import { t } from '../i18n/index'

interface ClassementState {
  projet: Projet
  terrains: Terrain[]
  search: string
  page: number
  totalCount: number
}

const PAGE_SIZE = 10
const stateRef: { current: ClassementState | null } = { current: null }
let searchTimer: ReturnType<typeof setTimeout> | null = null
let pageRoot: HTMLElement | null = null

function getProjectIdFromUrl(): number {
  const match = window.location.pathname.match(/\/projets\/(\d+)\/classement/)
  return match ? Number(match[1]) : 0
}

function scoreClass(score: number): string {
  if (score >= 7) return 'classement-score--high'
  if (score >= 4) return 'classement-score--mid'
  return 'classement-score--low'
}

function renderTerrainRow(t_: Terrain): string {
  const score = Number(t_.score)
  return `
    <tr data-terrain-id="${t_.id}">
      <td><strong>${t_.nom}</strong></td>
      <td>${Number(t_.superficie).toLocaleString()} m²</td>
      <td><span class="classement-score ${scoreClass(score)}">${score.toFixed(1)}</span></td>
      <td>
        <div class="classement-criteria">
          <span class="criteria-badge">${icons.database} ${t_.accessibilite}</span>
          <span class="criteria-badge">${icons.mapPin} ${t_.positionnement}</span>
          <span class="criteria-badge">${icons.filter} ${t_.topographie}</span>
        </div>
      </td>
      <td>${Number(t_.lat).toFixed(4)}, ${Number(t_.lng).toFixed(4)}</td>
      <td>
        <div class="classement-table-actions">
          <button type="button" class="table-action-btn table-action-btn--danger" data-action="delete" data-terrain-id="${t_.id}" title="${t('common.delete')}">${icons.trash}</button>
        </div>
      </td>
    </tr>
  `
}

function renderTable(state: ClassementState): string {
  const { terrains, page, totalCount } = state
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, totalCount)

  return `
    <div class="classement-page">
      <div class="classement-header">
        <div>
          <h2 class="classement-title">${t('ranking.title')} : ${state.projet.nom}</h2>
          <p class="classement-desc">${t('ranking.desc')}</p>
        </div>
        <div class="classement-actions">
          <a href="/projets/${state.projet.id}/classement/ajouter" class="btn btn-primary">
            ${icons.plus} ${t('ranking.add_terrain')}
          </a>
        </div>
      </div>

      <div id="page-alert" class="form-alert form-alert--success" hidden></div>
      <div id="page-error" class="form-alert form-alert--error" hidden></div>

      <div class="classement-toolbar">
        <div class="classement-search">
          ${icons.search}
          <input type="search" id="classement-search" class="classement-search-input" placeholder="${t('ranking.search_placeholder')}" value="${state.search}" />
        </div>
        <span class="classement-count">${totalCount} ${t('ranking.total_terrains')}</span>
      </div>

      <div class="classement-table-wrapper">
        <table class="classement-table">
          <thead>
            <tr>
              <th>${t('ranking.col_name')}</th>
              <th>${t('ranking.col_surface')}</th>
              <th>${t('ranking.col_score')}</th>
              <th>${t('ranking.col_criteria')}</th>
              <th>${t('ranking.col_coords')}</th>
              <th>${t('ranking.col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${terrains.length > 0
              ? terrains.map(renderTerrainRow).join('')
              : `<tr><td colspan="6" class="classement-table-empty">${t('ranking.empty')}</td></tr>`}
          </tbody>
        </table>
      </div>

      ${totalPages > 1 ? `
      <div class="classement-pagination">
        <span>${t('messages.pagination_showing')} ${start}-${end} ${t('messages.pagination_on')} ${totalCount} ${t('messages.pagination_results')}</span>
        <div class="classement-pagination-controls">
          <button type="button" class="pagination-btn" data-page="prev" ${page <= 1 ? 'disabled' : ''}>${icons.chevronLeft}</button>
          ${Array.from({ length: totalPages }, (_, i) => `<button type="button" class="pagination-btn pagination-btn--page${i + 1 === page ? ' pagination-btn--active' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('')}
          <button type="button" class="pagination-btn" data-page="next" ${page >= totalPages ? 'disabled' : ''}>${icons.chevron}</button>
        </div>
      </div>
      ` : ''}
    </div>
  `
}

function renderEmptyState(projet: Projet): string {
  return `
    <div class="classement-page">
      <div class="classement-header">
        <div>
          <h2 class="classement-title">${t('ranking.title')} : ${projet.nom}</h2>
          <p class="classement-desc">${t('ranking.desc')}</p>
        </div>
      </div>

      <div id="page-alert" class="form-alert form-alert--success" hidden></div>
      <div id="page-error" class="form-alert form-alert--error" hidden></div>

      <div class="classement-empty">
        <div class="classement-empty-icon">${icons.layers}</div>
        <h3 class="classement-empty-title">${t('ranking.empty_title')}</h3>
        <p class="classement-empty-desc">${t('ranking.empty_desc')}</p>
        <a href="/projets/${projet.id}/classement/ajouter" class="btn btn-primary">
          ${icons.plus} ${t('ranking.add_first_terrain')}
        </a>
      </div>
    </div>
  `
}

function renderContent(state: ClassementState): string {
  if (state.terrains.length === 0 && !state.search) {
    return renderEmptyState(state.projet)
  }
  return renderTable(state)
}

function renderPage(state: ClassementState): void {
  if (!pageRoot) return
  stateRef.current = state
  const contentRoot = pageRoot.querySelector('.app-content')
  if (!contentRoot) return
  contentRoot.innerHTML = renderContent(state)
  bindEvents()
}

function showPageAlert(message: string, isError = false): void {
  if (!pageRoot) return
  const el = pageRoot.querySelector<HTMLElement>(isError ? '#page-error' : '#page-alert')
  if (!el) return
  el.textContent = message
  el.hidden = false
  setTimeout(() => { el.hidden = true }, 5000)
}

function bindEvents(): void {
  if (!pageRoot || !stateRef.current) return

  pageRoot.querySelector<HTMLInputElement>('#classement-search')?.addEventListener('input', (e) => {
    const search = (e.target as HTMLInputElement).value
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(async () => {
      if (!stateRef.current) return
      try {
        const data = await fetchTerrains(stateRef.current.projet.id, { search })
        renderPage({ ...stateRef.current, terrains: data.results, totalCount: data.count, search, page: 1 })
      } catch (error) {
        showPageAlert(formatApiErrors(error), true)
      }
    }, 300)
  })

  pageRoot.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = (btn as HTMLElement).dataset.page
      if (!val || !stateRef.current) return
      let newPage = stateRef.current.page
      if (val === 'prev') newPage = Math.max(1, stateRef.current.page - 1)
      else if (val === 'next') newPage = stateRef.current.page + 1
      else newPage = Number(val)
      try {
        const data = await fetchTerrains(stateRef.current.projet.id, { page: newPage })
        renderPage({ ...stateRef.current, terrains: data.results, totalCount: data.count, page: newPage })
      } catch (error) {
        showPageAlert(formatApiErrors(error), true)
      }
    })
  })

  pageRoot.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = Number((btn as HTMLElement).dataset.terrainId)
      if (!confirm(t('ranking.confirm_delete'))) return
      if (!stateRef.current) return
      try {
        await deleteTerrain(stateRef.current.projet.id, id)
        const data = await fetchTerrains(stateRef.current.projet.id, { page: stateRef.current.page })
        renderPage({ ...stateRef.current, terrains: data.results, totalCount: data.count })
        showPageAlert(t('ranking.deleted'))
      } catch (error) {
        showPageAlert(formatApiErrors(error), true)
      }
    })
  })
}

export async function mountClassementPage(root: HTMLElement): Promise<void> {
  pageRoot = root
  const user = getStoredUser()
  if (!user) return

  const projetId = getProjectIdFromUrl()
  if (!projetId) {
    window.history.replaceState({}, '', '/projets')
    window.dispatchEvent(new PopStateEvent('popstate'))
    return
  }

  root.innerHTML = renderAppLayout({
    user,
    role: 'investisseur',
    activePage: 'ranking',
    content: `<div class="admin-loading"><div class="admin-loading-spinner"></div><p>${t('ranking.loading')}</p></div>`,
  })
  setupAppLayout(root)

  try {
    const projet = await fetchProjet(projetId)
    const data = await fetchTerrains(projetId)
    renderPage({ projet, terrains: data.results, search: '', page: 1, totalCount: data.count })
  } catch (error) {
    root.querySelector('.app-content')!.innerHTML = `
      <div class="admin-error-state">
        <p>${formatApiErrors(error)}</p>
        <a href="/projets" class="btn btn-primary">${t('projects.error_login')}</a>
      </div>
    `
  }
}

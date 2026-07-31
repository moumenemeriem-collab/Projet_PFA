import { icons } from '../../components/icons.ts'
import { renderAppLayout, setupAppLayout } from '../../components/layout/AppLayout.ts'
import { setupPasswordToggles } from '../../components/ui/FormField.ts'
import { formatApiErrors, getStoredUser } from '../../api/auth.ts'
import {
  createUser,
  deleteUser,
  exportUsersCsv,
  fetchUsers,
  getFullName,
  getInitials,
  updateUser,
  type AdminUtilisateur,
  type UserFormPayload,
} from '../../api/admin.ts'
import { t, formatDate as fmtDate } from '../../i18n/index'

const PAGE_SIZE = 10

interface UsersPageState {
  allUsers: AdminUtilisateur[]
  search: string
  roleFilter: '' | 'admin' | 'investisseur'
  page: number
  modalMode: 'create' | 'edit' | null
  editingUser: AdminUtilisateur | null
}

const stateRef: { current: UsersPageState | null } = { current: null }
let searchTimer: ReturnType<typeof setTimeout> | null = null
let pageRoot: HTMLElement | null = null

function renderUserModal(mode: 'create' | 'edit', user: AdminUtilisateur | null): string {
  const isEdit = mode === 'edit'
  return `
    <div class="admin-modal-overlay" id="user-modal">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h3>${isEdit ? t('users.modal_edit') : t('users.modal_new')}</h3>
          <button type="button" class="admin-modal-close" id="modal-close-btn" aria-label="${t('common.close')}">${icons.close}</button>
        </div>
        <form id="user-form" class="admin-modal-form" novalidate>
          <div id="modal-error" class="form-alert form-alert--error" hidden></div>
          <div class="form-row">
            <div class="form-field form-field--half">
              <label for="modal-prenom" class="form-label">${t('users.field_prenom')}</label>
              <input id="modal-prenom" name="prenom" class="modal-input" value="${user?.prenom ?? ''}" required />
            </div>
            <div class="form-field form-field--half">
              <label for="modal-nom" class="form-label">${t('users.field_nom')}</label>
              <input id="modal-nom" name="nom" class="modal-input" value="${user?.nom ?? ''}" required />
            </div>
          </div>
          <div class="form-field">
            <label for="modal-email" class="form-label">${t('users.field_email')}</label>
            <input id="modal-email" name="email" type="email" class="modal-input" value="${user?.email ?? ''}" required />
          </div>
          <div class="form-field">
            <label for="modal-telephone" class="form-label">${t('users.field_telephone')}</label>
            <input id="modal-telephone" name="telephone" type="tel" class="modal-input" value="${user?.telephone ?? ''}" />
          </div>
          <div class="form-field">
            <label for="modal-role" class="form-label">${t('users.field_role')}</label>
            <select id="modal-role" name="role" class="modal-input" required>
              <option value="investisseur" ${user?.role === 'investisseur' || !user ? 'selected' : ''}>${t('users.role_investor')}</option>
              <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>${t('users.role_admin')}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-field form-field--half">
              <label for="modal-mot_de_passe" class="form-label">${isEdit ? t('users.field_new_password') : t('users.field_password')}</label>
              <div class="input-wrapper">
                <input id="modal-mot_de_passe" name="mot_de_passe" type="password" class="modal-input modal-input--password" placeholder="${isEdit ? t('users.field_password_edit_hint') : ''}" ${isEdit ? '' : 'required minlength="8"'} />
                <button type="button" class="password-toggle" data-target="modal-mot_de_passe" aria-label="${t('users.btn_show')}">${icons.eye}</button>
              </div>
            </div>
            <div class="form-field form-field--half">
              <label for="modal-confirmer" class="form-label">${t('users.field_confirm')}</label>
              <div class="input-wrapper">
                <input id="modal-confirmer" name="confirmer_mot_de_passe" type="password" class="modal-input modal-input--password" ${isEdit ? '' : 'required minlength="8"'} />
                <button type="button" class="password-toggle" data-target="modal-confirmer" aria-label="${t('users.btn_show')}">${icons.eye}</button>
              </div>
            </div>
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="btn btn-outline" id="modal-cancel-btn">${t('users.btn_cancel')}</button>
            <button type="button" class="btn btn-text" id="modal-reset-btn">${t('common.reset')}</button>
            <button type="submit" class="btn btn-primary" id="modal-submit-btn">${isEdit ? t('users.btn_edit') : t('users.btn_create')}</button>
          </div>
        </form>
      </div>
    </div>
  `
}

function formatDate(iso: string): string {
  return fmtDate(iso)
}

function renderUserRow(user: AdminUtilisateur, _state: UsersPageState): string {
  return `
    <tr data-user-id="${user.id}">
      <td><div class="users-table-name"><span class="users-table-avatar">${getInitials(user)}</span><span>${getFullName(user)}</span></div></td>
      <td class="users-table-email">${user.email}</td>
      <td class="users-table-role"><span class="role-pill role-pill--${user.role}">${user.role}</span></td>
      <td class="users-table-date">${formatDate(user.date_creation)}</td>
      <td class="users-table-actions">
        <button type="button" class="table-action-btn" data-action="edit" data-user-id="${user.id}" title="${t('common.edit')}">${icons.edit}</button>
        <button type="button" class="table-action-btn table-action-btn--danger" data-action="delete" data-user-id="${user.id}" title="${t('common.delete')}">${icons.trash}</button>
      </td>
    </tr>
  `
}

function renderUsersContent(state: UsersPageState): string {
  const total = state.allUsers.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(state.page, totalPages)
  const pageUsers = state.allUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const end = (currentPage - 1) * PAGE_SIZE + pageUsers.length

  return `
    <div class="admin-users-page">
      <div id="page-alert" class="form-alert form-alert--success" hidden></div>
      <div id="page-error" class="form-alert form-alert--error" hidden></div>
      <div class="admin-users-header">
        <div>
          <h2 class="admin-users-title">${t('users.title')}</h2>
          <p class="admin-users-desc">${t('users.desc')}</p>
        </div>
        <div class="admin-users-actions">
          <button type="button" class="btn btn-outline btn-action-admin btn-action-admin--export" id="export-csv-btn">${icons.download} ${t('users.export_csv')}</button>
          <button type="button" class="btn btn-primary btn-action-admin btn-action-admin--create" id="create-user-btn">${icons.plus} ${t('users.new_user')}</button>
        </div>
      </div>
      <div class="users-panel">
        <div class="users-panel-toolbar">
          <div class="users-search-field">${icons.search}
            <input type="search" id="users-search" class="users-search-input" placeholder="${t('users.search_placeholder')}" value="${state.search}" />
          </div>
          <select id="role-filter" class="toolbar-select role-filter-select">
            <option value="" ${state.roleFilter === '' ? 'selected' : ''}>${t('users.all_roles')}</option>
            <option value="investisseur" ${state.roleFilter === 'investisseur' ? 'selected' : ''}>${t('users.role_investor')}</option>
            <option value="admin" ${state.roleFilter === 'admin' ? 'selected' : ''}>${t('users.role_admin')}</option>
          </select>
          <span class="users-count">${total} ${t('users.total_label')}</span>
        </div>
        <div class="users-table-wrapper">
          <table class="users-table">
            <thead>
              <tr>
                <th>${t('users.col_name')}</th><th>${t('users.col_email')}</th><th>${t('users.col_role')}</th>
                <th>${t('users.col_date')}</th>
                <th>${t('users.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              ${pageUsers.length > 0 ? pageUsers.map((u) => renderUserRow(u, state)).join('') : `<tr><td colspan="5" class="users-table-empty">${t('users.empty')}</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="users-pagination">
          <span>${t('users.pagination_showing')} ${start}-${end} ${t('users.pagination_on')} ${total} ${t('users.pagination_results')}</span>
          <div class="users-pagination-controls">
            <button type="button" class="pagination-btn" id="prev-page" ${currentPage <= 1 ? 'disabled' : ''}>${icons.chevronLeft}</button>
            ${Array.from({ length: totalPages }, (_, i) => `<button type="button" class="pagination-btn pagination-btn--page${i + 1 === currentPage ? ' pagination-btn--active' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('')}
            <button type="button" class="pagination-btn" id="next-page" ${currentPage >= totalPages ? 'disabled' : ''}>${icons.chevron}</button>
          </div>
        </div>
      </div>
    </div>
    ${state.modalMode ? renderUserModal(state.modalMode, state.editingUser) : ''}
  `
}

function showPageAlert(message: string, isError = false): void {
  if (!pageRoot) return
  const el = pageRoot.querySelector<HTMLElement>(isError ? '#page-error' : '#page-alert')
  if (!el) return
  el.textContent = message
  el.hidden = false
  setTimeout(() => { el.hidden = true }, 4000)
}

async function loadUsers(search: string, roleFilter: UsersPageState['roleFilter']): Promise<AdminUtilisateur[]> {
  const data = await fetchUsers(search, roleFilter)
  return data.results
}

function renderPage(state: UsersPageState): void {
  if (!pageRoot) return
  stateRef.current = state
  const contentRoot = pageRoot.querySelector('.app-content')
  if (!contentRoot) return
  contentRoot.innerHTML = renderUsersContent(state)
  bindPageEvents()
  if (state.modalMode) bindModalEvents()
}

function bindModalEvents(): void {
  if (!pageRoot || !stateRef.current) return
  const state = stateRef.current
  setupPasswordToggles(pageRoot)

  const overlay = pageRoot.querySelector('#user-modal')
  const form = pageRoot.querySelector<HTMLFormElement>('#user-form')
  const errorEl = pageRoot.querySelector<HTMLElement>('#modal-error')
  const submitBtn = pageRoot.querySelector<HTMLButtonElement>('#modal-submit-btn')
  const editingUser = state.editingUser
  const mode = state.modalMode

  const close = () => renderPage({ ...stateRef.current!, modalMode: null, editingUser: null })

  overlay?.querySelector('#modal-close-btn')?.addEventListener('click', close)
  overlay?.querySelector('#modal-cancel-btn')?.addEventListener('click', close)
  overlay?.querySelector('#modal-reset-btn')?.addEventListener('click', () => { form?.reset() })
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) close() })

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!form || !submitBtn || !stateRef.current) return
    if (errorEl) errorEl.hidden = true
    submitBtn.disabled = true

    const formData = new FormData(form)
    const payload: UserFormPayload = {
      prenom: String(formData.get('prenom') ?? '').trim(),
      nom: String(formData.get('nom') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      telephone: String(formData.get('telephone') ?? '').trim(),
      role: String(formData.get('role') ?? 'investisseur') as 'admin' | 'investisseur',
      mot_de_passe: String(formData.get('mot_de_passe') ?? ''),
      confirmer_mot_de_passe: String(formData.get('confirmer_mot_de_passe') ?? ''),
    }

    try {
      if (mode === 'create') {
        await createUser(payload)
        showPageAlert(t('users.success_created'))
      } else if (mode === 'edit' && editingUser) {
        const updatePayload: Partial<UserFormPayload> = {
          prenom: payload.prenom, nom: payload.nom, email: payload.email,
          telephone: payload.telephone || undefined, role: payload.role,
        }
        if (payload.mot_de_passe) {
          updatePayload.mot_de_passe = payload.mot_de_passe
          updatePayload.confirmer_mot_de_passe = payload.confirmer_mot_de_passe
        }
        await updateUser(editingUser.id, updatePayload)
        showPageAlert(t('users.success_edited'))
      }

      const current = stateRef.current
      const users = await loadUsers(current.search, current.roleFilter)
      renderPage({ ...current, allUsers: users, modalMode: null, editingUser: null })
    } catch (error) {
      if (errorEl) { errorEl.textContent = formatApiErrors(error); errorEl.hidden = false }
    } finally {
      submitBtn.disabled = false
    }
  })
}

function bindPageEvents(): void {
  if (!pageRoot || !stateRef.current) return

  pageRoot.querySelector('#create-user-btn')?.addEventListener('click', () => {
    renderPage({ ...stateRef.current!, modalMode: 'create', editingUser: null })
  })

  pageRoot.querySelector('#export-csv-btn')?.addEventListener('click', () => {
    if (stateRef.current) exportUsersCsv(stateRef.current.allUsers)
  })

  pageRoot.querySelector<HTMLInputElement>('#users-search')?.addEventListener('input', (e) => {
    const search = (e.target as HTMLInputElement).value
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(async () => {
      if (!stateRef.current) return
      try {
        const users = await loadUsers(search, stateRef.current.roleFilter)
        renderPage({ ...stateRef.current, search, allUsers: users, page: 1 })
      } catch (error) {
        showPageAlert(formatApiErrors(error), true)
      }
    }, 300)
  })

  pageRoot.querySelector<HTMLSelectElement>('#role-filter')?.addEventListener('change', async (e) => {
    const roleFilter = (e.target as HTMLSelectElement).value as UsersPageState['roleFilter']
    if (!stateRef.current) return
    try {
      const users = await loadUsers(stateRef.current.search, roleFilter)
      renderPage({ ...stateRef.current, roleFilter, allUsers: users, page: 1 })
    } catch (error) {
      showPageAlert(formatApiErrors(error), true)
    }
  })

  pageRoot.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = Number((btn as HTMLElement).dataset.userId)
      const user = stateRef.current?.allUsers.find((u) => u.id === id)
      if (user && stateRef.current) {
        renderPage({ ...stateRef.current, modalMode: 'edit', editingUser: user })
      }
    })
  })

  pageRoot.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = Number((btn as HTMLElement).dataset.userId)
      const user = stateRef.current?.allUsers.find((u) => u.id === id)
      if (!user || !stateRef.current) return
      if (!confirm(`${t('users.confirm_delete_user')} ${getFullName(user)} ?`)) return
      try {
        await deleteUser(id)
        showPageAlert(t('users.success_deleted'))
        const current = stateRef.current
        const users = await loadUsers(current.search, current.roleFilter)
        renderPage({ ...current, allUsers: users })
      } catch (error) {
        showPageAlert(formatApiErrors(error), true)
      }
    })
  })

  pageRoot.querySelector('#prev-page')?.addEventListener('click', () => {
    if (!stateRef.current || stateRef.current.page <= 1) return
    renderPage({ ...stateRef.current, page: stateRef.current.page - 1 })
  })

  pageRoot.querySelector('#next-page')?.addEventListener('click', () => {
    if (!stateRef.current) return
    const totalPages = Math.max(1, Math.ceil(stateRef.current.allUsers.length / PAGE_SIZE))
    if (stateRef.current.page >= totalPages) return
    renderPage({ ...stateRef.current, page: stateRef.current.page + 1 })
  })

  pageRoot.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = Number((btn as HTMLElement).dataset.page)
      if (page && stateRef.current) renderPage({ ...stateRef.current, page })
    })
  })
}

export async function mountAdminUsersPage(root: HTMLElement): Promise<void> {
  pageRoot = root
  const storedUser = getStoredUser()
  if (!storedUser) return

  root.innerHTML = renderAppLayout({
    user: storedUser,
    role: 'admin',
    activePage: 'users',
    content: `<div class="admin-loading"><div class="admin-loading-spinner"></div><p>${t('users.loading')}</p></div>`,
  })
  setupAppLayout(root)

  try {
    const users = await loadUsers('', '')
    renderPage({
      allUsers: users, search: '', roleFilter: '', page: 1,
      modalMode: null, editingUser: null,
    })
  } catch (error) {
    root.querySelector('.app-content')!.innerHTML = `
      <div class="admin-error-state">
        <p>${formatApiErrors(error)}</p>
        <a href="/login" class="btn btn-primary">${t('users.error_login')}</a>
      </div>
    `
  }
}

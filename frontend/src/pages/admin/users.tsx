import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { icons } from '../../components/icons'
import { DashboardLayout } from '../../components/DashboardLayout'
import { formatApiErrors } from '../../api/auth'
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
} from '../../api/admin'
import { t, formatDate } from '../../i18n/index'

const PAGE_SIZE = 10

interface AlertState {
  message: string
  isError: boolean
}

export function AdminUsersPage(): React.JSX.Element {
  const [allUsers, setAllUsers] = useState<AdminUtilisateur[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | 'admin' | 'investisseur'>('')
  const [page, setPage] = useState(1)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUtilisateur | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [initialError, setInitialError] = useState('')
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [alerts, setAlerts] = useState<Record<string, AlertState>>({})
  const alertTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const showAlert = (id: string, message: string, isError = false): void => {
    setAlerts((prev) => ({ ...prev, [id]: { message, isError } }))
    if (alertTimers.current[id]) clearTimeout(alertTimers.current[id])
    alertTimers.current[id] = setTimeout(() => {
      setAlerts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      delete alertTimers.current[id]
    }, 4000)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    const isInitial = initialLoading
    const doFetch = async (): Promise<void> => {
      try {
        const data = await fetchUsers(search, roleFilter)
        if (cancelled) return
        setAllUsers(data.results)
        if (isInitial) {
          setInitialLoading(false)
          setInitialError('')
        }
      } catch (error) {
        if (cancelled) return
        if (isInitial) {
          setInitialLoading(false)
          setInitialError(formatApiErrors(error))
        } else {
          showAlert('page-error', formatApiErrors(error), true)
        }
      }
    }
    void doFetch()
    return () => {
      cancelled = true
    }
  }, [search, roleFilter])

  const total = allUsers.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageUsers = allUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const end = (currentPage - 1) * PAGE_SIZE + pageUsers.length

  const openCreate = (): void => {
    setModalMode('create')
    setEditingUser(null)
    setModalError('')
    setShowPw(false)
    setShowPw2(false)
  }

  const openEdit = (user: AdminUtilisateur): void => {
    setModalMode('edit')
    setEditingUser(user)
    setModalError('')
    setShowPw(false)
    setShowPw2(false)
  }

  const closeModal = (): void => {
    setModalMode(null)
    setEditingUser(null)
    setModalError('')
    setShowPw(false)
    setShowPw2(false)
  }

  const handleExport = (): void => {
    exportUsersCsv(allUsers)
  }

  const handleDelete = async (user: AdminUtilisateur): Promise<void> => {
    if (!window.confirm(`${t('users.confirm_delete_user')} ${getFullName(user)} ?`)) return
    try {
      await deleteUser(user.id)
      showAlert('page-alert', t('users.success_deleted'))
      const data = await fetchUsers(search, roleFilter)
      setAllUsers(data.results)
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    }
  }

  const handleModalSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const payload: UserFormPayload = {
      prenom: String(formData.get('prenom') ?? '').trim(),
      nom: String(formData.get('nom') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      telephone: String(formData.get('telephone') ?? '').trim(),
      role: String(formData.get('role') ?? 'investisseur') as 'admin' | 'investisseur',
      mot_de_passe: String(formData.get('mot_de_passe') ?? ''),
      confirmer_mot_de_passe: String(formData.get('confirmer_mot_de_passe') ?? ''),
    }
    setSaving(true)
    setModalError('')
    try {
      if (modalMode === 'create') {
        await createUser(payload)
        showAlert('page-alert', t('users.success_created'))
      } else if (modalMode === 'edit' && editingUser) {
        const updatePayload: Partial<UserFormPayload> = {
          prenom: payload.prenom,
          nom: payload.nom,
          email: payload.email,
          telephone: payload.telephone || undefined,
          role: payload.role,
        }
        if (payload.mot_de_passe) {
          updatePayload.mot_de_passe = payload.mot_de_passe
          updatePayload.confirmer_mot_de_passe = payload.confirmer_mot_de_passe
        }
        await updateUser(editingUser.id, updatePayload)
        showAlert('page-alert', t('users.success_edited'))
      }
      const data = await fetchUsers(search, roleFilter)
      setAllUsers(data.results)
      closeModal()
    } catch (error) {
      setModalError(formatApiErrors(error))
    } finally {
      setSaving(false)
    }
  }

  const isEdit = modalMode === 'edit'
  const user = editingUser

  const userModal = (
    <div
      className="admin-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h3>{isEdit ? t('users.modal_edit') : t('users.modal_new')}</h3>
          <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={closeModal}>
            {icons.close}
          </button>
        </div>
        <form id="user-form" className="admin-modal-form" noValidate onSubmit={(e) => { void handleModalSubmit(e) }}>
          <div id="modal-error" className="form-alert form-alert--error" hidden={!modalError}>{modalError}</div>
          <div className="form-row">
            <div className="form-field form-field--half">
              <label htmlFor="modal-prenom" className="form-label">{t('users.field_prenom')}</label>
              <input id="modal-prenom" name="prenom" className="modal-input" defaultValue={user?.prenom ?? ''} required />
            </div>
            <div className="form-field form-field--half">
              <label htmlFor="modal-nom" className="form-label">{t('users.field_nom')}</label>
              <input id="modal-nom" name="nom" className="modal-input" defaultValue={user?.nom ?? ''} required />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="modal-email" className="form-label">{t('users.field_email')}</label>
            <input id="modal-email" name="email" type="email" className="modal-input" defaultValue={user?.email ?? ''} required />
          </div>
          <div className="form-field">
            <label htmlFor="modal-telephone" className="form-label">{t('users.field_telephone')}</label>
            <input id="modal-telephone" name="telephone" type="tel" className="modal-input" defaultValue={user?.telephone ?? ''} />
          </div>
          <div className="form-field">
            <label htmlFor="modal-role" className="form-label">{t('users.field_role')}</label>
            <select id="modal-role" name="role" className="modal-input" required defaultValue={user?.role ?? 'investisseur'}>
              <option value="investisseur">{t('users.role_investor')}</option>
              <option value="admin">{t('users.role_admin')}</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-field form-field--half">
              <label htmlFor="modal-mot_de_passe" className="form-label">{isEdit ? t('users.field_new_password') : t('users.field_password')}</label>
              <div className="input-wrapper">
                <input
                  id="modal-mot_de_passe"
                  name="mot_de_passe"
                  type={showPw ? 'text' : 'password'}
                  className="modal-input modal-input--password"
                  placeholder={isEdit ? t('users.field_password_edit_hint') : ''}
                  required={!isEdit}
                  minLength={isEdit ? undefined : 8}
                />
                <button type="button" className="password-toggle" aria-label={t('users.btn_show')} onClick={() => setShowPw((s) => !s)}>
                  {showPw ? icons.eyeOff : icons.eye}
                </button>
              </div>
            </div>
            <div className="form-field form-field--half">
              <label htmlFor="modal-confirmer" className="form-label">{t('users.field_confirm')}</label>
              <div className="input-wrapper">
                <input
                  id="modal-confirmer"
                  name="confirmer_mot_de_passe"
                  type={showPw2 ? 'text' : 'password'}
                  className="modal-input modal-input--password"
                  required={!isEdit}
                  minLength={isEdit ? undefined : 8}
                />
                <button type="button" className="password-toggle" aria-label={t('users.btn_show')} onClick={() => setShowPw2((s) => !s)}>
                  {showPw2 ? icons.eyeOff : icons.eye}
                </button>
              </div>
            </div>
          </div>
          <div className="admin-modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeModal}>{t('users.btn_cancel')}</button>
            <button type="button" className="btn btn-text" onClick={(e) => (e.currentTarget.closest('form') as HTMLFormElement).reset()}>
              {t('common.reset')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {isEdit ? t('users.btn_edit') : t('users.btn_create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  const listContent = (
    <div className="admin-users-page">
      <div id="page-alert" className="form-alert form-alert--success" hidden={!alerts['page-alert']}>
        {alerts['page-alert']?.message ?? ''}
      </div>
      <div id="page-error" className="form-alert form-alert--error" hidden={!alerts['page-error']}>
        {alerts['page-error']?.message ?? ''}
      </div>
      <div className="admin-users-header">
        <div>
          <h2 className="admin-users-title">{t('users.title')}</h2>
          <p className="admin-users-desc">{t('users.desc')}</p>
        </div>
        <div className="admin-users-actions">
          <button type="button" className="btn btn-outline btn-action-admin btn-action-admin--export" onClick={handleExport}>
            {icons.download} {t('users.export_csv')}
          </button>
          <button type="button" className="btn btn-primary btn-action-admin btn-action-admin--create" onClick={openCreate}>
            {icons.plus} {t('users.new_user')}
          </button>
        </div>
      </div>
      <div className="users-panel">
        <div className="users-panel-toolbar">
          <div className="users-search-field">
            {icons.search}
            <input
              type="search"
              id="users-search"
              className="users-search-input"
              placeholder={t('users.search_placeholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select
            id="role-filter"
            className="toolbar-select role-filter-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as '' | 'admin' | 'investisseur')
              setPage(1)
            }}
          >
            <option value="">{t('users.all_roles')}</option>
            <option value="investisseur">{t('users.role_investor')}</option>
            <option value="admin">{t('users.role_admin')}</option>
          </select>
          <span className="users-count">{total} {t('users.total_label')}</span>
        </div>
        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>{t('users.col_name')}</th>
                <th>{t('users.col_email')}</th>
                <th>{t('users.col_role')}</th>
                <th>{t('users.col_date')}</th>
                <th>{t('users.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.length > 0 ? (
                pageUsers.map((u) => (
                  <tr data-user-id={u.id} key={u.id}>
                    <td>
                      <div className="users-table-name">
                        <span className="users-table-avatar">{getInitials(u)}</span>
                        <span>{getFullName(u)}</span>
                      </div>
                    </td>
                    <td className="users-table-email">{u.email}</td>
                    <td className="users-table-role">
                      <span className={`role-pill role-pill--${u.role}`}>{u.role}</span>
                    </td>
                    <td className="users-table-date">{formatDate(u.date_creation)}</td>
                    <td className="users-table-actions">
                      <button type="button" className="table-action-btn" title={t('common.edit')} onClick={() => openEdit(u)}>
                        {icons.edit}
                      </button>
                      <button
                        type="button"
                        className="table-action-btn table-action-btn--danger"
                        title={t('common.delete')}
                        onClick={() => { void handleDelete(u) }}
                      >
                        {icons.trash}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="users-table-empty">{t('users.empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="users-pagination">
          <span>
            {t('users.pagination_showing')} {start}-{end} {t('users.pagination_on')} {total} {t('users.pagination_results')}
          </span>
          <div className="users-pagination-controls">
            <button type="button" className="pagination-btn" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              {icons.chevronLeft}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                type="button"
                className={`pagination-btn pagination-btn--page${p === currentPage ? ' pagination-btn--active' : ''}`}
                data-page={p}
                key={p}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button type="button" className="pagination-btn" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              {icons.chevron}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  let content: React.ReactNode
  if (initialLoading) {
    content = (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>{t('users.loading')}</p>
      </div>
    )
  } else if (initialError) {
    content = (
      <div className="admin-error-state">
        <p>{initialError}</p>
        <Link to="/login" className="btn btn-primary">{t('users.error_login')}</Link>
      </div>
    )
  } else {
    content = listContent
  }

  return (
    <DashboardLayout role="admin" activePage="users">
      {content}
      {modalMode ? userModal : null}
    </DashboardLayout>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import {
  createProjet,
  deleteProjet,
  fetchProjets,
  fetchTypesProjet,
  updateProjet,
  type Projet,
  type ProjetPayload,
  type TypeProjet,
} from '../api/projets'
import { t } from '../i18n/index'

const PAGE_SIZE = 9

interface ProjectFormValues {
  nom: string
  description: string
  id_type: string
  surface_souhaitee: string
  budget_total: string
  nombre_unites: string
  surface_construite: string
  prix_terrain: string
  cout_construction: string
  autres_charges: string
  prix_vente_unitaire: string
  revenu_estime: string
  image: string
}

const EMPTY_FORM: ProjectFormValues = {
  nom: '',
  description: '',
  id_type: '',
  surface_souhaitee: '',
  budget_total: '',
  nombre_unites: '',
  surface_construite: '',
  prix_terrain: '',
  cout_construction: '',
  autres_charges: '',
  prix_vente_unitaire: '',
  revenu_estime: '',
  image: '',
}

function getTypeIcon(typeNom: string): React.JSX.Element {
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

function projectImage(projet: Projet, w: number, h: number): string {
  return projet.image || projet.type_image_defaut || `https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=${w}&h=${h}&fit=crop`
}

function formFromProjet(projet: Projet): ProjectFormValues {
  return {
    nom: projet.nom,
    description: projet.description,
    id_type: String(projet.id_type),
    surface_souhaitee: projet.surface_souhaitee,
    budget_total: projet.budget_total,
    nombre_unites: projet.nombre_unites != null ? String(projet.nombre_unites) : '',
    surface_construite: projet.surface_construite ?? '',
    prix_terrain: projet.prix_terrain ?? '',
    cout_construction: projet.cout_construction ?? '',
    autres_charges: projet.autres_charges ?? '',
    prix_vente_unitaire: projet.prix_vente_unitaire ?? '',
    revenu_estime: projet.revenu_estime ?? '',
    image: projet.image ?? '',
  }
}

export function ProjectsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [projets, setProjets] = useState<Projet[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [allTypes, setAllTypes] = useState<TypeProjet[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editProjet, setEditProjet] = useState<Projet | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectFormValues>(EMPTY_FORM)
  const [detailProjet, setDetailProjet] = useState<Projet | null>(null)
  const [menuProjet, setMenuProjet] = useState<Projet | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    fetchTypesProjet().then(setAllTypes).catch(() => setAllTypes([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput)
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
    if (search) params.search = search
    if (typeId) params.type = typeId
    fetchProjets(params)
      .then((res) => {
        if (cancelled) return
        setProjets(res.results)
        setTotalCount(res.count)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[projects] Failed to load projets:', err)
        setProjets([])
        setTotalCount(0)
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des projets.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, search, typeId, reloadKey])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, totalCount)
  const rentabilite = detailProjet?.rentabilite ?? null

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, projet: Projet): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 180) })
    setMenuProjet(projet)
  }

  const openEdit = (projet: Projet): void => {
    setEditProjet(projet)
    setForm(formFromProjet(projet))
    setModalError(null)
    setModalOpen(true)
  }

  const openDetail = (projet: Projet): void => {
    setMenuProjet(null)
    setDetailProjet(projet)
  }

  const handleMenuEdit = (): void => {
    if (!menuProjet) return
    const projet = menuProjet
    setMenuProjet(null)
    openEdit(projet)
  }

  const handleMenuDelete = async (): Promise<void> => {
    if (!menuProjet) return
    const projet = menuProjet
    setMenuProjet(null)
    if (!window.confirm(t('projects.confirm_delete'))) return
    try {
      await deleteProjet(projet.id)
      setReloadKey((k) => k + 1)
    } catch (err) {
      window.alert(String(err))
    }
  }

  const resetModalForm = (): void => {
    if (!editProjet) return
    setForm(formFromProjet(editProjet))
    setModalError(null)
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const val = e.target.value
    setTypeId(val ? Number(val) : null)
    setPage(1)
  }

  const handleModalSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setModalError(null)
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const payload: ProjetPayload = {
      nom: String(fd.get('nom') ?? '').trim(),
      description: String(fd.get('description') ?? '').trim(),
      id_type: Number(fd.get('id_type')),
      surface_souhaitee: Number(fd.get('surface_souhaitee')),
      budget_total: Number(fd.get('budget_total')),
      nombre_unites: fd.get('nombre_unites') ? Number(fd.get('nombre_unites')) : undefined,
      surface_construite: fd.get('surface_construite') ? Number(fd.get('surface_construite')) : undefined,
      prix_terrain: fd.get('prix_terrain') ? Number(fd.get('prix_terrain')) : undefined,
      cout_construction: fd.get('cout_construction') ? Number(fd.get('cout_construction')) : undefined,
      autres_charges: fd.get('autres_charges') ? Number(fd.get('autres_charges')) : undefined,
      prix_vente_unitaire: fd.get('prix_vente_unitaire') ? Number(fd.get('prix_vente_unitaire')) : undefined,
      revenu_estime: fd.get('revenu_estime') ? Number(fd.get('revenu_estime')) : undefined,
      image: String(fd.get('image') ?? '').trim(),
    }
    try {
      if (editProjet) {
        await updateProjet(editProjet.id, payload)
      } else {
        await createProjet(payload)
      }
      setModalOpen(false)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setModalError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const renderProjectCard = (projet: Projet): React.JSX.Element => {
    const img = projectImage(projet, 600, 340)
    return (
      <article className="project-card" data-project-id={projet.id}>
        <div className="project-card-image">
          <img src={img} alt={projet.nom} loading="lazy" />
        </div>
        <div className="project-card-body">
          <div className="project-card-header">
            <h3 className="project-card-title">{projet.nom}</h3>
            <button type="button" className="project-card-menu" data-action="menu" data-project-id={projet.id} aria-label="Options" onClick={(e) => openMenu(e, projet)}>
              {icons.more}
            </button>
          </div>
          <span className="project-type-tag">
            {getTypeIcon(projet.type_nom)}
            {projet.type_nom}
          </span>
          <div className="project-metrics">
            <div className="project-metric">
              <span className="project-metric-label">{t('projects.budget')}</span>
              <span className="project-metric-value">{icons.euro} {formatBudget(projet.budget_total)}</span>
            </div>
            <div className="project-metric">
              <span className="project-metric-label">{t('projects.surface')}</span>
              <span className="project-metric-value">{Number(projet.surface_souhaitee).toLocaleString()} m²</span>
            </div>
          </div>
          <div className="project-card-actions">
            <Link to={`/projets/${projet.id}/classement`} className="project-classement-link">
              {icons.ranking} {t('projects.view_ranking')} {icons.chevron}
            </Link>
          </div>
        </div>
      </article>
    )
  }

  return (
    <DashboardLayout role="investisseur" activePage="projects">
      <div className="projects-page">
        <div className="projects-page-header">
          <div>
            <h1 className="projects-title">{t('projects.title')}</h1>
            <p className="projects-subtitle">
              <span className="status-dot status-dot--inline"><span></span></span>
              {t('projects.subtitle')}
            </p>
          </div>
          <button type="button" className="btn btn-primary btn-action btn-action--create" id="create-project-btn" onClick={() => navigate('/projets/nouveau')}>
            {icons.plus} {t('projects.create')}
          </button>
        </div>

        <div className="projects-toolbar">
          <div className="search-field">
            {icons.search}
            <input
              type="search"
              className="search-input"
              id="projects-search"
              placeholder={t('projects.search_placeholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="toolbar-filters">
            <span className="toolbar-label">{t('projects.filter_by')}</span>
            <select className="toolbar-select" id="type-filter" value={typeId === null ? '' : typeId} onChange={handleTypeChange}>
              <option value="">{t('projects.all_types')}</option>
              {allTypes.map((tp) => <option key={tp.id} value={tp.id}>{tp.nom}</option>)}
            </select>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-icon stat-icon--blue">{icons.folder}</span>
              <span className="stat-label">{t('projects.total_projects')}</span>
            </div>
            <p className="stat-value">{totalCount}</p>
          </div>
        </div>

        <div className="projects-list-header">
          <h2 className="projects-list-title">{t('projects.list_title')}</h2>
          <div className="projects-list-meta">
            <span>{t('messages.pagination_showing')} {start}-{end} {t('messages.pagination_on')} {totalCount} {t('messages.pagination_results')}</span>
            {totalPages > 1 ? (
              <div className="projects-progress">
                <div className="projects-progress-bar" style={{ width: `${(page / totalPages) * 100}%` }}></div>
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="admin-loading">
            <div className="admin-loading-spinner"></div>
            <p>{t('projects.loading')}</p>
          </div>
        ) : error ? (
          <div className="projects-error">
            <div className="projects-error-icon">!</div>
            <p className="projects-error-message">{error}</p>
            <button type="button" className="btn btn-primary" id="retry-load-btn" onClick={() => setReloadKey((k) => k + 1)}>{t('common.retry') || 'Réessayer'}</button>
          </div>
        ) : projets.length === 0 ? (
          <div className="projects-grid projects-grid--empty">
            <p className="text-muted" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>{t('projects.empty')}</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projets.map((p) => renderProjectCard(p))}
          </div>
        )}

        {totalCount > 0 ? (
          <div className="users-pagination">
            <span className="pagination-info">
              {t('messages.pagination_showing')} {start}-{end} {t('messages.pagination_on')} {totalCount}{' '}
              {t('messages.pagination_results')}
            </span>
            <div className="users-pagination-controls">
              <button type="button" className="pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {icons.chevronLeft} {t('messages.pagination_prev')}
              </button>
              {Array.from({ length: totalPages }, (_, i) => {
                const p = i + 1
                if (totalPages > 7) {
                  if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                    return (
                      <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === page ? ' pagination-btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                    )
                  }
                  if (p === page - 2 || p === page + 2) {
                    return <span className="pagination-ellipsis" key={i}>...</span>
                  }
                  return null
                }
                return (
                  <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === page ? ' pagination-btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                )
              })}
              <button type="button" className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                {t('messages.pagination_next')} {icons.chevron}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="admin-modal-overlay" id="project-modal" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="admin-modal admin-modal--wide" role="dialog" aria-modal="true">
            <div className="admin-modal-header">
              <h3>{editProjet ? t('projects.modal_edit') : t('projects.modal_create')}</h3>
              <button type="button" className="admin-modal-close" id="modal-close-btn" aria-label={t('projects.btn_cancel')} onClick={() => setModalOpen(false)}>{icons.close}</button>
            </div>
            <form id="project-form" className="admin-modal-form" noValidate onSubmit={handleModalSubmit}>
              <div id="modal-error" className="form-alert form-alert--error" hidden={!modalError}>{modalError}</div>
              <div className="form-row">
                <div className="form-field form-field--half">
                  <label htmlFor="p-nom" className="form-label">{t('projects.field_nom')}</label>
                  <input id="p-nom" name="nom" className="modal-input" value={form.nom} onChange={handleFormChange} required />
                </div>
                <div className="form-field form-field--half">
                  <label htmlFor="p-id_type" className="form-label">{t('projects.field_type')}</label>
                  <select id="p-id_type" name="id_type" className="modal-input" value={form.id_type} onChange={handleFormChange} required>
                    {allTypes.map((tp) => <option key={tp.id} value={tp.id}>{tp.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="p-description" className="form-label">{t('projects.field_description')}</label>
                <textarea id="p-description" name="description" className="modal-input" rows={3} value={form.description} onChange={handleFormChange}></textarea>
              </div>
              <div className="form-row">
                <div className="form-field form-field--half">
                  <label htmlFor="p-surface_souhaitee" className="form-label">{t('projects.field_surface')}</label>
                  <input id="p-surface_souhaitee" name="surface_souhaitee" type="number" step="0.01" className="modal-input" value={form.surface_souhaitee} onChange={handleFormChange} required />
                </div>
                <div className="form-field form-field--half">
                  <label htmlFor="p-budget_total" className="form-label">{t('projects.field_budget')}</label>
                  <input id="p-budget_total" name="budget_total" type="number" step="0.01" className="modal-input" value={form.budget_total} onChange={handleFormChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field form-field--half">
                  <label htmlFor="p-nombre_unites" className="form-label">{t('projects.field_unites')}</label>
                  <input id="p-nombre_unites" name="nombre_unites" type="number" className="modal-input" value={form.nombre_unites} onChange={handleFormChange} />
                </div>
                <div className="form-field form-field--half">
                  <label htmlFor="p-surface_construite" className="form-label">{t('projects.field_surface_construite')}</label>
                  <input id="p-surface_construite" name="surface_construite" type="number" step="0.01" className="modal-input" value={form.surface_construite} onChange={handleFormChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field form-field--half">
                  <label htmlFor="p-prix_terrain" className="form-label">{t('projects.field_prix_terrain')}</label>
                  <input id="p-prix_terrain" name="prix_terrain" type="number" step="0.01" className="modal-input" value={form.prix_terrain} onChange={handleFormChange} />
                </div>
                <div className="form-field form-field--half">
                  <label htmlFor="p-cout_construction" className="form-label">{t('projects.field_cout_construction')}</label>
                  <input id="p-cout_construction" name="cout_construction" type="number" step="0.01" className="modal-input" value={form.cout_construction} onChange={handleFormChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field form-field--half">
                  <label htmlFor="p-autres_charges" className="form-label">{t('projects.field_autres_charges')}</label>
                  <input id="p-autres_charges" name="autres_charges" type="number" step="0.01" className="modal-input" value={form.autres_charges} onChange={handleFormChange} />
                </div>
                <div className="form-field form-field--half">
                  <label htmlFor="p-prix_vente_unitaire" className="form-label">{t('projects.field_prix_vente')}</label>
                  <input id="p-prix_vente_unitaire" name="prix_vente_unitaire" type="number" step="0.01" className="modal-input" value={form.prix_vente_unitaire} onChange={handleFormChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field form-field--half">
                  <label htmlFor="p-revenu_estime" className="form-label">{t('projects.field_revenu')}</label>
                  <input id="p-revenu_estime" name="revenu_estime" type="number" step="0.01" className="modal-input" value={form.revenu_estime} onChange={handleFormChange} />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="p-image" className="form-label">{t('projects.field_image')}</label>
                <input id="p-image" name="image" type="url" className="modal-input" value={form.image} onChange={handleFormChange} placeholder="https://..." />
              </div>
              <div className="admin-modal-actions">
                {editProjet ? <button type="button" className="btn btn-outline" id="modal-reset-btn" onClick={resetModalForm}>{t('projects.btn_reset')}</button> : null}
                <button type="submit" className="btn btn-primary" id="modal-submit-btn" disabled={submitting}>{editProjet ? t('projects.btn_save') : t('projects.btn_create')}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailProjet ? (
        <div className="admin-modal-overlay" id="project-detail-modal" onClick={(e) => { if (e.target === e.currentTarget) setDetailProjet(null) }}>
          <div className="admin-modal admin-modal--wide admin-modal--detail" role="dialog" aria-modal="true">
            <div className="admin-modal-header">
              <h3>{detailProjet.nom}</h3>
              <button type="button" className="admin-modal-close" id="detail-close-btn" aria-label={t('projects.btn_cancel')} onClick={() => setDetailProjet(null)}>{icons.close}</button>
            </div>
            <div className="project-detail-content">
              <div className="project-detail-image">
                <img src={projectImage(detailProjet, 800, 450)} alt={detailProjet.nom} />
                <span className="project-type-tag project-type-tag--overlay">{getTypeIcon(detailProjet.type_nom)} {detailProjet.type_nom}</span>
              </div>
              <div className="project-detail-body">
                <div className="project-detail-section">
                  <h4>{t('projects.detail_info')}</h4>
                  <p>{detailProjet.description || '—'}</p>
                  <div className="project-detail-grid">
                    <div className="project-detail-item">
                      <span className="project-detail-label">{t('projects.field_surface')}</span>
                      <span className="project-detail-value">{Number(detailProjet.surface_souhaitee).toLocaleString()} m²</span>
                    </div>
                    {detailProjet.nombre_unites ? (
                      <div className="project-detail-item">
                        <span className="project-detail-label">{t('projects.field_unites')}</span>
                        <span className="project-detail-value">{detailProjet.nombre_unites}</span>
                      </div>
                    ) : null}
                    {detailProjet.surface_construite ? (
                      <div className="project-detail-item">
                        <span className="project-detail-label">{t('projects.field_surface_construite')}</span>
                        <span className="project-detail-value">{Number(detailProjet.surface_construite).toLocaleString()} m²</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="project-detail-section">
                  <h4>{t('projects.detail_finance')}</h4>
                  <div className="project-detail-grid">
                    <div className="project-detail-item">
                      <span className="project-detail-label">{t('projects.budget')}</span>
                      <span className="project-detail-value">{formatBudget(detailProjet.budget_total)}</span>
                    </div>
                    {detailProjet.prix_terrain ? (
                      <div className="project-detail-item">
                        <span className="project-detail-label">{t('projects.field_prix_terrain')}</span>
                        <span className="project-detail-value">{formatBudget(detailProjet.prix_terrain)}</span>
                      </div>
                    ) : null}
                    {detailProjet.cout_construction ? (
                      <div className="project-detail-item">
                        <span className="project-detail-label">{t('projects.field_cout_construction')}</span>
                        <span className="project-detail-value">{formatBudget(detailProjet.cout_construction)}</span>
                      </div>
                    ) : null}
                    {detailProjet.autres_charges ? (
                      <div className="project-detail-item">
                        <span className="project-detail-label">{t('projects.field_autres_charges')}</span>
                        <span className="project-detail-value">{formatBudget(detailProjet.autres_charges)}</span>
                      </div>
                    ) : null}
                    {detailProjet.prix_vente_unitaire ? (
                      <div className="project-detail-item">
                        <span className="project-detail-label">{t('projects.field_prix_vente')}</span>
                        <span className="project-detail-value">{formatBudget(detailProjet.prix_vente_unitaire)}</span>
                      </div>
                    ) : null}
                    {detailProjet.revenu_estime ? (
                      <div className="project-detail-item">
                        <span className="project-detail-label">{t('projects.revenu_estime')}</span>
                        <span className="project-detail-value">{formatBudget(detailProjet.revenu_estime)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {rentabilite && rentabilite.ok ? (
                  <div className="project-detail-section">
                    <h4>{t('projects.detail_rentabilite')}</h4>
                    <div className="project-detail-grid">
                      {rentabilite.surfaces?.surface_vendable != null ? (
                        <div className="project-detail-item">
                          <span className="project-detail-label">{t('projects.res_surface')}</span>
                          <span className="project-detail-value">{Number(rentabilite.surfaces.surface_vendable).toLocaleString()} m²</span>
                        </div>
                      ) : null}
                      {rentabilite.ca?.ca_total != null ? (
                        <div className="project-detail-item">
                          <span className="project-detail-label">{t('projects.res_ca')}</span>
                          <span className="project-detail-value">{formatBudget(String(rentabilite.ca.ca_total))}</span>
                        </div>
                      ) : null}
                      {rentabilite.cout_total_projet != null ? (
                        <div className="project-detail-item">
                          <span className="project-detail-label">{t('projects.res_cout_total')}</span>
                          <span className="project-detail-value">{formatBudget(String(rentabilite.cout_total_projet))}</span>
                        </div>
                      ) : null}
                      {rentabilite.tri != null ? (
                        <div className="project-detail-item">
                          <span className="project-detail-label">{t('projects.res_tri')}</span>
                          <span className={`project-detail-value ${rentabilite.tri >= 0 ? 'text-success' : 'text-error'}`}>
                            {rentabilite.tri}%
                          </span>
                        </div>
                      ) : null}
                      {rentabilite.benefice_net != null ? (
                        <div className="project-detail-item">
                          <span className="project-detail-label">{t('projects.res_benefice')}</span>
                          <span className={`project-detail-value ${rentabilite.benefice_net >= 0 ? 'text-success' : 'text-error'}`}>
                            {formatBudget(String(rentabilite.benefice_net))}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {menuProjet ? (
        <div className="admin-modal-overlay project-menu-overlay" id="project-menu-modal" onClick={(e) => { if (e.target === e.currentTarget) setMenuProjet(null) }}>
          <div className="project-menu-popup" role="menu" style={menuPos ? { position: 'fixed', top: `${menuPos.top}px`, left: `${menuPos.left}px` } : undefined}>
            <button type="button" className="project-menu-item" data-action="details" onClick={() => openDetail(menuProjet)}>
              {icons.eye} {t('projects.details')}
            </button>
            <button type="button" className="project-menu-item" data-action="edit" onClick={handleMenuEdit}>
              {icons.edit} {t('projects.btn_edit')}
            </button>
            <button type="button" className="project-menu-item project-menu-item--danger" data-action="delete" onClick={() => { void handleMenuDelete() }}>
              {icons.trash} {t('projects.btn_delete')}
            </button>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

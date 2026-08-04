import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { fetchProjets, type Projet } from '../api/projets'
import { t } from '../i18n/index'

const PAGE_SIZE = 9

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

export function RankingProjectsPage(): React.JSX.Element {
  const [projets, setProjets] = useState<Projet[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchProjets({ page, page_size: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setProjets(res.results)
        setTotalCount(res.count)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des projets.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <DashboardLayout role="investisseur" activePage="ranking">
      <div className="classement-select-page">
        <div className="classement-select-header">
          <div>
            <h1 className="classement-select-title">{t('ranking.select_title')}</h1>
            <p className="classement-select-desc">{t('ranking.select_desc')}</p>
          </div>
          <Link to="/projets/nouveau" className="btn btn-primary btn-action">
            {icons.plus} {t('ranking.select_create')}
          </Link>
        </div>

        {loading ? (
          <div className="admin-loading">
            <div className="admin-loading-spinner"></div>
            <p>{t('ranking.loading')}</p>
          </div>
        ) : error ? (
          <div className="projects-error">
            <div className="projects-error-icon">!</div>
            <p className="projects-error-message">{error}</p>
          </div>
        ) : projets.length === 0 ? (
          <div className="classement-select-empty">
            <span className="classement-select-empty-icon">{icons.layers}</span>
            <h3 className="classement-select-empty-title">{t('ranking.select_empty')}</h3>
            <p className="classement-select-empty-desc">{t('ranking.select_empty_desc')}</p>
            <Link to="/projets/nouveau" className="btn btn-primary">
              {icons.plus} {t('ranking.select_create')}
            </Link>
          </div>
        ) : (
          <>
            <div className="classement-select-list-header">
              <h2 className="classement-select-list-title">{t('ranking.select_list_title')}</h2>
              <span className="classement-select-count">
                {totalCount} {t('ranking.total_projects')}
              </span>
            </div>
            <div className="projects-grid">
              {projets.map((p) => (
                <article className="project-card" key={p.id}>
                  <div className="project-card-image">
                    <img src={projectImage(p, 600, 340)} alt={p.nom} loading="lazy" />
                  </div>
                  <div className="project-card-body">
                    <div className="project-card-header">
                      <h3 className="project-card-title">{p.nom}</h3>
                    </div>
                    <span className="project-type-tag">
                      {getTypeIcon(p.type_nom)}
                      {p.type_nom}
                    </span>
                    <div className="project-metrics">
                      <div className="project-metric">
                        <span className="project-metric-label">{t('projects.budget')}</span>
                        <span className="project-metric-value">{icons.euro} {formatBudget(p.budget_total)}</span>
                      </div>
                      <div className="project-metric">
                        <span className="project-metric-label">{t('projects.surface')}</span>
                        <span className="project-metric-value">{Number(p.surface_souhaitee).toLocaleString()} m²</span>
                      </div>
                    </div>
                    <div className="project-card-actions">
                      <Link to={`/projets/${p.id}/classement`} className="btn btn-primary project-classement-btn">
                        {icons.ranking} {t('projects.view_ranking')}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

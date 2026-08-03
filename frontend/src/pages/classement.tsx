import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { formatApiErrors } from '../api/auth'
import { fetchProjet, type Projet } from '../api/projets'
import { deleteTerrain, fetchTerrains, type Terrain } from '../api/terrains'
import { t } from '../i18n/index'

const PAGE_SIZE = 10

interface AlertState {
  type: 'success' | 'error'
  message: string
}

function scoreClass(score: number): string {
  if (score >= 7) return 'classement-score--high'
  if (score >= 4) return 'classement-score--mid'
  return 'classement-score--low'
}

function renderTerrainRow(t_: Terrain, onDelete: (id: number) => void): React.JSX.Element {
  const score = Number(t_.score)
  return (
    <tr data-terrain-id={t_.id}>
      <td><strong>{t_.nom}</strong></td>
      <td>{Number(t_.superficie).toLocaleString()} m²</td>
      <td><span className={`classement-score ${scoreClass(score)}`}>{score.toFixed(1)}</span></td>
      <td>
        <div className="classement-criteria">
          <span className="criteria-badge">{icons.database} {t_.accessibilite}</span>
          <span className="criteria-badge">{icons.mapPin} {t_.positionnement}</span>
          <span className="criteria-badge">{icons.filter} {t_.topographie}</span>
        </div>
      </td>
      <td>{Number(t_.lat).toFixed(4)}, {Number(t_.lng).toFixed(4)}</td>
      <td>
        <div className="classement-table-actions">
          <button type="button" className="table-action-btn table-action-btn--danger" data-action="delete" data-terrain-id={t_.id} title={t('common.delete')} onClick={() => onDelete(t_.id)}>{icons.trash}</button>
        </div>
      </td>
    </tr>
  )
}

export function ClassementPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const projetId = Number(id)
  const [projet, setProjet] = useState<Projet | null>(null)
  const [terrains, setTerrains] = useState<Terrain[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (!id || !Number.isInteger(projetId) || projetId <= 0) {
      navigate('/projets', { replace: true })
    }
  }, [id, projetId, navigate])

  useEffect(() => {
    if (!projetId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchProjet(projetId), fetchTerrains(projetId)])
      .then(([p, data]) => {
        if (cancelled) return
        setProjet(p)
        setTerrains(data.results)
        setTotalCount(data.count)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(formatApiErrors(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projetId])

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
    if (!projetId) return
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      return
    }
    let cancelled = false
    fetchTerrains(projetId, { search, page })
      .then((data) => {
        if (cancelled) return
        setTerrains(data.results)
        setTotalCount(data.count)
      })
      .catch((err) => {
        if (cancelled) return
        setAlert({ type: 'error', message: formatApiErrors(err) })
      })
    return () => {
      cancelled = true
    }
  }, [projetId, search, page])

  useEffect(() => {
    if (!alert) return
    const timer = setTimeout(() => setAlert(null), 5000)
    return () => clearTimeout(timer)
  }, [alert])

  const handleDelete = async (terrainId: number): Promise<void> => {
    if (!projetId || !window.confirm(t('ranking.confirm_delete'))) return
    try {
      await deleteTerrain(projetId, terrainId)
      const data = await fetchTerrains(projetId, { search, page })
      setTerrains(data.results)
      setTotalCount(data.count)
      setAlert({ type: 'success', message: t('ranking.deleted') })
    } catch (err) {
      setAlert({ type: 'error', message: formatApiErrors(err) })
    }
  }

  if (loading && !error) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking">
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>{t('ranking.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !projet) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking">
        <div className="admin-error-state">
          <p>{error ?? t('ranking.loading')}</p>
          <Link to="/projets" className="btn btn-primary">{t('projects.error_login')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  if (terrains.length === 0 && !search) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking">
        <div className="classement-page">
          <div className="classement-header">
            <div>
              <h2 className="classement-title">{t('ranking.title')} : {projet.nom}</h2>
              <p className="classement-desc">{t('ranking.desc')}</p>
            </div>
          </div>

          <div id="page-alert" className="form-alert form-alert--success" hidden={!(alert?.type === 'success')}>{alert?.type === 'success' ? alert.message : ''}</div>
          <div id="page-error" className="form-alert form-alert--error" hidden={!(alert?.type === 'error')}>{alert?.type === 'error' ? alert.message : ''}</div>

          <div className="classement-empty">
            <div className="classement-empty-icon">{icons.layers}</div>
            <h3 className="classement-empty-title">{t('ranking.empty_title')}</h3>
            <p className="classement-empty-desc">{t('ranking.empty_desc')}</p>
            <Link to={`/projets/${projet.id}/classement/ajouter`} className="btn btn-primary">
              {icons.plus} {t('ranking.add_first_terrain')}
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <DashboardLayout role="investisseur" activePage="ranking">
      <div className="classement-page">
        <div className="classement-header">
          <div>
            <h2 className="classement-title">{t('ranking.title')} : {projet.nom}</h2>
            <p className="classement-desc">{t('ranking.desc')}</p>
          </div>
          <div className="classement-actions">
            <Link to={`/projets/${projet.id}/classement/ajouter`} className="btn btn-primary">
              {icons.plus} {t('ranking.add_terrain')}
            </Link>
          </div>
        </div>

        <div id="page-alert" className="form-alert form-alert--success" hidden={!(alert?.type === 'success')}>{alert?.type === 'success' ? alert.message : ''}</div>
        <div id="page-error" className="form-alert form-alert--error" hidden={!(alert?.type === 'error')}>{alert?.type === 'error' ? alert.message : ''}</div>

        <div className="classement-toolbar">
          <div className="classement-search">
            {icons.search}
            <input type="search" id="classement-search" className="classement-search-input" placeholder={t('ranking.search_placeholder')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <span className="classement-count">{totalCount} {t('ranking.total_terrains')}</span>
        </div>

        <div className="classement-table-wrapper">
          <table className="classement-table">
            <thead>
              <tr>
                <th>{t('ranking.col_name')}</th>
                <th>{t('ranking.col_surface')}</th>
                <th>{t('ranking.col_score')}</th>
                <th>{t('ranking.col_criteria')}</th>
                <th>{t('ranking.col_coords')}</th>
                <th>{t('ranking.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {terrains.length > 0 ? (
                terrains.map((t_) => renderTerrainRow(t_, (terrainId) => { void handleDelete(terrainId) }))
              ) : (
                <tr><td colSpan={6} className="classement-table-empty">{t('ranking.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="classement-pagination">
            <span>{t('messages.pagination_showing')} {start}-{end} {t('messages.pagination_on')} {totalCount} {t('messages.pagination_results')}</span>
            <div className="classement-pagination-controls">
              <button type="button" className="pagination-btn" data-page="prev" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{icons.chevronLeft}</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} type="button" className={`pagination-btn pagination-btn--page${i + 1 === page ? ' pagination-btn--active' : ''}`} data-page={i + 1} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button type="button" className="pagination-btn" data-page="next" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{icons.chevron}</button>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { formatApiErrors } from '../api/auth'
import { fetchProjet, type Projet } from '../api/projets'
import { deleteTerrain, fetchTerrains, type Terrain } from '../api/terrains'
import {
  fetchAnalyseDetail,
  fetchAnalyses,
  type Analyse,
  type AnalyseDetail,
  type ResultatAnalyse,
} from '../api/analyses'
import { fetchCouches, fetchCoucheGeoJSON } from '../api/couches'
import { attributeLabel, CADASTRE_ATTRIBUTE_LABELS } from '../utils/attributeLabels'
import { t } from '../i18n/index'

const PAGE_SIZE = 10

interface AlertState {
  type: 'success' | 'error'
  message: string
}


function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function formatSurface(s: number | null | undefined): string {
  return s != null ? `${Number(s).toLocaleString()} m²` : '—'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    complete: 'ranking.status_complete',
    en_cours: 'ranking.status_en_cours',
    erreur: 'ranking.status_erreur',
  }
  return t(map[status] ?? 'ranking.status_complete')
}


function confBadge(r: ResultatAnalyse): React.JSX.Element {
  const ok = r.nombre_criteres_satisfaits
  const total = r.total_criteres
  const cls = total > 0 && ok >= total ? 'classement-conf--ok' : 'classement-conf--warn'
  return <span className={`classement-conf ${cls}`}>{ok}/{total}</span>
}

function renderTerrainRow(t_: Terrain, onDelete: (id: number) => void): React.JSX.Element {
  const hasCoords = t_.lat != null && t_.lng != null
  return (
    <tr data-terrain-id={t_.id}>
      <td><strong>{t_.nom}</strong></td>
      <td>{Number(t_.superficie).toLocaleString()} m²</td>
      <td>{t_.indice || '—'}</td>
      <td>{t_.consistance || '—'}</td>
      <td>{hasCoords ? `${Number(t_.lat).toFixed(4)}, ${Number(t_.lng).toFixed(4)}` : t('ranking.no_coords')}</td>
      <td>
        <div className="classement-table-actions">
          <button type="button" className="table-action-btn table-action-btn--danger" data-action="delete" data-terrain-id={t_.id} title={t('common.delete')} onClick={() => onDelete(t_.id)}>{icons.trash}</button>
        </div>
      </td>
    </tr>
  )
}

function DetailModal({ resultat, cadastre, onClose }: { resultat: ResultatAnalyse; cadastre?: Record<string, unknown> | null; onClose: () => void }): React.JSX.Element {
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{t('ranking.details_title')} — {resultat.nom}</h3>
          <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={onClose}>{icons.close}</button>
        </div>
        <div className="classement-modal-body">
          <div className="classement-detail-grid">
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_parcelle')}</span>
              <span className="classement-detail-value">{resultat.reference_cadastrale || resultat.id_parcelle}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_rang')}</span>
              <span className="classement-detail-value">#{resultat.rang}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_surface')}</span>
              <span className="classement-detail-value">{formatSurface(resultat.superficie)}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_conformite')}</span>
              <span className="classement-detail-value">{confBadge(resultat)}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_conformite')}</span>
              <span className="classement-detail-value">{confBadge(resultat)}</span>
            </div>
          </div>

          {cadastre && Object.keys(cadastre).length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.carte_cadastrale')}</h4>
              <div className="classement-detail-grid">
                {Object.entries(cadastre)
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .map(([k, v]) => (
                    <div className="classement-detail-item" key={k}>
                      <span className="classement-detail-label">{attributeLabel(k, CADASTRE_ATTRIBUTE_LABELS)}</span>
                      <span className="classement-detail-value">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {resultat.criteres && resultat.criteres.length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.resultats_criteres')}</h4>
              <div className="classement-criteria-list">
                {resultat.criteres.map((c) => (
                  <div key={c.id} className="classement-criteria-row">
                    <div className="classement-criteria-main">
                      <span className="classement-criteria-name">{c.critere}</span>
                      <span className="classement-criteria-value">{c.valeur_mesuree} <small>({c.point_interet})</small></span>
                    </div>
                    <span className={`classement-criteria-status ${c.conforme ? 'classement-criteria-status--ok' : 'classement-criteria-status--ko'}`}>
                      {c.conforme ? t('ranking.conforme') : t('ranking.non_conforme')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {resultat.points_forts && resultat.points_forts.length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.points_forts')}</h4>
              <ul className="classement-detail-list classement-detail-list--forts">
                {resultat.points_forts.map((pf) => <li key={pf}>{pf}</li>)}
              </ul>
            </div>
          ) : null}

          {resultat.points_faibles && resultat.points_faibles.length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.points_faibles')}</h4>
              <ul className="classement-detail-list classement-detail-list--faibles">
                {resultat.points_faibles.map((pf) => <li key={pf}>{pf}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function RentabiliteTab({ projetId }: { projetId: number }): React.JSX.Element {
  const [terrains, setTerrains] = useState<Terrain[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchTerrains(projetId, { page_size: 200 })
      .then((data) => {
        if (cancelled) return
        setTerrains(data.results.filter((t_) => t_.rentabilite_json))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projetId])

  const sorted = [...terrains].sort((a, b) => {
    const aBenefice = (a.rentabilite_json as Record<string, unknown>)?.benefice_net as number ?? -Infinity
    const bBenefice = (b.rentabilite_json as Record<string, unknown>)?.benefice_net as number ?? -Infinity
    return bBenefice - aBenefice
  })

  const fmtMAD = (v: number | null | undefined): string => {
    if (v == null) return '—'
    return `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MAD`
  }

  if (loading) {
    return (
      <div className="classement-empty">
        <div className="admin-loading-spinner"></div>
        <p>{t('ranking.loading')}</p>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="classement-empty">
        <div className="classement-empty-icon">{icons.euro}</div>
        <h3 className="classement-empty-title">{t('ranking.no_rentabilite_title')}</h3>
        <p className="classement-empty-desc">{t('ranking.no_rentabilite_desc')}</p>
      </div>
    )
  }

  return (
    <div className="classement-table-wrapper">
      <table className="classement-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('ranking.col_name')}</th>
            <th>{t('ranking.col_surface')}</th>
            <th>{t('ranking.res_ca')}</th>
            <th>{t('ranking.res_cout_total')}</th>
            <th>{t('ranking.res_benefice')}</th>
            <th>{t('ranking.res_tri')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t_, i) => {
            const r = t_.rentabilite_json as Record<string, unknown> | null
            const ca = r?.ca_total as number ?? null
            const cout = r?.cout_total_projet as number ?? null
            const benefice = r?.benefice_net as number ?? null
            const tri = r?.tri as number ?? null
            return (
              <tr key={t_.id}>
                <td><span className="classement-rank">#{i + 1}</span></td>
                <td>
                  <div className="classement-parcelle">
                    <strong>{t_.nom}</strong>
                    <span className="classement-ref">{t_.num_titre_foncier || '—'}</span>
                  </div>
                </td>
                <td>{Number(t_.superficie).toLocaleString()} m²</td>
                <td>{fmtMAD(ca)}</td>
                <td>{fmtMAD(cout)}</td>
                <td>
                  <span className={benefice != null && benefice >= 0 ? 'text-success' : 'text-error'}>
                    {fmtMAD(benefice)}
                  </span>
                </td>
                <td>{tri != null ? `${tri.toFixed(1)}%` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ClassementPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const projetId = Number(id)
  const [tab, setTab] = useState<'parcelles' | 'terrains' | 'rentabilite'>('parcelles')
  const [parcellesPage, setParcellesPage] = useState(1)
  const [projet, setProjet] = useState<Projet | null>(null)
  const [analyses, setAnalyses] = useState<Analyse[]>([])
  const [analyse, setAnalyse] = useState<AnalyseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [detail, setDetail] = useState<ResultatAnalyse | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [terrains, setTerrains] = useState<Terrain[]>([])
  const [cadastreAttrs, setCadastreAttrs] = useState<Record<string, Record<string, unknown>>>({})
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [terrainsLoading, setTerrainsLoading] = useState(false)

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
    Promise.all([fetchProjet(projetId), fetchAnalyses(projetId)])
      .then(async ([p, list]) => {
        if (cancelled) return
        setProjet(p)
        setAnalyses(list)
        if (list.length > 0) {
          const latest = await fetchAnalyseDetail(projetId, list[0].id)
          if (cancelled) return
          setAnalyse(latest)
        }
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
    if (!projetId || tab !== 'terrains') return
    let cancelled = false
    setTerrainsLoading(true)
    fetchTerrains(projetId, { search, page })
      .then((data) => {
        if (cancelled) return
        setTerrains(data.results)
        setTotalCount(data.count)
        setTerrainsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setAlert({ type: 'error', message: formatApiErrors(err) })
        setTerrainsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projetId, tab, search, page])

  useEffect(() => {
    if (!alert) return
    const timer = setTimeout(() => setAlert(null), 5000)
    return () => clearTimeout(timer)
  }, [alert])

  useEffect(() => {
    if (!projetId || tab !== 'terrains') return
    const onFocus = (): void => {
      const key = `terrain_created_${projetId}`
      if (!localStorage.getItem(key)) return
      localStorage.removeItem(key)
      void fetchTerrains(projetId, { search, page })
        .then((data) => {
          setTerrains(data.results)
          setTotalCount(data.count)
        })
        .catch(() => { /* ignore */ })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [projetId, tab, search, page])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchCouches()
        const cad = list.find((c) => c.nom === 'cadastre')
        if (!cad) return
        const fc = await fetchCoucheGeoJSON(cad.id)
        if (cancelled) return
        const map: Record<string, Record<string, unknown>> = {}
        fc.features.forEach((f) => {
          const id = f.properties?.num
          if (id != null) map[String(id)] = f.properties as Record<string, unknown>
        })
        setCadastreAttrs(map)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setParcellesPage(1)
  }, [analyse])

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

  const openHistoryAnalyse = async (analyseId: number): Promise<void> => {
    if (!projetId) return
    setHistoryLoading(true)
    try {
      const detail = await fetchAnalyseDetail(projetId, analyseId)
      setAnalyse(detail)
      setHistoryOpen(false)
    } catch (err) {
      setAlert({ type: 'error', message: formatApiErrors(err) })
    } finally {
      setHistoryLoading(false)
    }
  }

  if (loading && !error) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" projectContext={projet ? { id: projet.id, name: projet.nom } : null}>
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>{t('ranking.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !projet) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" projectContext={null}>
        <div className="admin-error-state">
          <p>{error ?? t('ranking.loading')}</p>
          <Link to="/projets" className="btn btn-primary">{t('projects.error_login')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, totalCount)

  const resultats = analyse?.resultats ?? []
  const parcellesTotal = resultats.length
  const parcellesTotalPages = Math.max(1, Math.ceil(parcellesTotal / PAGE_SIZE))
  const parcellesStart = parcellesTotal === 0 ? 0 : (parcellesPage - 1) * PAGE_SIZE + 1
  const parcellesEnd = Math.min(parcellesPage * PAGE_SIZE, parcellesTotal)
  const resultatsPagines = resultats.slice(parcellesStart - 1, parcellesEnd)

  return (
    <DashboardLayout role="investisseur" activePage="ranking" projectContext={{ id: projet.id, name: projet.nom }}>
      <div className="classement-page">
        <div className="classement-header">
          <div>
            <h2 className="classement-title">{t('ranking.title')} : {projet.nom}</h2>
            <p className="classement-desc">{t('ranking.desc')}</p>
          </div>
          <div className="classement-actions">
            <button type="button" className="btn btn-secondary btn-action" disabled={analyses.length === 0} onClick={() => setHistoryOpen(true)}>
              {icons.database} {t('ranking.analysis_history')}
            </button>
            <Link to={`/projets/${projet.id}/classement/ajouter`} className="btn btn-primary btn-action">
              {icons.plus} {t('ranking.new_analysis')}
            </Link>
          </div>
        </div>

        <div className="classement-tabs">
          <button type="button" className={`classement-tab${tab === 'parcelles' ? ' classement-tab--active' : ''}`} onClick={() => setTab('parcelles')}>
            {t('ranking.tab_parcelles')}
          </button>
          <button type="button" className={`classement-tab${tab === 'terrains' ? ' classement-tab--active' : ''}`} onClick={() => setTab('terrains')}>
            {t('ranking.tab_terrains')}
          </button>
          <button type="button" className={`classement-tab${tab === 'rentabilite' ? ' classement-tab--active' : ''}`} onClick={() => setTab('rentabilite')}>
            {t('ranking.tab_rentabilite')}
          </button>
        </div>

        <div id="page-alert" className="form-alert form-alert--success" hidden={!(alert?.type === 'success')}>{alert?.type === 'success' ? alert.message : ''}</div>
        <div id="page-error" className="form-alert form-alert--error" hidden={!(alert?.type === 'error')}>{alert?.type === 'error' ? alert.message : ''}</div>

        {tab === 'parcelles' ? (
          analyse && analyse.resultats.length > 0 ? (
            <>
              <div className="classement-summary-bar">
                <span className="classement-summary-item">
                  {t('ranking.last_analysis')} : <strong>{formatDate(analyse.date_creation)}</strong>
                </span>
                <span className="classement-summary-item">
                  {analyse.nombre_parcelles} {t('ranking.analyses_count')}
                </span>
                <span className="classement-summary-item">
                  {t('ranking.col_conformite')} : <strong>{statusLabel(analyse.statut)}</strong>
                </span>
              </div>

              <div className="classement-table-wrapper">
                <table className="classement-table">
                  <thead>
                    <tr>
                      <th>{t('ranking.col_rang')}</th>
                      <th>{t('ranking.col_parcelle')}</th>
                      <th>{t('ranking.col_surface')}</th>
                      <th>{t('ranking.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultatsPagines.map((r) => (
                      <tr key={r.id}>
                        <td><span className="classement-rank">#{r.rang}</span></td>
                        <td>
                          <div className="classement-parcelle">
                            <strong>{r.nom}</strong>
                            <span className="classement-ref">{r.reference_cadastrale || r.id_parcelle}</span>
                          </div>
                        </td>
                        <td>{formatSurface(r.superficie)}</td>
                        <td>
                          <div className="classement-table-actions">
                            <button type="button" className="table-action-btn" title={t('ranking.view_details')} onClick={() => setDetail(r)}>{icons.eye}</button>
                            <Link
                              to={`/projets/${projet.id}/classement/ajouter?analyse=${analyse.id}&parcelle=${encodeURIComponent(r.reference_cadastrale || r.id_parcelle)}`}
                              className="table-action-btn"
                              title={t('ranking.view_map')}
                            >{icons.mapPin}</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="users-pagination">
                <span className="pagination-info">
                  {t('messages.pagination_showing')} {parcellesStart}-{parcellesEnd} {t('messages.pagination_on')} {parcellesTotal}{' '}
                  {t('messages.pagination_results')}
                </span>
                <div className="users-pagination-controls">
                  <button type="button" className="pagination-btn" disabled={parcellesPage <= 1} onClick={() => setParcellesPage((p) => Math.max(1, p - 1))}>
                    {icons.chevronLeft} {t('messages.pagination_prev')}
                  </button>
                  {Array.from({ length: parcellesTotalPages }, (_, i) => {
                    const p = i + 1
                    if (parcellesTotalPages > 7) {
                      if (p === 1 || p === parcellesTotalPages || (p >= parcellesPage - 1 && p <= parcellesPage + 1)) {
                        return (
                          <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === parcellesPage ? ' pagination-btn--active' : ''}`} onClick={() => setParcellesPage(p)}>{p}</button>
                        )
                      }
                      if (p === parcellesPage - 2 || p === parcellesPage + 2) {
                        return <span className="pagination-ellipsis" key={i}>...</span>
                      }
                      return null
                    }
                    return (
                      <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === parcellesPage ? ' pagination-btn--active' : ''}`} onClick={() => setParcellesPage(p)}>{p}</button>
                    )
                  })}
                  <button type="button" className="pagination-btn" disabled={parcellesPage >= parcellesTotalPages} onClick={() => setParcellesPage((p) => Math.min(parcellesTotalPages, p + 1))}>
                    {t('messages.pagination_next')} {icons.chevron}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="classement-empty">
              <div className="classement-empty-icon">{icons.layers}</div>
              <h3 className="classement-empty-title">{t('ranking.no_classement_title')}</h3>
              <p className="classement-empty-desc">{t('ranking.no_classement_desc')}</p>
              <Link to={`/projets/${projet.id}/classement/ajouter`} className="btn btn-primary">
                {icons.plus} {t('ranking.launch_analysis')}
              </Link>
            </div>
          )
        ) : tab === 'terrains' ? (
          <>
            <div className="classement-toolbar">
              <div className="classement-search">
                {icons.search}
                <input type="search" id="classement-search" className="classement-search-input" placeholder={t('ranking.search_placeholder')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
              </div>
              <span className="classement-count">{totalCount} {t('ranking.total_terrains')}</span>
              <button type="button" className="btn btn-primary btn-action" onClick={() => navigate(`/projets/${projetId}/classement/ajouter?add=1`)}>
                {icons.plus} {t('ranking.add_terrain')}
              </button>
            </div>

            <div className="classement-table-wrapper">
              <table className="classement-table">
                <thead>
                  <tr>
                    <th>{t('ranking.col_name')}</th>
                    <th>{t('ranking.col_surface')}</th>
                    <th>{t('ranking.col_indice')}</th>
                    <th>{t('ranking.col_consistance')}</th>
                    <th>{t('ranking.col_coords')}</th>
                    <th>{t('ranking.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {terrainsLoading ? (
                    <tr><td colSpan={6} className="classement-table-empty">{t('ranking.loading')}</td></tr>
                  ) : terrains.length > 0 ? (
                    terrains.map((t_) => renderTerrainRow(t_, (terrainId) => { void handleDelete(terrainId) }))
                  ) : (
                    <tr><td colSpan={6} className="classement-table-empty">{t('ranking.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

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
                          <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === page ? ' pagination-btn--active' : ''}`} data-page={p} onClick={() => setPage(p)}>{p}</button>
                        )
                      }
                      if (p === page - 2 || p === page + 2) {
                        return <span className="pagination-ellipsis" key={i}>...</span>
                      }
                      return null
                    }
                    return (
                      <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === page ? ' pagination-btn--active' : ''}`} data-page={p} onClick={() => setPage(p)}>{p}</button>
                    )
                  })}
                  <button type="button" className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    {t('messages.pagination_next')} {icons.chevron}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : tab === 'rentabilite' ? (
          <RentabiliteTab projetId={projetId} />
        ) : null}
      </div>

      {detail ? <DetailModal resultat={detail} cadastre={cadastreAttrs[String(detail.reference_cadastrale || detail.id_parcelle)] || null} onClose={() => setDetail(null)} /> : null}

      {historyOpen ? (
        <div className="admin-modal-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="admin-modal classement-modal--history" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{t('ranking.history_title')}</h3>
              <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={() => setHistoryOpen(false)}>{icons.close}</button>
            </div>
            <div className="classement-modal-body">
              {analyses.length === 0 ? (
                <div className="classement-empty">
                  <p className="classement-empty-desc">{t('ranking.no_classement_desc')}</p>
                </div>
              ) : (
                <div className="classement-history-list">
                  {analyses.map((a) => (
                    <div key={a.id} className={`classement-history-item${analyse?.id === a.id ? ' classement-history-item--active' : ''}`}>
                      <div className="classement-history-info">
                        <span className="classement-history-date">{formatDate(a.date_creation)}</span>
                        <span className="classement-history-meta">
                          {a.nombre_parcelles} {t('ranking.analyses_count')} · {statusLabel(a.statut)}
                        </span>
                      </div>
                      <button type="button" className="table-action-btn" disabled={historyLoading} onClick={() => { void openHistoryAnalyse(a.id) }} title={t('ranking.history_open')}>
                        {icons.eye}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

    </DashboardLayout>
  )
}

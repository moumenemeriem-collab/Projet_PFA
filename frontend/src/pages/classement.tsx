import { useCallback, useEffect, useState } from 'react'
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
import { attributeLabel, CADASTRE_ATTRIBUTE_LABELS, formatParcelleRef, formatParcelleTitle } from '../utils/attributeLabels'
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
  const displayTitle = formatParcelleTitle({ nom: t_.nom, num: t_.num_parcelle || t_.num_titre_foncier, indice: t_.indice })
  return (
    <tr data-terrain-id={t_.id}>
      <td><strong>{displayTitle}</strong></td>
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
  const displayTitle = formatParcelleTitle({ nom: resultat.nom, id_parcelle: resultat.id_parcelle, reference_cadastrale: resultat.reference_cadastrale, indice: resultat.indice })
  const displayRef = formatParcelleRef(resultat.reference_cadastrale || resultat.id_parcelle, resultat.indice)
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{t('ranking.details_title')} — {displayTitle}</h3>
          <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={onClose}>{icons.close}</button>
        </div>
        <div className="classement-modal-body">
          <div className="classement-detail-grid">
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_parcelle')}</span>
              <span className="classement-detail-value">{displayRef || '—'}</span>
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

function fmtMAD(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MAD`
}

function TerrainDetailModal({ terrain, cadastre, onClose }: { terrain: Terrain; cadastre?: Record<string, unknown> | null; onClose: () => void }): React.JSX.Element {
  const r = terrain.rentabilite_json as Record<string, unknown> | null
  const fmtPct = (v: unknown): string => {
    if (v == null || v === '') return '—'
    const n = Number(v)
    return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—'
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{t('ranking.details_title')} — {terrain.nom}</h3>
          <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={onClose}>{icons.close}</button>
        </div>
        <div className="classement-modal-body">
          <div className="classement-detail-grid">
            <div className="classement-detail-item">
              <span className="classement-detail-label">Titre / Réf. foncière</span>
              <span className="classement-detail-value">{terrain.num_titre_foncier || terrain.num_parcelle || terrain.nom}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">Superficie</span>
              <span className="classement-detail-value">{Number(terrain.superficie).toLocaleString('fr-FR')} m²</span>
            </div>
            {r?.benefice_net != null && (
              <div className="classement-detail-item">
                <span className="classement-detail-label">{t('ranking.res_benefice')}</span>
                <span className="classement-detail-value" style={{ color: Number(r.benefice_net) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {fmtMAD(Number(r.benefice_net))}
                </span>
              </div>
            )}
            {r?.tri != null && (
              <div className="classement-detail-item">
                <span className="classement-detail-label">{t('ranking.res_tri')}</span>
                <span className="classement-detail-value" style={{ color: Number(r.tri) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {fmtPct(r.tri)}
                </span>
              </div>
            )}
          </div>

          {r && Object.keys(r).length > 0 && (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">Analyse Financière & Rentabilité</h4>
              <div className="classement-detail-grid">
                {r.ca_total != null && (
                  <div className="classement-detail-item">
                    <span className="classement-detail-label">{t('ranking.res_ca')}</span>
                    <span className="classement-detail-value">{fmtMAD(Number(r.ca_total))}</span>
                  </div>
                )}
                {r.cout_foncier != null && (
                  <div className="classement-detail-item">
                    <span className="classement-detail-label">Coût du Foncier</span>
                    <span className="classement-detail-value">{fmtMAD(Number(r.cout_foncier))}</span>
                  </div>
                )}
                {r.cout_construction_total != null && (
                  <div className="classement-detail-item">
                    <span className="classement-detail-label">Coût Construction</span>
                    <span className="classement-detail-value">{fmtMAD(Number(r.cout_construction_total))}</span>
                  </div>
                )}
                {r.cout_total_projet != null && (
                  <div className="classement-detail-item">
                    <span className="classement-detail-label">{t('ranking.res_cout_total')}</span>
                    <span className="classement-detail-value">{fmtMAD(Number(r.cout_total_projet))}</span>
                  </div>
                )}
                {r.marge_nette_pct != null && (
                  <div className="classement-detail-item">
                    <span className="classement-detail-label">Marge Nette</span>
                    <span className="classement-detail-value">{fmtPct(r.marge_nette_pct)}</span>
                  </div>
                )}
                {r.van != null && (
                  <div className="classement-detail-item">
                    <span className="classement-detail-label">VAN</span>
                    <span className="classement-detail-value">{fmtMAD(Number(r.van))}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  )
}

export function ClassementPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const projetId = Number(id)
  const [tab, setTab] = useState<'parcelles' | 'terrains' | 'rentabilite'>('parcelles')
  const [parcellesPage, setParcellesPage] = useState(1)
  const [savedPage, setSavedPage] = useState(1)
  const [projet, setProjet] = useState<Projet | null>(null)
  const [analyses, setAnalyses] = useState<Analyse[]>([])
  const [analyse, setAnalyse] = useState<AnalyseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [detail, setDetail] = useState<ResultatAnalyse | null>(null)
  const [selectedTerrainDetail, setSelectedTerrainDetail] = useState<Terrain | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [savedTerrains, setSavedTerrains] = useState<Terrain[]>([])
  const [savedLoading, setSavedLoading] = useState(true)

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

  const loadSavedTerrains = useCallback(() => {
    if (!projetId) return
    setSavedLoading(true)
    fetchTerrains(projetId, { page_size: 200 })
      .then((data) => {
        const sorted = [...data.results].sort((a, b) => {
          const aBen = (a.rentabilite_json as Record<string, unknown>)?.benefice_net as number ?? -Infinity
          const bBen = (b.rentabilite_json as Record<string, unknown>)?.benefice_net as number ?? -Infinity
          if (aBen !== bBen) return bBen - aBen
          return new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime()
        })
        setSavedTerrains(sorted)
        setSavedLoading(false)
      })
      .catch(() => setSavedLoading(false))
  }, [projetId])

  useEffect(() => {
    if (!projetId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    loadSavedTerrains()
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
  }, [projetId, loadSavedTerrains])

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
    if (!projetId) return
    const onFocus = (): void => {
      const key = `terrain_created_${projetId}`
      if (!localStorage.getItem(key)) return
      localStorage.removeItem(key)
      loadSavedTerrains()
      if (tab === 'terrains') {
        void fetchTerrains(projetId, { search, page })
          .then((data) => {
            setTerrains(data.results)
            setTotalCount(data.count)
          })
          .catch(() => { /* ignore */ })
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [projetId, tab, search, page, loadSavedTerrains])

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
      setSavedTerrains((prev) => prev.filter((t_) => t_.id !== terrainId))
      setTerrains((prev) => prev.filter((t_) => t_.id !== terrainId))
      setTotalCount((c) => Math.max(0, c - 1))
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
      <DashboardLayout role="investisseur" activePage="ranking" projectContext={{ id: projetId, name: projet?.nom ?? '...' }}>
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>{t('ranking.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !projet) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" projectContext={{ id: projetId, name: '...' }}>
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

  const savedTotalPages = Math.max(1, Math.ceil(savedTerrains.length / PAGE_SIZE))
  const savedStart = savedTerrains.length === 0 ? 0 : (savedPage - 1) * PAGE_SIZE + 1
  const savedEnd = Math.min(savedPage * PAGE_SIZE, savedTerrains.length)
  const savedPagines = savedTerrains.slice(savedStart - 1, savedEnd)

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
            <Link to={`/projets/${projet.id}/ponderation`} className="btn btn-primary btn-action">
              {icons.layers} {t('ranking.launch_ponderation')}
            </Link>
            <Link to={`/projets/${projet.id}/classement/ajouter`} className="btn btn-secondary btn-action">
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
          <>
            <div className="classement-summary-bar">
              <span className="classement-summary-item">
                Terrains enregistrés : <strong>{savedTerrains.length}</strong>
              </span>
              <span className="classement-summary-item">
                Avec calcul de rentabilité : <strong>{savedTerrains.filter((t_) => !!t_.rentabilite_json).length}</strong>
              </span>
            </div>

            <div className="classement-table-wrapper">
              <table className="classement-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('ranking.col_parcelle')}</th>
                    <th>{t('ranking.col_surface')}</th>
                    <th>{t('ranking.res_ca')}</th>
                    <th>{t('ranking.res_cout_total')}</th>
                    <th>{t('ranking.res_benefice')}</th>
                    <th>{t('ranking.res_tri')}</th>
                    <th>{t('ranking.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {savedLoading ? (
                    <tr><td colSpan={8} className="classement-table-empty">{t('ranking.loading')}</td></tr>
                  ) : savedTerrains.length > 0 ? (
                    savedPagines.map((t_, idx) => {
                      const r = t_.rentabilite_json as Record<string, unknown> | null
                      const ca = r?.ca_total as number ?? null
                      const cout = r?.cout_total_projet as number ?? null
                      const benefice = r?.benefice_net as number ?? null
                      const tri = r?.tri as number ?? null
                      const rank = (savedPage - 1) * PAGE_SIZE + idx + 1
                      return (
                        <tr key={t_.id}>
                          <td><span className="classement-rank">#{rank}</span></td>
                          <td>
                            <div className="classement-parcelle">
                              <strong>{formatParcelleTitle({ nom: t_.nom, num: t_.num_titre_foncier || t_.num_parcelle, indice: t_.indice })}</strong>
                              <span className="classement-ref">{formatParcelleRef(t_.num_titre_foncier || t_.num_parcelle || t_.nom, t_.indice) || '—'}</span>
                            </div>
                          </td>
                          <td>{Number(t_.superficie).toLocaleString('fr-FR')} m²</td>
                          <td>{fmtMAD(ca)}</td>
                          <td>{fmtMAD(cout)}</td>
                          <td>
                            {benefice != null ? (
                              <span className={benefice >= 0 ? 'text-success' : 'text-error'} style={{ fontWeight: 600 }}>
                                {fmtMAD(benefice)}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td>{tri != null ? `${tri.toFixed(1)}%` : '—'}</td>
                          <td>
                            <div className="classement-table-actions">
                              <button
                                type="button"
                                className="table-action-btn"
                                title={t('ranking.view_details')}
                                onClick={() => setSelectedTerrainDetail(t_)}
                              >
                                {icons.eye}
                              </button>
                              <Link
                                to={`/projets/${projet.id}/classement/ajouter?parcelle=${encodeURIComponent(t_.num_titre_foncier || t_.num_parcelle || t_.nom)}`}
                                className="table-action-btn"
                                title={t('ranking.view_map')}
                              >
                                {icons.mapPin}
                              </Link>
                              <button
                                type="button"
                                className="table-action-btn table-action-btn--danger"
                                title={t('common.delete')}
                                onClick={() => { void handleDelete(t_.id) }}
                              >
                                {icons.trash}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr><td colSpan={8} className="classement-table-empty">{t('ranking.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {savedTotalPages > 1 && (
              <div className="users-pagination">
                <span className="pagination-info">
                  {t('messages.pagination_showing')} {savedStart}-{savedEnd} {t('messages.pagination_on')} {savedTerrains.length}{' '}
                  {t('messages.pagination_results')}
                </span>
                <div className="users-pagination-controls">
                  <button type="button" className="pagination-btn" disabled={savedPage <= 1} onClick={() => setSavedPage((p) => Math.max(1, p - 1))}>
                    {icons.chevronLeft} {t('messages.pagination_prev')}
                  </button>
                  {Array.from({ length: savedTotalPages }, (_, i) => {
                    const p = i + 1
                    return (
                      <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === savedPage ? ' pagination-btn--active' : ''}`} onClick={() => setSavedPage(p)}>{p}</button>
                    )
                  })}
                  <button type="button" className="pagination-btn" disabled={savedPage >= savedTotalPages} onClick={() => setSavedPage((p) => Math.min(savedTotalPages, p + 1))}>
                    {t('messages.pagination_next')} {icons.chevron}
                  </button>
                </div>
              </div>
            )}
          </>
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
        ) : null}
      </div>

      {detail ? <DetailModal resultat={detail} cadastre={cadastreAttrs[String(detail.reference_cadastrale || detail.id_parcelle)] || null} onClose={() => setDetail(null)} /> : null}

      {selectedTerrainDetail ? <TerrainDetailModal terrain={selectedTerrainDetail} cadastre={cadastreAttrs[String(selectedTerrainDetail.num_titre_foncier || selectedTerrainDetail.num_parcelle || '')] || null} onClose={() => setSelectedTerrainDetail(null)} /> : null}

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

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../../components/DashboardLayout'
import { icons } from '../../components/icons'
import { formatApiErrors } from '../../api/auth'
import { t } from '../../i18n/index'
import {
  fetchInvestorDashboard,
  type InvestorDashboardData,
  type ProjetResume,
  type TerrainResume,
  type AnalyseResume,
} from '../../api/investor-dashboard'

const PASTEL = {
  blue: '#93c5fd',
  blueDeep: '#3b82f6',
  lavande: '#c4b5fd',
  lavandeDeep: '#8b5cf6',
  peche: '#fcd7b6',
  pecheDeep: '#f97316',
  rose: '#f9a8d4',
  roseDeep: '#ec4899',
  mintDeep: '#059669',
  skyDeep: '#0284c7',
  ambreDeep: '#d97706',
  violetDeep: '#7c3aed',
  grid: '#f1f5f9',
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }): React.JSX.Element {
  const pct = Math.min(100, Math.max(0, (score / max) * 100))
  let color = PASTEL.mintDeep
  if (pct < 40) color = '#dc2626'
  else if (pct < 60) color = PASTEL.ambreDeep
  else if (pct < 80) color = PASTEL.blueDeep
  return (
    <div className="idash-score-bar">
      <div className="idash-score-bar-track">
        <div className="idash-score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="idash-score-bar-value">{score.toFixed(1)}</span>
    </div>
  )
}

function MiniDonut({ value, total, color }: { value: number; total: number; color: string }): React.JSX.Element {
  const r = 15.9155
  const c = 2 * Math.PI * r
  const frac = total > 0 ? value / total : 0
  const dash = frac * c
  return (
    <svg viewBox="0 0 42 42" className="idash-mini-donut">
      <circle cx="21" cy="21" r={r} fill="none" stroke={PASTEL.grid} strokeWidth="4" />
      <circle cx="21" cy="21" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round" transform="rotate(-90 21 21)" />
    </svg>
  )
}

function StatCard({
  icon, label, value, sub, color, bg,
}: {
  icon: React.ReactNode; label: string; value: string | number; sub: string; color: string; bg: string
}): React.JSX.Element {
  return (
    <div className="idash-stat-card">
      <div className="idash-stat-icon" style={{ background: bg, color }}>{icon}</div>
      <div className="idash-stat-body">
        <span className="idash-stat-value">{value}</span>
        <span className="idash-stat-label">{label}</span>
        <span className="idash-stat-sub">{sub}</span>
      </div>
    </div>
  )
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function budgetFormat(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

function ProjectCard({ p }: { p: ProjetResume }): React.JSX.Element {
  const hasTerrains = p.nb_terrains > 0
  return (
    <div className="idash-project-card">
      <div className="idash-project-header">
        <h4 className="idash-project-name">{p.nom}</h4>
        <span className="idash-project-type">{p.type_nom}</span>
      </div>
      <div className="idash-project-metrics">
        <div className="idash-project-metric">
          <span className="idash-project-metric-label">{t('investor_dash.terrains')}</span>
          <span className="idash-project-metric-value">{p.nb_terrains}</span>
        </div>
        <div className="idash-project-metric">
          <span className="idash-project-metric-label">{t('investor_dash.analyses')}</span>
          <span className="idash-project-metric-value">{p.nb_analyses}</span>
        </div>
        <div className="idash-project-metric">
          <span className="idash-project-metric-label">{t('investor_dash.surface')}</span>
          <span className="idash-project-metric-value">{budgetFormat(p.surface_souhaitee)} m²</span>
        </div>
        <div className="idash-project-metric">
          <span className="idash-project-metric-label">{t('investor_dash.budget')}</span>
          <span className="idash-project-metric-value">{budgetFormat(p.budget_total)} DH</span>
        </div>
      </div>
      <div className="idash-project-footer">
        {hasTerrains ? (
          <div className="idash-project-score">
            <MiniDonut value={p.score_moyen ?? 0} total={10} color={PASTEL.blueDeep} />
            <span>{p.score_moyen != null ? `${p.score_moyen.toFixed(1)}/10` : '—'}</span>
          </div>
        ) : (
          <span className="idash-project-no-score">{t('investor_dash.no_terrains_yet')}</span>
        )}
        <Link to={hasTerrains ? `/projets/${p.id}/classement` : `/projets/${p.id}/classement/ajouter`} className="idash-project-link">
          {hasTerrains ? t('investor_dash.view_details') : t('investor_dash.add_terrains')} {icons.chevron}
        </Link>
      </div>
    </div>
  )
}

function TerrainRow({ t: terrain }: { t: TerrainResume }): React.JSX.Element {
  return (
    <div className="idash-terrain-row">
      <div className="idash-terrain-rank">#{terrain.id}</div>
      <div className="idash-terrain-info">
        <span className="idash-terrain-name">{terrain.nom}</span>
        <span className="idash-terrain-projet">{terrain.projet_nom}</span>
      </div>
      <div className="idash-terrain-scores">
        <div className="idash-terrain-score-item">
          <span className="idash-terrain-score-label">{t('investor_dash.short_access')}</span>
          <span className="idash-terrain-score-val">{terrain.accessibilite}</span>
        </div>
        <div className="idash-terrain-score-item">
          <span className="idash-terrain-score-label">{t('investor_dash.short_pos')}</span>
          <span className="idash-terrain-score-val">{terrain.positionnement}</span>
        </div>
        <div className="idash-terrain-score-item">
          <span className="idash-terrain-score-label">{t('investor_dash.short_topo')}</span>
          <span className="idash-terrain-score-val">{terrain.topographie}</span>
        </div>
      </div>
      <div className="idash-terrain-score-global">
        <ScoreBar score={terrain.score} />
      </div>
    </div>
  )
}

function AnalysisRow({ a }: { a: AnalyseResume }): React.JSX.Element {
  return (
    <div className="idash-analysis-row">
      <div className="idash-analysis-info">
        <span className="idash-analysis-projet">{a.projet_nom}</span>
        <span className="idash-analysis-meta">
          {a.nombre_parcelles} {t('investor_dash.parc')} · {formatDateShort(a.date_creation)}
        </span>
      </div>
    </div>
  )
}

export function InvestorDashboardPage(): React.JSX.Element {
  const [data, setData] = useState<InvestorDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchInvestorDashboard()
      .then((d) => {
        if (cancelled) return
        setData(d)
        setLastUpdate(new Date())
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(formatApiErrors(err))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  let content: React.ReactNode

  if (loading) {
    content = (
      <div className="admin-loading">
        <div className="admin-loading-spinner" />
        <p>{t('investor_dash.loading')}</p>
      </div>
    )
  } else if (error) {
    content = (
      <div className="admin-error-state">
        <p>{error}</p>
        <Link to="/projets" className="btn btn-primary">{t('investor_dash.back_projects')}</Link>
      </div>
    )
  } else if (data) {
    const { resume, projets, meilleurs_terrains, dernieres_analyses, top_resultats } = data

    const statCards = [
      { icon: icons.projects, label: t('investor_dash.total_projects'), value: resume.nb_projets, sub: t('investor_dash.projects_sub'), color: PASTEL.blueDeep, bg: '#eff6ff' },
      { icon: icons.mapPin, label: t('investor_dash.total_terrains'), value: resume.nb_terrains, sub: t('investor_dash.terrains_sub'), color: PASTEL.lavandeDeep, bg: '#f5f3ff' },
      { icon: icons.ranking, label: t('investor_dash.total_analyses'), value: resume.nb_analyses, sub: t('investor_dash.analyses_sub'), color: PASTEL.pecheDeep, bg: '#fff7ed' },
      { icon: icons.ranking, label: t('investor_dash.avg_score'), value: resume.score_moyen != null ? `${resume.score_moyen.toFixed(1)}/10` : '—', sub: t('investor_dash.score_sub'), color: PASTEL.mintDeep, bg: '#ecfdf5' },
    ]

    content = (
      <div className="idash-page">
        <div className="idash-header">
          <div>
            <h2 className="idash-title">{t('investor_dash.title')}</h2>
            <p className="idash-subtitle">{t('investor_dash.subtitle')}</p>
          </div>
          <span className="idash-updated">
            {t('investor_dash.updated')} {lastUpdate ? lastUpdate.toLocaleTimeString('fr-FR') : '—'}
          </span>
        </div>

        <div className="idash-stats-grid">
          {statCards.map((sc) => (
            <StatCard key={sc.label} {...sc} />
          ))}
        </div>

        <div className="idash-grid idash-grid--2">
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('investor_dash.best_terrains')}</h3>
              <Link to="/classement" className="idash-card-link">{t('investor_dash.see_all')}</Link>
            </div>
            {meilleurs_terrains.length > 0 ? (
              <div className="idash-terrain-list">
                {meilleurs_terrains.map((t) => (
                  <TerrainRow key={t.id} t={t} />
                ))}
              </div>
            ) : (
              <div className="idash-empty">{t('investor_dash.no_terrains')}</div>
            )}
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('investor_dash.top_results')}</h3>
            </div>
            {top_resultats.length > 0 ? (
              <div className="idash-result-list">
                {top_resultats.map((r) => (
                  <div className="idash-result-row" key={r.id}>
                    <div className="idash-result-rank">#{r.rang ?? '—'}</div>
                    <div className="idash-result-info">
                      <span className="idash-result-name">{r.nom || r.reference_cadastrale}</span>
                      <span className="idash-result-projet">{r.projet_nom}</span>
                    </div>
                    <div className="idash-result-score">
                      <span className="idash-result-score-val">{r.score_final?.toFixed(1) ?? '—'}</span>
                      <span className="idash-result-score-label">/10</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="idash-empty">{t('investor_dash.no_results')}</div>
            )}
          </div>
        </div>

        {projets.length > 0 && (
          <div className="idash-section">
            <div className="idash-section-header">
              <h3 className="idash-section-title">{t('investor_dash.my_projects')}</h3>
              <Link to="/projets" className="idash-card-link">{t('investor_dash.see_all')}</Link>
            </div>
            <div className="idash-projects-grid">
              {projets.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}

        {dernieres_analyses.length > 0 && (
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('investor_dash.recent_analyses')}</h3>
            </div>
            <div className="idash-analysis-list">
              {dernieres_analyses.map((a) => (
                <AnalysisRow key={a.id} a={a} />
              ))}
            </div>
          </div>
        )}

        {projets.length === 0 && (
          <div className="idash-onboarding">
            <div className="idash-onboarding-icon">{icons.projects}</div>
            <h3>{t('investor_dash.onboarding_title')}</h3>
            <p>{t('investor_dash.onboarding_desc')}</p>
            <Link to="/projets/nouveau" className="btn btn-primary btn-sm">
              {icons.plus} {t('investor_dash.create_project')}
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <DashboardLayout role="investisseur" activePage="dashboard">
      {content}
    </DashboardLayout>
  )
}

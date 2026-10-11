import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../../components/DashboardLayout'
import { icons } from '../../components/icons'
import { formatApiErrors } from '../../api/auth'
import { t } from '../../i18n/index'
import {
  fetchInvestorDashboard,
  type InvestorDashboardData,
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
    const { resume, projets, dernieres_analyses } = data

    const statCards = [
      { icon: icons.projects, label: t('investor_dash.total_projects'), value: resume.nb_projets, sub: t('investor_dash.projects_sub'), color: PASTEL.blueDeep, bg: '#eff6ff' },
      { icon: icons.mapPin, label: t('investor_dash.total_terrains'), value: resume.nb_terrains, sub: t('investor_dash.terrains_sub'), color: PASTEL.lavandeDeep, bg: '#f5f3ff' },
      { icon: icons.ranking, label: t('investor_dash.total_analyses'), value: resume.nb_analyses, sub: t('investor_dash.analyses_sub'), color: PASTEL.pecheDeep, bg: '#fff7ed' },
      { icon: icons.layers, label: t('investor_dash.total_parcelles_cadastre'), value: resume.nb_parcelles_cadastre ?? 0, sub: t('investor_dash.parcelles_cadastre_sub'), color: PASTEL.mintDeep, bg: '#ecfdf5' },
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

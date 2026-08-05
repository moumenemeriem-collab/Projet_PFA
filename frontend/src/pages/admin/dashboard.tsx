import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '../../components/DashboardLayout'
import { icons } from '../../components/icons'
import { fetchDashboardStats, type DashboardStats, type MoisPoint } from '../../api/dashboard'
import { formatApiErrors } from '../../api/auth'
import { t } from '../../i18n/index'

const PASTEL = {
  blue: '#93c5fd',
  blueDeep: '#3b82f6',
  lavande: '#c4b5fd',
  lavandeDeep: '#8b5cf6',
  peche: '#fcd7b6',
  pecheDeep: '#f97316',
  rose: '#f9a8d4',
  roseDeep: '#ec4899',
  mint: '#a7f3d0',
  text: '#4b5563',
  textMuted: '#9ca3af',
  grid: '#f1f5f9',
}

function monthLabel(mois: string): string {
  const [y, m] = mois.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'short' })
}

function BarChart({ data, color, height = 180 }: { data: MoisPoint[]; color: string; height?: number }): React.JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.total))
  const n = data.length
  const slotW = 100 / n
  const barW = Math.min(slotW * 0.55, 26)
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="dash-chart-svg" role="img" aria-label="graphique">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1="0" y1={(1 - g) * height} x2="100" y2={(1 - g) * height} stroke={PASTEL.grid} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      ))}
      {data.map((d, i) => {
        const h = (d.total / max) * (height - 22)
        const x = i * slotW + (slotW - barW) / 2
        return (
          <rect
            key={d.mois}
            x={x}
            y={height - 14 - h}
            width={barW}
            height={Math.max(h, d.total > 0 ? 3 : 1)}
            rx="3"
            fill={color}
            opacity={d.total > 0 ? 0.9 : 0.12}
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${monthLabel(d.mois)} : ${d.total}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

function AreaChart({ data, color, height = 180 }: { data: MoisPoint[]; color: string; height?: number }): React.JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.total))
  const n = data.length
  const step = 100 / (n - 1 || 1)
  const pts = data.map((d, i) => [i * step, height - 18 - (d.total / max) * (height - 34)])
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L100,${height} L0,${height} Z`
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="dash-chart-svg" role="img" aria-label="graphique">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1="0" y1={(1 - g) * height} x2="100" y2={(1 - g) * height} stroke={PASTEL.grid} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={area} fill={color} opacity="0.28" vectorEffect="non-scaling-stroke" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill="#ffffff" stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke">
          <title>{`${monthLabel(data[i].mois)} : ${data[i].total}`}</title>
        </circle>
      ))}
    </svg>
  )
}

function DonutChart({ parts }: { parts: { label: string; value: number; color: string }[] }): React.JSX.Element {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0))
  const r = 15.9155
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="dash-donut">
      <svg viewBox="0 0 42 42" className="dash-donut-svg">
        <circle cx="21" cy="21" r={r} fill="none" stroke={PASTEL.grid} strokeWidth="4.5" />
        {parts.map((p, i) => {
          const frac = p.value / total
          const dash = frac * c
          const offset = -acc * c
          acc += frac
          return (
            <circle
              key={i}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="4.5"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 21 21)"
            >
              <title>{`${p.label} : ${p.value}`}</title>
            </circle>
          )
        })}
      </svg>
      <div className="dash-donut-center">
        <span className="dash-donut-total">{total}</span>
        <span className="dash-donut-label">{t('dash.total')}</span>
      </div>
    </div>
  )
}

const ACTION_LABEL: Record<string, string> = {
  ajout: 'dash.action_add',
  modification: 'dash.action_edit',
  suppression: 'dash.action_delete',
}

const ENTITE_LABEL: Record<string, string> = {
  utilisateur: 'dash.entity_user',
  projet: 'dash.entity_project',
  terrain: 'dash.entity_terrain',
  analyse: 'dash.entity_analysis',
  couche: 'dash.entity_layer',
  message: 'dash.entity_message',
  reponse: 'dash.entity_reply',
}

export function AdminDashboardPage(): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchDashboardStats()
      .then((s) => {
        if (cancelled) return
        setStats(s)
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
  }, [])

  let content: React.ReactNode

  if (loading) {
    content = (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>{t('dash.loading')}</p>
      </div>
    )
  } else if (error) {
    content = (
      <div className="admin-error-state">
        <p>{error}</p>
        <Link to="/admin/utilisateurs" className="btn btn-primary">{t('dash.error_back')}</Link>
      </div>
    )
  } else if (stats) {
    const u = stats.utilisateurs
    const c = stats.couches
    const a = stats.analyses
    const tk = stats.taches
    const act = stats.activite
    const uPct = u.total > 0 ? Math.round((u.actifs / u.total) * 100) : 0

    const statCards = [
      { icon: icons.users, label: t('dash.users_total'), value: u.total, sub: `${u.nouveaux} ${t('dash.users_new')}`, color: PASTEL.blue, bg: '#eff6ff' },
      { icon: icons.layers, label: t('dash.layers_total'), value: c.total, sub: `+${c.ajoutees} ${t('dash.layers_added')}`, color: PASTEL.lavandeDeep, bg: '#f5f3ff' },
      { icon: icons.ranking, label: t('dash.analyses_total'), value: a.total, sub: `+${a.semaine} ${t('dash.analyses_week')}`, color: PASTEL.pecheDeep, bg: '#fff7ed' },
      { icon: icons.check, label: t('dash.actions_total'), value: act.total, sub: `${act.projets} ${t('dash.projects')} · ${act.messages} ${t('dash.messages')}`, color: PASTEL.roseDeep, bg: '#fdf2f8' },
    ]

    content = (
      <div className="dash-page">
        <div className="dash-header">
          <div>
            <h2 className="dash-title">{t('dash.title')}</h2>
            <p className="dash-subtitle">{t('dash.subtitle')}</p>
          </div>
        </div>

        <div className="dash-stats-grid">
          {statCards.map((sc) => (
            <div className="dash-stat-card" key={sc.label}>
              <div className="dash-stat-icon" style={{ background: sc.bg, color: sc.color }}>{sc.icon}</div>
              <div className="dash-stat-body">
                <span className="dash-stat-value">{sc.value}</span>
                <span className="dash-stat-label">{sc.label}</span>
                <span className="dash-stat-sub">{sc.sub}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="dash-grid dash-grid--2">
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('dash.users_evolution')}</h3>
              <span className="dash-card-badge" style={{ background: '#eff6ff', color: PASTEL.blueDeep }}>{u.total}</span>
            </div>
            <div className="dash-chart-wrap">
              <BarChart data={u.evolution} color={PASTEL.blue} />
            </div>
            <div className="dash-chart-labels">
              {u.evolution.filter((_, i) => i % 3 === 0 || i === u.evolution.length - 1).map((d) => (
                <span key={d.mois}>{monthLabel(d.mois)}</span>
              ))}
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('dash.layers_evolution')}</h3>
              <span className="dash-card-badge" style={{ background: '#f5f3ff', color: PASTEL.lavandeDeep }}>{c.total}</span>
            </div>
            <div className="dash-chart-wrap">
              <AreaChart data={c.evolution} color={PASTEL.lavandeDeep} />
            </div>
            <div className="dash-chart-labels">
              {c.evolution.filter((_, i) => i % 3 === 0 || i === c.evolution.length - 1).map((d) => (
                <span key={d.mois}>{monthLabel(d.mois)}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-grid dash-grid--3">
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('dash.users_repartition')}</h3>
            </div>
            <div className="dash-donut-row">
              <DonutChart
                parts={[
                  { label: t('dash.users_active'), value: u.actifs, color: PASTEL.blue },
                  { label: t('dash.users_disabled'), value: u.desactives, color: PASTEL.lavande },
                ]}
              />
              <div className="dash-legend">
                <div className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: PASTEL.blue }}></span>
                  <span>{t('dash.users_active')}</span>
                  <strong>{u.actifs}</strong>
                </div>
                <div className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: PASTEL.lavande }}></span>
                  <span>{t('dash.users_disabled')}</span>
                  <strong>{u.desactives}</strong>
                </div>
                <div className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: PASTEL.peche }}></span>
                  <span>{t('dash.users_new')}</span>
                  <strong>{u.nouveaux}</strong>
                </div>
                <div className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: PASTEL.rose }}></span>
                  <span>{t('dash.users_pct_active')}</span>
                  <strong>{uPct}%</strong>
                </div>
              </div>
            </div>
            <div className="dash-progress">
              <span className="dash-progress-label">{t('dash.users_active_rate')}</span>
              <span className="dash-progress-value">{uPct}%</span>
              <div className="dash-progress-bar">
                <div className="dash-progress-fill" style={{ width: `${uPct}%`, background: PASTEL.blue }}></div>
              </div>
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('dash.layers_management')}</h3>
            </div>
            <div className="dash-tasks-list">
              <div className="dash-task-row">
                <span className="dash-task-badge dash-task-badge--blue">{t('dash.layers_added')}</span>
                <strong>{c.ajoutees}</strong>
              </div>
              <div className="dash-task-row">
                <span className="dash-task-badge dash-task-badge--lavande">{t('dash.layers_modified')}</span>
                <strong>{c.modifiees}</strong>
              </div>
              <div className="dash-task-row">
                <span className="dash-task-badge dash-task-badge--rose">{t('dash.layers_deleted')}</span>
                <strong>{c.supprimees}</strong>
              </div>
            </div>
            <div className="dash-chart-wrap dash-chart-wrap--sm">
              <BarChart data={c.evolution} color={PASTEL.pecheDeep} height={120} />
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('dash.tasks_title')}</h3>
            </div>
            <div className="dash-donut-row">
              <DonutChart
                parts={[
                  { label: t('dash.tasks_pending'), value: tk.attente, color: PASTEL.peche },
                  { label: t('dash.tasks_running'), value: tk.cours, color: PASTEL.lavande },
                  { label: t('dash.tasks_done'), value: tk.terminees, color: PASTEL.mint },
                ]}
              />
              <div className="dash-legend">
                <div className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: PASTEL.peche }}></span>
                  <span>{t('dash.tasks_pending')}</span>
                  <strong>{tk.attente}</strong>
                </div>
                <div className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: PASTEL.lavande }}></span>
                  <span>{t('dash.tasks_running')}</span>
                  <strong>{tk.cours}</strong>
                </div>
                <div className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: PASTEL.mint }}></span>
                  <span>{t('dash.tasks_done')}</span>
                  <strong>{tk.terminees}</strong>
                </div>
              </div>
            </div>
            <div className="dash-chart-wrap dash-chart-wrap--sm">
              <AreaChart data={a.evolution} color={PASTEL.lavandeDeep} height={120} />
            </div>
          </div>
        </div>

        <div className="dash-grid dash-grid--2">
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('dash.analyses_evolution')}</h3>
              <span className="dash-card-badge" style={{ background: '#fff7ed', color: PASTEL.pecheDeep }}>{a.total}</span>
            </div>
            <div className="dash-chart-wrap">
              <AreaChart data={a.evolution} color={PASTEL.pecheDeep} />
            </div>
            <div className="dash-chart-labels">
              {a.evolution.filter((_, i) => i % 3 === 0 || i === a.evolution.length - 1).map((d) => (
                <span key={d.mois}>{monthLabel(d.mois)}</span>
              ))}
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">{t('dash.activity_evolution')}</h3>
              <span className="dash-card-badge" style={{ background: '#fdf2f8', color: PASTEL.roseDeep }}>{act.total}</span>
            </div>
            <div className="dash-chart-wrap">
              <BarChart data={act.evolution} color={PASTEL.rose} />
            </div>
            <div className="dash-chart-labels">
              {act.evolution.filter((_, i) => i % 3 === 0 || i === act.evolution.length - 1).map((d) => (
                <span key={d.mois}>{monthLabel(d.mois)}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h3 className="dash-card-title">{t('dash.recent_title')}</h3>
          </div>
          {act.historique.length > 0 ? (
            <div className="dash-history">
              {act.historique.map((h) => (
                <div className="dash-history-row" key={h.id}>
                  <span className={`dash-history-badge dash-history-badge--${h.action}`}>
                    {t(ACTION_LABEL[h.action] ?? 'dash.action_add')}
                  </span>
                  <span className="dash-history-entity">{t(ENTITE_LABEL[h.entite] ?? 'dash.entity_user')}</span>
                  <span className="dash-history-desc">{h.description}</span>
                  <span className="dash-history-user">{h.utilisateur}</span>
                  <span className="dash-history-date">
                    {new Date(h.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dash-history-empty">{t('dash.recent_empty')}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout role="admin" activePage="dashboard">
      {content}
    </DashboardLayout>
  )
}

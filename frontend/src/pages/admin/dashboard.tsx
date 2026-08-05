import { useEffect, useId, useState } from 'react'
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
  mintDeep: '#059669',
  sky: '#7dd3fc',
  skyDeep: '#0284c7',
  ambre: '#fde68a',
  ambreDeep: '#d97706',
  violet: '#ddd6fe',
  violetDeep: '#7c3aed',
  text: '#4b5563',
  textMuted: '#9ca3af',
  grid: '#f1f5f9',
}

function monthLabel(mois: string): string {
  const [y, m] = mois.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'short' })
}

function niceMax(values: number[], minCeil = 5): number {
  const raw = Math.max(1, ...values)
  return Math.max(minCeil, Math.ceil(raw / 5) * 5)
}

function ChartTip({ mois, total, xPct }: { mois: string; total: number; xPct: number }): React.JSX.Element {
  const clamped = Math.min(90, Math.max(10, xPct))
  return (
    <div className="dash-chart-tip" style={{ left: `${clamped.toFixed(1)}%` }}>
      <span className="dash-chart-tip-mois">{monthLabel(mois)}</span>
      <strong className="dash-chart-tip-val">{total}</strong>
    </div>
  )
}

function BarChart({ data, color, height = 180 }: { data: MoisPoint[]; color: string; height?: number }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const max = niceMax(data.map((d) => d.total))
  const n = data.length
  const slotW = 100 / n
  const barW = Math.min(slotW * 0.55, 26)
  return (
    <div className="dash-chart-zone" onMouseLeave={() => setHover(null)}>
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
              opacity={hover === i ? 1 : d.total > 0 ? 0.9 : 0.12}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => setHover(i)}
            >
              <title>{`${monthLabel(d.mois)} : ${d.total}`}</title>
            </rect>
          )
        })}
      </svg>
      {hover !== null && data[hover] && (
        <ChartTip mois={data[hover].mois} total={data[hover].total} xPct={(hover + 0.5) * slotW} />
      )}
    </div>
  )
}

function smoothSegments(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return d
}

function AreaChart({ data, color, height = 180 }: { data: MoisPoint[]; color: string; height?: number }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId()
  const max = niceMax(data.map((d) => d.total))
  const n = data.length
  const pad = 100 / (n - 1 || 1) / 2
  const span = 100 - 2 * pad
  const innerStep = span / (n - 1 || 1)
  const pts = data.map((d, i): [number, number] => [pad + i * innerStep, height - 18 - (d.total / max) * (height - 34)])
  const segs = smoothSegments(pts)
  const first = pts[0]
  const lastP = pts[pts.length - 1]
  const line = `M${first[0].toFixed(2)},${first[1].toFixed(2)} ${segs}`
  const area = `M${first[0].toFixed(2)},${height} L${first[0].toFixed(2)},${first[1].toFixed(2)} ${segs} L${lastP[0].toFixed(2)},${height} Z`
  const last = n - 1
  return (
    <div className="dash-chart-zone" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="dash-chart-svg" role="img" aria-label="graphique">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" y1={(1 - g) * height} x2="100" y2={(1 - g) * height} stroke={PASTEL.grid} strokeWidth="0.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#${gid})`} vectorEffect="non-scaling-stroke" />
        <path d={line} fill="none" stroke="#ffffff" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === last ? 3.2 : 2}
            fill={i === last ? color : '#ffffff'}
            stroke={color}
            strokeWidth={i === last ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${monthLabel(data[i].mois)} : ${data[i].total}`}</title>
          </circle>
        ))}
        {data.map((d, i) => (
          <rect
            key={`hit-${i}`}
            x={pad + i * innerStep - innerStep / 2}
            y={0}
            width={innerStep}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          >
            <title>{`${monthLabel(d.mois)} : ${d.total}`}</title>
          </rect>
        ))}
      </svg>
      {hover !== null && data[hover] && (
        <ChartTip mois={data[hover].mois} total={data[hover].total} xPct={pad + hover * innerStep} />
      )}
    </div>
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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchDashboardStats()
      .then((s) => {
        if (cancelled) return
        setStats(s)
        setLastUpdate(new Date())
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

  useEffect(() => {
    const id = setInterval(() => {
      fetchDashboardStats()
        .then((s) => {
          setStats(s)
          setLastUpdate(new Date())
          setError('')
        })
        .catch((err) => {
          setError(formatApiErrors(err))
        })
    }, 30000)
    return () => clearInterval(id)
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
    const act = stats.activite
    const uPct = u.total > 0 ? Math.round((u.actifs / u.total) * 100) : 0
    const aujPct = u.total > 0 ? Math.round((u.actifs_aujourdhui / u.total) * 100) : 0

    const statCards = [
      { icon: icons.users, label: t('dash.users_total'), value: u.total, sub: `${u.nouveaux} ${t('dash.users_new')}`, color: PASTEL.blue, bg: '#eff6ff' },
      { icon: icons.check, label: t('dash.users_active_today'), value: u.actifs_aujourdhui, sub: `${aujPct}% ${t('dash.users_active_rate')}`, color: PASTEL.mintDeep, bg: '#ecfdf5' },
      { icon: icons.projects, label: t('dash.projects_total'), value: act.projets, sub: t('dash.projects_sub'), color: PASTEL.lavandeDeep, bg: '#f5f3ff' },
      { icon: icons.ranking, label: t('dash.analyses_total'), value: a.total, sub: `+${a.semaine} ${t('dash.analyses_week')}`, color: PASTEL.pecheDeep, bg: '#fff7ed' },
      { icon: icons.layers, label: t('dash.layers_total'), value: c.total, sub: `+${c.ajoutees} ${t('dash.layers_added')}`, color: PASTEL.roseDeep, bg: '#fdf2f8' },
      { icon: icons.mapPin, label: t('dash.terrains_total'), value: act.parcelles_cadastrales, sub: t('dash.terrains_sub'), color: PASTEL.skyDeep, bg: '#f0f9ff' },
      { icon: icons.message, label: t('dash.messages_total'), value: act.messages, sub: t('dash.messages_sub'), color: PASTEL.ambreDeep, bg: '#fffbeb' },
      { icon: icons.bell, label: t('dash.notifications_unread'), value: act.notifications_non_lues, sub: t('dash.notifications_sub'), color: PASTEL.violetDeep, bg: '#faf5ff' },
    ]

    content = (
      <div className="dash-page">
        <div className="dash-header">
          <div>
            <h2 className="dash-title">{t('dash.title')}</h2>
            <p className="dash-subtitle">{t('dash.subtitle')}</p>
          </div>
          <span className="dash-updated">
            {t('dash.updated_at')} {lastUpdate ? lastUpdate.toLocaleTimeString('fr-FR') : '—'}
          </span>
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
            <p className="dash-chart-hint">{t('dash.analyses_evo_hint')}</p>
          </div>
        </div>

        <div className="dash-grid dash-grid--2">
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

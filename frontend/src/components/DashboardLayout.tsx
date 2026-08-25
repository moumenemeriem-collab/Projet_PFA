import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clearSession, getStoredUser } from '../api/auth'
import { deleteNotification, fetchNotifications, markNotificationsRead, type Notification } from '../api/messagerie'
import { t, formatDateTime } from '../i18n/index'
import { icons } from './icons'
import { LangSwitcher } from './LangSwitcher'

export type AppPage = 'dashboard' | 'projects' | 'users' | 'messages' | 'data' | 'ranking' | 'geoportail' | 'profile' | 'project_details'

interface NavItem {
  id: AppPage
  labelKey: string
  icon: keyof typeof icons
  href: string
}

const investisseurNav: NavItem[] = [
  { id: 'dashboard', labelKey: 'dashboard.sidebar.home', icon: 'dashboard', href: '/investisseur/tableau-de-bord' },
  { id: 'projects', labelKey: 'dashboard.sidebar.projects', icon: 'projects', href: '/projets' },
  { id: 'messages', labelKey: 'dashboard.sidebar.messages', icon: 'message', href: '/messages' },
  { id: 'profile', labelKey: 'dashboard.sidebar.profile', icon: 'profile', href: '/profil' },
]

const investisseurProjectNav: NavItem[] = [
  { id: 'project_details', labelKey: 'dashboard.sidebar.project_details', icon: 'folder', href: '' },
  { id: 'ranking', labelKey: 'dashboard.sidebar.ranking', icon: 'ranking', href: '' },
  { id: 'geoportail', labelKey: 'dashboard.sidebar.geoportail', icon: 'globe', href: '' },
]

const adminNav: NavItem[] = [
  { id: 'dashboard', labelKey: 'admin.sidebar.home', icon: 'dashboard', href: '/admin/tableau-de-bord' },
  { id: 'users', labelKey: 'admin.sidebar.users', icon: 'users', href: '/admin/utilisateurs' },
  { id: 'messages', labelKey: 'admin.sidebar.messages', icon: 'message', href: '/admin/messages' },
  { id: 'data', labelKey: 'admin.sidebar.data', icon: 'database', href: '/admin/donnees' },
  { id: 'profile', labelKey: 'admin.sidebar.profile', icon: 'profile', href: '/admin/profil' },
]

interface DashboardLayoutProps {
  role: 'investisseur' | 'admin'
  activePage: AppPage
  children: React.ReactNode
  hideSidebar?: boolean
  topbarTitle?: string
  projectContext?: { id: number; name: string } | null
}

export function DashboardLayout({ role, activePage, children, hideSidebar = false, topbarTitle, projectContext }: DashboardLayoutProps): React.JSX.Element | null {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [notifOpen, setNotifOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [nonLues, setNonLues] = useState(0)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications().then((data) => setNonLues(data.non_lues)).catch(() => {})
  }, [])

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const toggleDropdown = async (): Promise<void> => {
    if (notifOpen) {
      setNotifOpen(false)
      return
    }
    try {
      const data = await fetchNotifications()
      setNotifs(data.results)
      setNotifOpen(true)
      if (data.non_lues > 0) {
        setNonLues(0)
        await markNotificationsRead()
      }
    } catch {
      setNotifOpen(true)
    }
  }

  const dismissNotif = async (id: number): Promise<void> => {
    try {
      await deleteNotification(id)
      setNotifs((prev) => prev.filter((n) => n.id !== id))
    } catch {
      /* ignore */
    }
  }

  const handleLogout = (): void => {
    clearSession()
    navigate('/login')
  }

  if (!user) return null

  const nav = role === 'admin' ? adminNav : projectContext ? investisseurProjectNav : investisseurNav
  const profileUrl = role === 'admin' ? '/admin/profil' : '/profil'
  const defaultTitle = projectContext ? `${t('dashboard.topbar.space')}  Projet : ${projectContext.name}` : t(role === 'admin' ? 'admin.topbar.space' : 'dashboard.topbar.space')
  const spaceTitle = topbarTitle ?? defaultTitle

  // ── Espace projet : navbar horizontale glassmorphism ──
  // eslint-disable-next-line prefer-const -- `let` évite la propagation du narrowing TS au bloc sidebar d'origine
  let ctx = projectContext
  if (ctx) {
    // Géoportail (hideSidebar) : pas de navbar projet — la page a sa propre barre d'outils
    if (hideSidebar) {
      return (
        <div className="app-shell app-shell--project app-shell--full">
          <main className="app-content app-content--full">{children}</main>
        </div>
      )
    }
    return (
      <div className={hideSidebar ? 'app-shell app-shell--project app-shell--full' : 'app-shell app-shell--project'}>
        <header className="app-pnav">
          <div className="app-pnav-brand">
            <span className="app-pnav-logo">{icons.logo}</span>
            <span className="app-pnav-title">{t('dashboard.topbar.space')}</span>
          </div>
          <nav className={`app-pnav-links${menuOpen ? ' app-pnav-links--open' : ''}`}>
            <span className="app-pnav-project-title">
              Projet : {ctx.name}
            </span>
            {nav.map((item) => {
              const href = item.id === 'project_details'
                ? `/projets/${ctx.id}/details`
                : item.id === 'ranking'
                ? `/projets/${ctx.id}/classement`
                : item.id === 'geoportail'
                ? `/projets/${ctx.id}/classement/ajouter`
                : item.href
              return (
                <Fragment key={item.id}>
                  <Link
                    to={href}
                    className={`app-pnav-link${activePage === item.id ? ' app-pnav-link--active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t(item.labelKey)}
                  </Link>
                  {item.id === 'geoportail' ? (
                    <button
                      type="button"
                      className="app-pnav-quit"
                      title={t('dashboard.sidebar.quit')}
                      onClick={() => navigate('/projets')}
                    >
                      {t('dashboard.sidebar.quit')}
                    </button>
                  ) : null}
                </Fragment>
              )
            })}
          </nav>
          <div className="app-pnav-right">
            <div className="notification-wrapper" ref={wrapperRef}>
              <button type="button" className="notification-bell" title={t('notif.title')} onClick={(e) => { e.stopPropagation(); void toggleDropdown() }}>
                {icons.bell}
                {nonLues > 0 ? <span className="notification-badge">{nonLues}</span> : null}
              </button>
              {notifOpen ? (
                <div className="notification-dropdown">
                  <div className="notif-header">{t('notif.title')}</div>
                  <div className="notif-list">
                    {notifs.length > 0 ? (
                      notifs.map((n) => (
                        <div
                          className={`notif-item${n.lu ? '' : ' notif-item--unread'}`}
                          key={n.id}
                          onClick={() => {
                            setNotifOpen(false)
                            if (n.message_id != null) {
                              navigate(role === 'admin' ? `/admin/messages?message=${n.message_id}` : `/messages?message=${n.message_id}`)
                            } else {
                              navigate(role === 'admin' ? '/admin/messages' : '/messages')
                            }
                          }}
                        >
                          <div className="notif-item-body">
                            <div className="notif-item-title">{n.titre}</div>
                            <div className="notif-item-content">{n.contenu}</div>
                            <div className="notif-item-date">{formatDateTime(n.date_creation)}</div>
                          </div>
                          <button
                            type="button"
                            className="notif-dismiss"
                            title={t('common.dismiss')}
                            onClick={(e) => {
                              e.stopPropagation()
                              void dismissNotif(n.id)
                            }}
                          >
                            {icons.close}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="notif-empty">{t('notif.empty')}</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <LangSwitcher className="lang-switcher--topbar" />
            <div className="dashboard-topbar-user">
              <div className="dashboard-topbar-user-info">
                <span className="dashboard-topbar-user-name">{user.prenom} {user.nom}</span>
                <span className="dashboard-topbar-user-email">{user.email}</span>
              </div>
              <Link to={profileUrl} className="dashboard-topbar-avatar">
                {user.prenom.charAt(0)}{user.nom.charAt(0)}
              </Link>
            </div>
            <button
              type="button"
              className="app-pnav-logout"
              title={t(role === 'admin' ? 'admin.sidebar.logout' : 'dashboard.sidebar.logout')}
              onClick={handleLogout}
            >
              {icons.logout}
            </button>
            <button
              type="button"
              className="app-pnav-burger"
              title={t('dashboard.topbar.menu')}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? icons.close : icons.menu}
            </button>
          </div>
        </header>
        <main className={hideSidebar ? 'app-content app-content--full' : 'app-content'}>
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className={hideSidebar ? 'app-shell app-shell--full' : 'app-shell'}>
      <header className="app-topbar">
        <div className="app-topbar-brand">
          <span className="app-topbar-logo">{icons.logo}</span>
          <span className="app-topbar-title">{spaceTitle}</span>
        </div>
        <div className="app-topbar-right">
          <div className="notification-wrapper" ref={wrapperRef}>
            <button type="button" className="notification-bell" title={t('notif.title')} onClick={(e) => { e.stopPropagation(); void toggleDropdown() }}>
              {icons.bell}
              {nonLues > 0 ? <span className="notification-badge">{nonLues}</span> : null}
            </button>
            {notifOpen ? (
              <div className="notification-dropdown">
                <div className="notif-header">{t('notif.title')}</div>
                <div className="notif-list">
                  {notifs.length > 0 ? (
                    notifs.map((n) => (
                      <div
                        className={`notif-item${n.lu ? '' : ' notif-item--unread'}`}
                        key={n.id}
                        onClick={() => {
                          setNotifOpen(false)
                          if (n.message_id != null) {
                            navigate(role === 'admin' ? `/admin/messages?message=${n.message_id}` : `/messages?message=${n.message_id}`)
                          } else {
                            navigate(role === 'admin' ? '/admin/messages' : '/messages')
                          }
                        }}
                      >
                        <div className="notif-item-body">
                          <div className="notif-item-title">{n.titre}</div>
                          <div className="notif-item-content">{n.contenu}</div>
                          <div className="notif-item-date">{formatDateTime(n.date_creation)}</div>
                        </div>
                        <button
                          type="button"
                          className="notif-dismiss"
                          title={t('common.dismiss')}
                          onClick={(e) => {
                            e.stopPropagation()
                            void dismissNotif(n.id)
                          }}
                        >
                          {icons.close}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="notif-empty">{t('notif.empty')}</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <LangSwitcher className="lang-switcher--topbar" />
          <div className="dashboard-topbar-user">
            <div className="dashboard-topbar-user-info">
              <span className="dashboard-topbar-user-name">{user.prenom} {user.nom}</span>
              <span className="dashboard-topbar-user-email">{user.email}</span>
            </div>
            <Link to={profileUrl} className="dashboard-topbar-avatar">
              {user.prenom.charAt(0)}{user.nom.charAt(0)}
            </Link>
          </div>
        </div>
      </header>
      <div className="app-body">
        {hideSidebar ? null : (
          <aside className="app-sidebar">
            <nav className="app-sidebar-nav">
              {nav.map((item) => {
                const href = projectContext && item.id === 'ranking'
                  ? `/projets/${projectContext.id}/classement`
                  : projectContext && item.id === 'geoportail'
                  ? `/projets/${projectContext.id}/classement/ajouter`
                  : item.href
                return (
                  <Link
                    to={href}
                    className={`app-sidebar-link${activePage === item.id ? ' app-sidebar-link--active' : ''}`}
                    key={item.id}
                  >
                    <span className="app-sidebar-link-icon">{icons[item.icon]}</span>
                    {t(item.labelKey)}
                  </Link>
                )
              })}
            </nav>
            {projectContext ? (
              <button type="button" className="app-sidebar-quit" onClick={() => navigate('/projets')}>
                <span className="app-sidebar-logout-icon">{icons.close}</span>
                {t('dashboard.sidebar.quit')}
              </button>
            ) : null}
            <button type="button" className="app-sidebar-logout" onClick={handleLogout}>
              <span className="app-sidebar-logout-icon">{icons.logout}</span>
              {t(role === 'admin' ? 'admin.sidebar.logout' : 'dashboard.sidebar.logout')}
            </button>
          </aside>
        )}
        <main className={hideSidebar ? 'app-content app-content--full' : 'app-content'}>
          {children}
        </main>
      </div>
    </div>
  )
}

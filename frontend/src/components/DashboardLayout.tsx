import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clearSession, getStoredUser } from '../api/auth'
import { deleteNotification, fetchNotifications, markNotificationsRead, type Notification } from '../api/messagerie'
import { t, formatDateTime } from '../i18n/index'
import { icons } from './icons'
import { LangSwitcher } from './LangSwitcher'

export type AppPage = 'dashboard' | 'projects' | 'users' | 'messages' | 'data' | 'ranking' | 'profile'

interface NavItem {
  id: AppPage
  labelKey: string
  icon: keyof typeof icons
  href: string
}

const investisseurNav: NavItem[] = [
  { id: 'dashboard', labelKey: 'dashboard.sidebar.home', icon: 'dashboard', href: '/projets' },
  { id: 'projects', labelKey: 'dashboard.sidebar.projects', icon: 'projects', href: '/projets' },
  { id: 'messages', labelKey: 'dashboard.sidebar.messages', icon: 'message', href: '/messages' },
  { id: 'ranking', labelKey: 'dashboard.sidebar.ranking', icon: 'ranking', href: '/projets' },
  { id: 'profile', labelKey: 'dashboard.sidebar.profile', icon: 'profile', href: '/profil' },
]

const adminNav: NavItem[] = [
  { id: 'dashboard', labelKey: 'admin.sidebar.home', icon: 'dashboard', href: '/admin/utilisateurs' },
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
}

export function DashboardLayout({ role, activePage, children, hideSidebar = false, topbarTitle }: DashboardLayoutProps): React.JSX.Element | null {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [notifOpen, setNotifOpen] = useState(false)
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

  const nav = role === 'admin' ? adminNav : investisseurNav
  const profileUrl = role === 'admin' ? '/admin/profil' : '/profil'
  const spaceTitle = topbarTitle ?? t(role === 'admin' ? 'admin.topbar.space' : 'dashboard.topbar.space')

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
                          navigate('/messages')
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
              {nav.map((item) => (
                <Link
                  to={item.href}
                  className={`app-sidebar-link${activePage === item.id ? ' app-sidebar-link--active' : ''}`}
                  key={item.id}
                >
                  <span className="app-sidebar-link-icon">{icons[item.icon]}</span>
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
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

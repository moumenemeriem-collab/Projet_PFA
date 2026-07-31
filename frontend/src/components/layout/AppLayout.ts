import { icons } from '../icons.ts'
import { clearSession, type Utilisateur } from '../../api/auth.ts'
import { deleteNotification, fetchNotifications, markNotificationsRead } from '../../api/messagerie.ts'
import { t, langSwitcherHTML, setupLangSwitcher, formatDateTime } from '../../i18n/index'

export type AppPage = 'dashboard' | 'projects' | 'users' | 'messages' | 'data' | 'ranking' | 'profile'

export interface AppLayoutOptions {
  user: Utilisateur
  role: 'investisseur' | 'admin'
  activePage: AppPage
  content: string
  nonLues?: number
}

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

export function renderAppLayout(options: AppLayoutOptions): string {
  const { user, role, activePage, content, nonLues = 0 } = options
  const nav = role === 'admin' ? adminNav : investisseurNav
  const profileUrl = role === 'admin' ? '/admin/profil' : '/profil'
  const spaceTitle = t(role === 'admin' ? 'admin.topbar.space' : 'dashboard.topbar.space')

  return `
    <div class="app-shell">
      <header class="app-topbar">
        <div class="app-topbar-brand">
          <span class="app-topbar-logo">${icons.logo}</span>
          <span class="app-topbar-title">${spaceTitle}</span>
        </div>
        <div class="app-topbar-right">
          <div class="notification-wrapper" id="notif-wrapper">
            <button type="button" class="notification-bell" id="notif-bell" title="${t('notif.title')}">
              ${icons.bell}
              ${nonLues > 0 ? `<span class="notification-badge">${nonLues}</span>` : ''}
            </button>
            <div class="notification-dropdown" id="notif-dropdown" hidden></div>
          </div>
          ${langSwitcherHTML('lang-switcher--topbar')}
          <div class="dashboard-topbar-user">
            <div class="dashboard-topbar-user-info">
              <span class="dashboard-topbar-user-name">${user.prenom} ${user.nom}</span>
              <span class="dashboard-topbar-user-email">${user.email}</span>
            </div>
            <a href="${profileUrl}" class="dashboard-topbar-avatar">${user.prenom.charAt(0)}${user.nom.charAt(0)}</a>
          </div>
        </div>
      </header>
      <div class="app-body">
        <aside class="app-sidebar">
          <nav class="app-sidebar-nav">
            ${nav
              .map(
                (item) => `
              <a href="${item.href}" class="app-sidebar-link${activePage === item.id ? ' app-sidebar-link--active' : ''}">
                <span class="app-sidebar-link-icon">${icons[item.icon]}</span>
                ${t(item.labelKey)}
              </a>
            `,
              )
              .join('')}
          </nav>
          <button type="button" class="app-sidebar-logout" id="logout-btn">
            <span class="app-sidebar-logout-icon">${icons.logout}</span>
            ${t(role === 'admin' ? 'admin.sidebar.logout' : 'dashboard.sidebar.logout')}
          </button>
        </aside>
        <main class="app-content">
          ${content}
        </main>
      </div>
    </div>
  `
}

export function setupAppLayout(root: HTMLElement): void {
  const bell = root.querySelector('#notif-bell')

  root.querySelector('#logout-btn')?.addEventListener('click', () => {
    clearSession()
    window.location.href = '/login'
  })

  fetchNotifications().then(data => {
    if (!bell) return
    const existing = bell.querySelector('.notification-badge')
    if (existing) existing.remove()
    if (data.non_lues > 0) {
      const badge = document.createElement('span')
      badge.className = 'notification-badge'
      badge.textContent = String(data.non_lues)
      bell.appendChild(badge)
    }
  }).catch(() => {})

  const dropdown = root.querySelector<HTMLElement>('#notif-dropdown')
  if (bell && dropdown) {
    bell.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!dropdown.hidden) { dropdown.hidden = true; return }
      try {
        const data = await fetchNotifications()
        dropdown.innerHTML = `
          <div class="notif-header">${t('notif.title')}</div>
          <div class="notif-list">
            ${data.results.length > 0
              ? data.results.map(n => `
                <div class="notif-item${n.lu ? '' : ' notif-item--unread'}" data-notif-id="${n.id}" data-msg-id="${n.message_id ?? ''}">
                  <div class="notif-item-body">
                    <div class="notif-item-title">${n.titre}</div>
                    <div class="notif-item-content">${n.contenu}</div>
                    <div class="notif-item-date">${formatDateTime(n.date_creation)}</div>
                  </div>
                  <button type="button" class="notif-dismiss" data-dismiss-id="${n.id}" title="${t('common.dismiss')}">${icons.close}</button>
                </div>
              `).join('')
              : `<div class="notif-empty">${t('notif.empty')}</div>`}
          </div>
        `
        dropdown.hidden = false

        dropdown.querySelectorAll('.notif-item').forEach(item => {
          item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.notif-dismiss')) return
            const msgId = (item as HTMLElement).dataset.msgId
            if (msgId) {
              dropdown.hidden = true
              window.location.href = `/messages`
            }
          })
        })

        dropdown.querySelectorAll('.notif-dismiss').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation()
            const id = Number((btn as HTMLElement).dataset.dismissId)
            try {
              await deleteNotification(id)
              const item = dropdown.querySelector(`[data-notif-id="${id}"]`)
              if (item) item.remove()
              if (!dropdown.querySelector('.notif-item')) {
                dropdown.innerHTML = `
                  <div class="notif-header">${t('notif.title')}</div>
                  <div class="notif-list"><div class="notif-empty">${t('notif.empty')}</div></div>
                `
              }
              const badge = bell.querySelector('.notification-badge')
              if (badge) {
                const count = parseInt(badge.textContent || '1') - 1
                if (count <= 0) badge.remove()
                else badge.textContent = String(count)
              }
            } catch { /* ignore */ }
          })
        })

        if (data.non_lues > 0) {
          await markNotificationsRead()
          const badge = bell.querySelector('.notification-badge')
          if (badge) badge.remove()
        }
      } catch { /* ignore */ }
    })
    document.addEventListener('click', () => { dropdown.hidden = true })
    dropdown.addEventListener('click', (e) => { e.stopPropagation() })
  }

  setupLangSwitcher(root)
}

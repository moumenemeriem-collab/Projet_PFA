import { icons } from '../icons.ts'
import { clearSession } from '../../api/auth.ts'
import type { Utilisateur } from '../../api/auth.ts'
import { deleteNotification, fetchNotifications, markNotificationsRead } from '../../api/messagerie.ts'
import { t, langSwitcherHTML, setupLangSwitcher, formatDateTime } from '../../i18n/index'

export type DashboardPage = 'dashboard' | 'projects' | 'messages' | 'ranking' | 'profile'

export interface DashboardLayoutOptions {
  user: Utilisateur
  activePage: DashboardPage
  content: string
  nonLues?: number
}

const navItems: { id: DashboardPage; labelKey: string; icon: keyof typeof icons; href: string }[] = [
  { id: 'dashboard', labelKey: 'dashboard.sidebar.home', icon: 'dashboard', href: '/projets' },
  { id: 'projects', labelKey: 'dashboard.sidebar.projects', icon: 'projects', href: '/projets' },
  { id: 'messages', labelKey: 'dashboard.sidebar.messages', icon: 'message', href: '/messages' },
  { id: 'ranking', labelKey: 'dashboard.sidebar.ranking', icon: 'ranking', href: '/projets' },
  { id: 'profile', labelKey: 'dashboard.sidebar.profile', icon: 'profile', href: '/profil' },
]

export function renderDashboardLayout(options: DashboardLayoutOptions): string {
  const { user, activePage, content, nonLues = 0 } = options

  return `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="sidebar-brand-icon">${icons.logo}</span>
          <span class="sidebar-brand-name">GEO INVEST</span>
        </div>
        <nav class="sidebar-nav">
          ${navItems
            .map(
              (item) => `
            <a href="${item.href}" class="sidebar-link${activePage === item.id ? ' sidebar-link--active' : ''}">
              <span class="sidebar-link-icon">${icons[item.icon]}</span>
              ${t(item.labelKey)}
            </a>
          `,
            )
            .join('')}
        </nav>
        <button type="button" class="sidebar-logout" id="logout-btn">
          <span class="sidebar-link-icon">${icons.logout}</span>
          ${t('dashboard.sidebar.logout')}
        </button>
      </aside>
      <div class="dashboard-main">
        <header class="dashboard-topbar">
          <div class="brand">
            <span class="brand-icon">${icons.logo}</span>
            <span class="brand-name">${t('dashboard.topbar.space')}</span>
          </div>
          <div class="dashboard-topbar-right">
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
              <a href="/profil" class="dashboard-topbar-avatar">${user.prenom.charAt(0)}${user.nom.charAt(0)}</a>
            </div>
          </div>
        </header>
        <main class="dashboard-content">
          ${content}
        </main>
      </div>
    </div>
  `
}

export function setupDashboardLayout(root: HTMLElement): void {
  root.querySelector('#logout-btn')?.addEventListener('click', () => {
    clearSession()
    window.location.href = '/login'
  })

  const bell = root.querySelector('#notif-bell')

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
                  <button type="button" class="notif-dismiss" data-dismiss-id="${n.id}" title="Masquer">${icons.close}</button>
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

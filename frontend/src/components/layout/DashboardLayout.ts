import { icons } from '../icons.ts'
import { clearSession } from '../../api/auth.ts'
import type { Utilisateur } from '../../api/auth.ts'

export type DashboardPage = 'dashboard' | 'projects' | 'ranking' | 'profile'

export interface DashboardLayoutOptions {
  user: Utilisateur
  activePage: DashboardPage
  content: string
}

const navItems: { id: DashboardPage; label: string; icon: keyof typeof icons; href: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', href: '/projets' },
  { id: 'projects', label: 'Projets', icon: 'projects', href: '/projets' },
  { id: 'ranking', label: 'Classement', icon: 'ranking', href: '/projets' },
  { id: 'profile', label: 'Profil', icon: 'profile', href: '/profil' },
]

export function renderDashboardLayout(options: DashboardLayoutOptions): string {
  const { user, activePage, content } = options

  return `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="sidebar-brand-icon">${icons.logo}</span>
          <span class="sidebar-brand-name">WebSIG</span>
        </div>
        <nav class="sidebar-nav">
          ${navItems
            .map(
              (item) => `
            <a href="${item.href}" class="sidebar-link${activePage === item.id ? ' sidebar-link--active' : ''}">
              <span class="sidebar-link-icon">${icons[item.icon]}</span>
              ${item.label}
            </a>
          `,
            )
            .join('')}
        </nav>
        <button type="button" class="sidebar-logout" id="logout-btn">
          <span class="sidebar-link-icon">${icons.logout}</span>
          Déconnexion
        </button>
      </aside>
      <div class="dashboard-main">
        <header class="dashboard-topbar">
          <a href="/projets" class="brand">
            <span class="brand-icon">${icons.logo}</span>
            <span class="brand-name">WebSIG</span>
          </a>
          <nav class="site-nav">
            <a href="/" class="nav-link">Accueil</a>
            <a href="/" class="nav-link">Services</a>
          </nav>
          <div class="header-actions">
            <span class="nav-link nav-link--user">${user.prenom} ${user.nom}</span>
            <span class="role-badge">${user.role}</span>
            <a href="/profil" class="dashboard-topbar-avatar">${user.prenom.charAt(0)}${user.nom.charAt(0)}</a>
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
}

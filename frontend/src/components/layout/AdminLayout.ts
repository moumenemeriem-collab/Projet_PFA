import { icons } from '../icons.ts'
import { clearSession, type Utilisateur } from '../../api/auth.ts'

export type AdminPage = 'dashboard' | 'users' | 'data' | 'profile'

export interface AdminLayoutOptions {
  user: Utilisateur
  activePage: AdminPage
  content: string
}

const navItems: { id: AdminPage; label: string; icon: keyof typeof icons; href: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', href: '/admin/utilisateurs' },
  { id: 'users', label: 'Gestion des utilisateurs', icon: 'users', href: '/admin/utilisateurs' },
  { id: 'data', label: 'Gestion de données', icon: 'database', href: '/admin/utilisateurs' },
  { id: 'profile', label: 'Profil Admin', icon: 'profile', href: '/admin/profil' },
]

export function renderAdminLayout(options: AdminLayoutOptions): string {
  const { user, activePage, content } = options

  return `
    <div class="admin-dashboard">
      <aside class="admin-sidebar">
        <div class="admin-sidebar-brand">
          <span class="admin-sidebar-icon">${icons.logo}</span>
          <span class="admin-sidebar-name">Admin</span>
        </div>
        <nav class="admin-sidebar-nav">
          ${navItems
            .map(
              (item) => `
            <a href="${item.href}" class="admin-sidebar-link${activePage === item.id ? ' admin-sidebar-link--active' : ''}">
              <span class="admin-sidebar-link-icon">${icons[item.icon]}</span>
              <span class="admin-sidebar-link-label">${item.label}</span>
              ${activePage === item.id ? `<span class="admin-sidebar-chevron">${icons.chevron}</span>` : ''}
            </a>
          `,
            )
            .join('')}
        </nav>
        <button type="button" class="admin-sidebar-logout" id="logout-btn">
          <span class="admin-sidebar-link-icon">${icons.logout}</span>
          Déconnexion
        </button>
      </aside>
      <div class="admin-main">
        <header class="admin-topbar">
          <h1 class="admin-topbar-title">Gestion des Utilisateurs</h1>
          <div class="admin-topbar-user">
            <div class="admin-topbar-user-info" style="margin-left: 140px;">
              <span class="admin-topbar-user-name">${user.prenom} ${user.nom}</span>
              <span class="admin-topbar-user-email">${user.email}</span>
            </div>
            <div class="admin-topbar-avatar">${user.prenom.charAt(0)}${user.nom.charAt(0)}</div>
          </div>
        </header>
        <main class="admin-content">
          ${content}
        </main>
      </div>
    </div>
  `
}

export function setupAdminLayout(root: HTMLElement): void {
  root.querySelector('#logout-btn')?.addEventListener('click', () => {
    clearSession()
    window.location.href = '/login'
  })
}

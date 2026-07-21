import {
  getPostAuthRedirect,
  getStoredUser,
  isAuthenticated,
} from './api/auth.ts'
import { mountAdminProfilePage } from './pages/admin/profile.ts'
import { mountAdminUsersPage } from './pages/admin/users.ts'
import { mountLoginPage } from './pages/login.ts'
import { mountProfilePage } from './pages/profile.ts'
import { mountProjectsPage } from './pages/projects.ts'
import { mountRegisterPage } from './pages/register.ts'

type RouteHandler = (root: HTMLElement) => void | Promise<void>

interface RouteConfig {
  handler: RouteHandler
  requiresAuth?: boolean
  investisseurOnly?: boolean
  adminOnly?: boolean
  guestOnly?: boolean
}

const routes: Record<string, RouteConfig> = {
  '/login': { handler: mountLoginPage, guestOnly: true },
  '/register': { handler: mountRegisterPage, guestOnly: true },
  '/projets': { handler: mountProjectsPage, requiresAuth: true, investisseurOnly: true },
  '/profil': { handler: mountProfilePage, requiresAuth: true, investisseurOnly: true },
  '/admin/utilisateurs': { handler: mountAdminUsersPage, requiresAuth: true, adminOnly: true },
  '/admin/profil': { handler: mountAdminProfilePage, requiresAuth: true, adminOnly: true },
  '/': { handler: renderHome },
}

function renderHome(root: HTMLElement): void {
  const user = getStoredUser()

  if (user?.role === 'investisseur') {
    window.history.replaceState({}, '', '/projets')
    mountProjectsPage(root)
    return
  }

  if (user?.role === 'admin') {
    window.history.replaceState({}, '', '/admin/utilisateurs')
    void mountAdminUsersPage(root)
    return
  }

  root.innerHTML = `
    <div class="home-page">
      <header class="site-header">
        <a href="/" class="brand">
          <span class="brand-icon"><svg viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="currentColor"/><path d="M6 8h4l2 3 2-3h4l-5 7 5 7h-4l-2-3-2 3H6l5-7-5-7z" fill="white"/></svg></span>
          <span class="brand-name">WebSIG</span>
        </a>
        <nav class="site-nav">
          <a href="/" class="nav-link nav-link--active">Accueil</a>
          <a href="/" class="nav-link">Services</a>
        </nav>
        <div class="header-actions">
          ${
            user
              ? `<span class="nav-link">Bonjour, ${user.prenom}</span>`
              : '<a href="/login" class="nav-link">Se connecter</a>'
          }
          <a href="/register" class="btn btn-primary btn-sm">Commencer <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></a>
        </div>
      </header>
      <main class="home-main">
        <h1>Plateforme WebSIG Potentiel Foncier</h1>
        <p>Analysez le potentiel foncier de la province de Khémisset.</p>
        ${
          user
            ? `<p class="home-user">Connecté en tant que <strong>${user.prenom} ${user.nom}</strong> (${user.role})</p>`
            : `<div class="home-actions">
                <a href="/login" class="btn btn-outline">Se connecter</a>
                <a href="/register" class="btn btn-primary">Créer un compte</a>
              </div>`
        }
      </main>
    </div>
  `
}

function redirectTo(path: string): void {
  window.history.replaceState({}, '', path)
  navigate()
}

function navigate(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  const path = window.location.pathname
  const route = routes[path] ?? routes['/']
  const user = getStoredUser()

  if (route.guestOnly && isAuthenticated()) {
    redirectTo(getPostAuthRedirect(user!.role))
    return
  }

  if (route.requiresAuth && !isAuthenticated()) {
    redirectTo('/login')
    return
  }

  if (route.investisseurOnly && user?.role !== 'investisseur') {
    redirectTo(user?.role === 'admin' ? '/admin/utilisateurs' : '/')
    return
  }

  if (route.adminOnly && user?.role !== 'admin') {
    redirectTo(user?.role === 'investisseur' ? '/projets' : '/')
    return
  }

  route.handler(root)
}

export function initRouter(): void {
  window.addEventListener('popstate', navigate)

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const link = target.closest('a')
    if (!link) return

    const href = link.getAttribute('href')
    if (!href || href.startsWith('http') || href.startsWith('#')) return

    event.preventDefault()
    window.history.pushState({}, '', href)
    navigate()
  })

  navigate()
}

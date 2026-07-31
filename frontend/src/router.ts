import {
  getPostAuthRedirect,
  getStoredUser,
  isAuthenticated,
} from './api/auth.ts'
import { Header, setupHeader } from './components/Header'
import { Hero, setupHeroSlideshow } from './components/Hero'
import { Features } from './components/Features'
import { Benefits } from './components/Benefits'
import { CtaBanner } from './components/CtaBanner'
import { setupScrollAnimations } from './utils/scrollAnimations'
import { mountAdminDataPage } from './pages/admin/data.ts'
import { mountAdminMessagesPage } from './pages/admin/messages.ts'
import { mountAdminProfilePage } from './pages/admin/profile.ts'
import { mountAdminUsersPage } from './pages/admin/users.ts'
import { mountAboutPage } from './pages/about.ts'
import { mountLoginPage } from './pages/login.ts'
import { mountMessagesPage } from './pages/messages.ts'
import { mountProfilePage } from './pages/profile.ts'
import { mountCreateProjectPage } from './pages/create-project.ts'
import { mountProjectsPage } from './pages/projects.ts'
import { mountRegisterPage } from './pages/register.ts'
import { mountClassementPage } from './pages/classement.ts'
import { mountGeoportalPage } from './pages/geoportal.ts'

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
  '/a-propos': { handler: mountAboutPage },
  '/projets': { handler: mountProjectsPage, requiresAuth: true, investisseurOnly: true },
  '/projets/nouveau': { handler: mountCreateProjectPage, requiresAuth: true, investisseurOnly: true },
  '/projets/:id/classement': { handler: mountClassementPage, requiresAuth: true, investisseurOnly: true },
  '/projets/:id/classement/ajouter': { handler: mountGeoportalPage, requiresAuth: true, investisseurOnly: true },
  '/messages': { handler: mountMessagesPage, requiresAuth: true, investisseurOnly: true },
  '/profil': { handler: mountProfilePage, requiresAuth: true, investisseurOnly: true },
  '/admin/utilisateurs': { handler: mountAdminUsersPage, requiresAuth: true, adminOnly: true },
  '/admin/donnees': { handler: mountAdminDataPage, requiresAuth: true, adminOnly: true },
  '/admin/messages': { handler: mountAdminMessagesPage, requiresAuth: true, adminOnly: true },
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
    ${Header()}
    <main>
      ${Hero()}
      ${Features()}
      ${Benefits()}
      ${CtaBanner()}
    </main>
    <footer class="footer">
      <div class="container">
        <p>&copy; ${new Date().getFullYear()} GEO INVEST.</p>
      </div>
    </footer>
  `

  setupHeader()
  setupHeroSlideshow()
  setupScrollAnimations()
}

function redirectTo(path: string): void {
  window.history.replaceState({}, '', path)
  navigate()
}

function matchRoute(path: string): { handler: RouteHandler; config: RouteConfig } | null {
  if (routes[path]) return { handler: routes[path].handler, config: routes[path] }

  for (const [pattern, config] of Object.entries(routes)) {
    const paramPattern = pattern.replace(/:(\w+)/g, '([^/]+)')
    if (paramPattern !== pattern) {
      const regex = new RegExp(`^${paramPattern}$`)
      if (regex.test(path)) return { handler: config.handler, config }
    }
  }

  return null
}

function navigate(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  const path = window.location.pathname
  const match = matchRoute(path)
  if (!match) {
    routes['/'].handler(root)
    return
  }
  const { handler, config: route } = match
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

  handler(root)
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

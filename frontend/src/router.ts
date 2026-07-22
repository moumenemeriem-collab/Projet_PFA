import {
  getPostAuthRedirect,
  getStoredUser,
  isAuthenticated,
} from './api/auth.ts'
import { Header, setupHeader } from './components/Header'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { Benefits } from './components/Benefits'
import { CtaBanner } from './components/CtaBanner'
import { setupScrollAnimations } from './utils/scrollAnimations'
import { mountAdminMessagesPage } from './pages/admin/messages.ts'
import { mountAdminProfilePage } from './pages/admin/profile.ts'
import { mountAdminUsersPage } from './pages/admin/users.ts'
import { mountLoginPage } from './pages/login.ts'
import { mountMessagesPage } from './pages/messages.ts'
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
  '/messages': { handler: mountMessagesPage, requiresAuth: true, investisseurOnly: true },
  '/profil': { handler: mountProfilePage, requiresAuth: true, investisseurOnly: true },
  '/admin/utilisateurs': { handler: mountAdminUsersPage, requiresAuth: true, adminOnly: true },
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
  setupScrollAnimations()
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

import { navLinks } from '../data/landing'
import { icon, logoIcon } from './icons'

export function Header(): string {
  const links = navLinks
    .map(({ label, href }) => `<a href="${href}" class="nav-link">${label}</a>`)
    .join('')

  return `
    <header class="header">
      <div class="container header-inner">
        <a href="#accueil" class="logo">
          ${logoIcon()}
          <span class="logo-text">WebSIG</span>
        </a>
        <nav class="nav" aria-label="Navigation principale">
          ${links}
        </nav>
        <div class="header-actions">
          <a href="#connexion" class="btn-text">Se connecter</a>
          <a href="#inscription" class="btn btn-primary btn-sm">
            Commencer
            ${icon('chevron', 'btn-icon')}
          </a>
        </div>
        <button class="menu-toggle" aria-label="Ouvrir le menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  `
}

export function setupHeader(): void {
  const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle')
  const nav = document.querySelector<HTMLElement>('.nav')
  const headerActions = document.querySelector<HTMLElement>('.header-actions')

  toggle?.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!isOpen))
    nav?.classList.toggle('nav-open')
    headerActions?.classList.toggle('nav-open')
    toggle.classList.toggle('menu-open')
  })
}

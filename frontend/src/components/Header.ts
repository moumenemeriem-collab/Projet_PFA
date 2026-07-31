import { icon, logoIcon } from './icons'
import { t, langSwitcherHTML, setupLangSwitcher } from '../i18n/index'

export function Header(): string {
  return `
    <header class="header">
      <div class="header-container">
        <a href="/" class="logo">
          ${logoIcon()}
          <span class="logo-text">GEO INVEST</span>
        </a>

        <div class="header-right">
          <nav class="nav" aria-label="Navigation principale">
            <a href="/" class="nav-link">${t('nav.accueil')}</a>
            <a href="/#services" class="nav-link">${t('nav.services')}</a>
            <a href="/a-propos" class="nav-link">${t('nav.about')}</a>
          </nav>
          <div class="header-actions">
            ${langSwitcherHTML('lang-switcher--topbar')}
            <a href="/login" class="btn-text">${t('nav.login')}</a>
            <a href="/register" class="btn btn-primary btn-sm">
              ${t('nav.cta')}
              ${icon('chevron', 'btn-icon')}
            </a>
          </div>
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
  const headerRight = document.querySelector<HTMLElement>('.header-right')

  toggle?.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!isOpen))
    headerRight?.classList.toggle('header-right-open')
    toggle.classList.toggle('menu-open')
  })

  document.querySelectorAll<HTMLAnchorElement>('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      link.classList.remove('is-clicked')
      void link.offsetWidth
      link.classList.add('is-clicked')
    })
  })

  setupLangSwitcher()
}

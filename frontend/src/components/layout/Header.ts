import { icon, logoIcon } from '../icons'
import { t, langSwitcherHTML } from '../../i18n/index'

export interface HeaderOptions {
  activePage?: 'login' | 'register' | 'home'
}

export function renderHeader(options: HeaderOptions = {}): string {
  const { activePage } = options

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
            ${
              activePage === 'login'
                ? `<span class="btn-text btn-text--active">${t('nav.login')}</span>`
                : `<a href="/login" class="btn-text">${t('nav.login')}</a>`
            }
            ${
              activePage === 'register'
                ? `<span class="btn btn-primary btn-sm">${t('nav.cta')} ${icon('chevron', 'btn-icon')}</span>`
                : `<a href="/register" class="btn btn-primary btn-sm">${t('nav.cta')} ${icon('chevron', 'btn-icon')}</a>`
            }
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

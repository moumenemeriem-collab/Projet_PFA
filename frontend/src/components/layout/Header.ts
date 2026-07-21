import { icons } from '../icons.ts'

export interface HeaderOptions {
  activePage?: 'login' | 'register' | 'home'
}

export function renderHeader(options: HeaderOptions = {}): string {
  const { activePage } = options

  return `
    <header class="site-header">
      <a href="/" class="brand">
        <span class="brand-icon">${icons.logo}</span>
        <span class="brand-name">WebSIG</span>
      </a>
      <nav class="site-nav">
        <a href="/" class="nav-link">Accueil</a>
        <a href="/" class="nav-link">Services</a>
      </nav>
      <div class="header-actions">
        ${
          activePage === 'login'
            ? '<span class="nav-link nav-link--active">Se connecter</span>'
            : '<a href="/login" class="nav-link">Se connecter</a>'
        }
        ${
          activePage === 'register'
            ? `<span class="btn btn-primary btn-sm">Commencer ${icons.chevron}</span>`
            : `<a href="/register" class="btn btn-primary btn-sm">Commencer ${icons.chevron}</a>`
        }
      </div>
    </header>
  `
}

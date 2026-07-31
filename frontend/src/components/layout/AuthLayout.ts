import { icons } from '../icons.ts'
import { renderHeader, type HeaderOptions } from './Header.ts'

export interface AuthLayoutOptions extends HeaderOptions {
  title: string
  subtitle: string
  cardContent: string
  footerContent?: string
  pageFooter?: string
  wide?: boolean
}

export function renderAuthLayout(options: AuthLayoutOptions): string {
  const {
    title,
    subtitle,
    cardContent,
    footerContent = '',
    pageFooter = '',
    wide = false,
    ...headerOptions
  } = options

  return `
    <div class="auth-page">
      ${renderHeader(headerOptions)}
      <main class="auth-main">
        <div class="auth-card${wide ? ' auth-card--wide' : ''}">
          <div class="auth-card-icon">${icons.logo}</div>
          <h1 class="auth-title">${title}</h1>
          <p class="auth-subtitle">${subtitle}</p>
          ${cardContent}
          ${footerContent ? `<div class="auth-card-footer">${footerContent}</div>` : ''}
        </div>
      </main>
      ${pageFooter ? `<footer class="auth-page-footer">${pageFooter}</footer>` : ''}
    </div>
  `
}

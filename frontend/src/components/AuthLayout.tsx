import type { ReactNode } from 'react'
import { icons } from './icons'
import { AuthHeader } from './AuthHeader'

interface AuthLayoutProps {
  activePage?: 'login' | 'register' | 'home'
  title: string
  subtitle: string
  footer?: ReactNode
  pageFooter?: ReactNode
  wide?: boolean
  children: ReactNode
}

export function AuthLayout({ activePage = 'home', title, subtitle, footer, pageFooter, wide = false, children }: AuthLayoutProps): React.JSX.Element {
  return (
    <div className="auth-page">
      <AuthHeader activePage={activePage} />
      <main className="auth-main">
        <div className={`auth-card${wide ? ' auth-card--wide' : ''}`}>
          <div className="auth-card-icon">{icons.logo}</div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          {footer ? <div className="auth-card-footer">{footer}</div> : null}
        </div>
      </main>
      {pageFooter ? <footer className="auth-page-footer">{pageFooter}</footer> : null}
    </div>
  )
}

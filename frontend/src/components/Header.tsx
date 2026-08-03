import { useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../i18n/index'
import { Icon } from './icons'
import { LangSwitcher } from './LangSwitcher'

export function Header(): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)

  const toggleMenu = (): void => {
    setMenuOpen((open) => !open)
  }

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo" aria-label="GEO INVEST">
          <Icon name="logo" className="logo-icon" />
          <span className="logo-text">GEO INVEST</span>
        </Link>

        <div className={`header-right${menuOpen ? ' header-right-open' : ''}`}>
          <nav className="nav" aria-label="Navigation principale">
            <Link to="/" className="nav-link">{t('nav.accueil')}</Link>
            <Link to="/#services" className="nav-link">{t('nav.services')}</Link>
            <Link to="/a-propos" className="nav-link">{t('nav.about')}</Link>
          </nav>
          <div className="header-actions">
            <LangSwitcher className="lang-switcher--topbar" />
            <Link to="/login" className="btn-text">{t('nav.login')}</Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              {t('nav.cta')}
              <Icon name="chevron" className="btn-icon" />
            </Link>
          </div>
        </div>

        <button
          className={`menu-toggle${menuOpen ? ' menu-open' : ''}`}
          aria-label="Ouvrir le menu"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  )
}

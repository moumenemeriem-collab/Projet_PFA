import { Link } from 'react-router-dom'
import { Icon } from './icons'

export function AboutFinalBanner(): React.JSX.Element {
  return (
    <section className="about-final-section">
      <div className="container">
        <div className="about-final-banner" data-reveal="scale">
          <div className="about-final-bg" aria-hidden="true"></div>
          <div className="about-final-content">
            <h2 data-reveal="fade-up" data-reveal-delay="80">
              Prêt à révéler le potentiel de votre terrain ?
            </h2>
            <p data-reveal="fade-up" data-reveal-delay="160">
              Rejoignez les investisseurs qui utilisent GEO INVEST pour prendre
              des décisions foncières basées sur des données géospatiales précises.
            </p>
            <Link to="/register" className="btn btn-primary btn-lg about-final-btn" data-reveal="fade-up" data-reveal-delay="240">
              Commencer gratuitement
              <Icon name="arrow" className="btn-icon" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

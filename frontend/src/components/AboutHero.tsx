import heroBg from '../assets/features/businessma.jpg'
import { Icon } from './icons'
import { ChatbotWidget } from './ChatbotWidget'
import { Link } from 'react-router-dom'

export function AboutHero(): React.JSX.Element {
  return (
    <>
      <section className="about-hero">
        <div className="about-hero-image" style={{ backgroundImage: `url('${heroBg}')` }} aria-hidden="true"></div>
        <div className="about-hero-overlay" aria-hidden="true"></div>
        <div className="about-hero-blur" aria-hidden="true"></div>

        <div className="container about-hero-content">
          <div className="about-hero-badge" data-reveal data-reveal-immediate data-reveal-delay="100">
            <Icon name="logo" className="logo-icon" />
            <span>À propos de GEO INVEST</span>
          </div>

          <h1 className="about-hero-title" data-reveal data-reveal-immediate data-reveal-delay="300">
            L'intelligence géospatiale<br />au service de l'investissement
          </h1>

          <p className="about-hero-subtitle" data-reveal data-reveal-immediate data-reveal-delay="450">
            GEO INVEST transforme les données géographiques en décisions d'investissement
            éclairées. Notre plateforme croise urbanisme, prix foncier et critères
            stratégiques pour identifier les meilleures opportunités immobilières.
          </p>

          <div className="about-hero-actions" data-reveal data-reveal-immediate data-reveal-delay="600">
            <Link to="/register" className="btn btn-primary btn-lg">
              Découvrir la plateforme
              <Icon name="arrow" className="btn-icon" />
            </Link>
            <a href="#fonctionnement" className="btn about-hero-btn-outline btn-lg">En savoir plus</a>
          </div>
        </div>

        <div className="about-hero-wave" aria-hidden="true">
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,64 C240,120 480,0 720,64 C960,128 1200,16 1440,64 L1440,120 L0,120 Z" fill="#ffffff" />
          </svg>
        </div>
      </section>

      <ChatbotWidget />
    </>
  )
}

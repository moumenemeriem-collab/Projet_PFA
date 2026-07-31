import heroBg from '../assets/features/businessma.jpg'
import { icon, logoIcon } from './icons'
import { ChatbotWidget } from './ChatbotWidget'

export function AboutHero(): string {
  return `
    <section class="about-hero">
      <div class="about-hero-image" style="background-image: url('${heroBg}');" aria-hidden="true"></div>
      <div class="about-hero-overlay" aria-hidden="true"></div>
      <div class="about-hero-blur" aria-hidden="true"></div>

      <div class="container about-hero-content">
        <div class="about-hero-badge" data-reveal data-reveal-immediate data-reveal-delay="100">
          ${logoIcon()}
          <span>À propos de GEO INVEST</span>
        </div>

        <h1 class="about-hero-title" data-reveal data-reveal-immediate data-reveal-delay="300">
          L'intelligence géospatiale<br>au service de l'investissement
        </h1>

        <p class="about-hero-subtitle" data-reveal data-reveal-immediate data-reveal-delay="450">
          GEO INVEST transforme les données géographiques en décisions d'investissement
          éclairées. Notre plateforme croise urbanisme, prix foncier et critères
          stratégiques pour identifier les meilleures opportunités immobilières.
        </p>

        <div class="about-hero-actions" data-reveal data-reveal-immediate data-reveal-delay="600">
          <a href="/register" class="btn btn-primary btn-lg">
            Découvrir la plateforme
            ${icon('arrow', 'btn-icon')}
          </a>
          <a href="#fonctionnement" class="btn about-hero-btn-outline btn-lg">En savoir plus</a>
        </div>
      </div>

      <div class="about-hero-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0,64 C240,120 480,0 720,64 C960,128 1200,16 1440,64 L1440,120 L0,120 Z" fill="#ffffff"/>
        </svg>
      </div>
    </section>

    ${ChatbotWidget()}
  `
}

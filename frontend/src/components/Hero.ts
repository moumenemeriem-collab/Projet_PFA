import heroBg from '../assets/hero.png'
import { icon } from './icons'

export function Hero(): string {
  return `
    <section id="accueil" class="hero">
      <div class="hero-bg" style="--hero-bg: url('${heroBg}')" aria-hidden="true">
        <div class="hero-map-overlay"></div>
      </div>
      <div class="container hero-content">
        <div class="hero-brand" data-reveal data-reveal-immediate data-reveal-delay="100">          <svg class="hero-brand-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" fill="rgba(37,99,235,0.3)"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span> GEO INVEST</span>
        </div>
       
        <h1 class="hero-title" data-reveal data-reveal-immediate data-reveal-delay="320">          WebSIG — Identifiez et classez vos opportunités foncières
        </h1>
        <p class="hero-description" data-reveal data-reveal-immediate data-reveal-delay="440">          Analysez le potentiel des parcelles dans la région de ... grâce à des
          outils géospatiaux avancés. Prenez des décisions d'investissement éclairées
          et sécurisées.
        </p>
        <div class="hero-actions" data-reveal data-reveal-immediate data-reveal-delay="560">          <a href="#inscription" class="btn btn-primary btn-lg">
            S'inscrire gratuitement
            ${icon('arrow', 'btn-icon')}
          </a>
          <a href="#connexion" class="btn btn-outline btn-lg">Se connecter</a>
        </div>
      </div>
    </section>
  `
}

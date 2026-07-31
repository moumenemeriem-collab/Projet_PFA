import { icon } from './icons'

export function AboutFinalBanner(): string {
  return `
    <section class="about-final-section">
      <div class="container">
        <div class="about-final-banner" data-reveal="scale">
          <div class="about-final-bg" aria-hidden="true"></div>
          <div class="about-final-content">
            <h2 data-reveal="fade-up" data-reveal-delay="80">
              Prêt à révéler le potentiel de votre terrain ?
            </h2>
            <p data-reveal="fade-up" data-reveal-delay="160">
              Rejoignez les investisseurs qui utilisent GEO INVEST pour prendre
              des décisions foncières basées sur des données géospatiales précises.
            </p>
            <a href="/register" class="btn btn-primary btn-lg about-final-btn" data-reveal="fade-up" data-reveal-delay="240">
              Commencer gratuitement
              ${icon('arrow', 'btn-icon')}
            </a>
          </div>
        </div>
      </div>
    </section>
  `
}

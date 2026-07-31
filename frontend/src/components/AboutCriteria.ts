import { criteria } from '../data/about'

export function AboutCriteria(): string {
  const items = criteria
    .map(
      (criterion, index) => `
      <div class="criteria-item" data-reveal="fade-up-sm" data-reveal-delay="${index * 80}">
        <div class="criteria-item-circle">
          <svg class="criteria-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <span class="criteria-item-text">${criterion.title}</span>
      </div>
    `,
    )
    .join('')

  return `
    <section class="about-criteria-section">
      <div class="container">
        <div class="criteria-header" data-reveal="fade-up">
          <span class="criteria-ghost" aria-hidden="true">CRITÈRES</span>
          <div class="criteria-title-row">
            <span class="criteria-line" aria-hidden="true"></span>
            <h2 class="criteria-title">Nos critères d'<span class="criteria-accent">analyse</span></h2>
          </div>
          <p class="criteria-subtitle">Une évaluation multicritère basée sur la méthode AHP</p>
        </div>

        <p class="criteria-desc" data-reveal="fade-up" data-reveal-delay="100">
          Chaque parcelle est évaluée selon 9 critères complémentaires croisant
          données cadastrales, urbanisme et marché foncier. L'objectif : produire
          un score de potentiel objectif et reproductible pour guider vos décisions
          d'investissement.
        </p>

        <div class="criteria-grid" data-reveal="fade-up" data-reveal-delay="200">
          ${items}
        </div>
      </div>
    </section>
  `
}

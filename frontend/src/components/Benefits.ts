import { benefits } from '../data/landing'

const circleCheck = `<svg class="mission-check-icon" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`

export function Benefits(): string {
  const items = benefits
    .map(
      (benefit, index) => `
      <div class="mission-item" data-reveal="fade-right" data-reveal-delay="${200 + index * 150}">
        <div class="mission-item-check">${circleCheck}</div>
        <div class="mission-item-content">
          <h3 class="mission-item-title">${benefit.title}</h3>
          <p class="mission-item-desc">${benefit.description}</p>
        </div>
      </div>
    `,
    )
    .join('')

  return `
    <section class="mission-section">
      <div class="container">
        <div class="mission-layout">
          <div class="mission-heading" data-reveal="fade-up">
            <span class="mission-ghost" aria-hidden="true">MISSION</span>
            <div class="mission-title-row">
              <span class="mission-accent-line" aria-hidden="true"></span>
              <h2 class="mission-title">Notre <span class="mission-accent">mission</span></h2>
            </div>
            <p class="mission-intro">
              Transformer la donnée géospatiale en décisions d'investissement fiables pour la région de Khemisset.
            </p>
          </div>
          <div class="mission-content">
            ${items}
          </div>
        </div>
      </div>
    </section>
  `
}

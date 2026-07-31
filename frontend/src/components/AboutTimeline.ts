import { timelineSteps } from '../data/about'
import { icon } from './icons'

export function AboutTimeline(): string {
  const steps = timelineSteps
    .map(
      (step, index) => `
      <div class="timeline-step" data-reveal="fade-up-sm" data-reveal-delay="${index * 150}">
        <div class="timeline-step-marker">
          <div class="timeline-step-number">${index + 1}</div>
        </div>
        <div class="timeline-step-card">
          <div class="timeline-step-icon">
            ${icon(step.icon, 'timeline-icon')}
          </div>
          <h3 class="timeline-step-title">${step.title}</h3>
          <p class="timeline-step-desc">${step.description}</p>
        </div>
      </div>
    `,
    )
    .join('')

  return `
    <section id="fonctionnement" class="about-timeline-section">
      <div class="container">
        <div class="section-header" data-reveal="fade-up">
          <h2>Comment fonctionne GEO INVEST ?</h2>
          <p>
            Un processus simple et rigoureux en cinq étapes pour transformer
            vos données géospatiales en décisions d'investissement.
          </p>
        </div>
        <div class="about-timeline">
          <div class="about-timeline-line" aria-hidden="true"></div>
          ${steps}
        </div>
      </div>
    </section>
  `
}

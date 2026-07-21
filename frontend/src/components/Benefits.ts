import { benefits } from '../data/landing'
import { icon } from './icons'

export function Benefits(): string {
  const items = benefits
    .map(
      (benefit, index) => `
      <div class="benefit-item" data-reveal="fade-up" data-reveal-delay="${index * 120}">        <div class="benefit-icon-wrap">
          ${icon(benefit.icon, 'benefit-icon')}
        </div>
        <h3>${benefit.title}</h3>
        <p>${benefit.description}</p>
      </div>
    `,
    )
    .join('')

  return `
    <section class="benefits">
      <div class="container">
        <div class="benefits-grid">
          ${items}
        </div>
      </div>
    </section>
  `
}

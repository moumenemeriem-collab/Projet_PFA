import carteImg from '../assets/features/carte-interactive.jpg'
import { dataSources } from '../data/about'
import { icon } from './icons'

export function AboutDataSources(): string {
  const items = dataSources
    .map(
      (source, index) => `
      <div class="source-item" data-reveal="fade-up-sm" data-reveal-delay="${index * 80}">
        <div class="source-item-circle">
          ${icon(source.icon, 'source-item-icon')}
        </div>
        <span class="source-item-label">${source.label}</span>
      </div>
    `,
    )
    .join('')

  return `
    <section class="about-sources-section">
      <div class="sources-hero" aria-hidden="true">
        <img class="sources-hero-img" src="${carteImg}" alt="">
        <div class="sources-hero-overlay"></div>
      </div>
      <div class="sources-hero-content">
        <span class="sources-label" data-reveal data-reveal-immediate data-reveal-delay="100">NOS SOURCES</span>
        <h2 class="sources-title" data-reveal data-reveal-immediate data-reveal-delay="250">Des données fiables<br>à chaque étape</h2>
      </div>

      <div class="container">
        <div class="sources-bar" data-reveal="scale" data-reveal-delay="100">
          <div class="sources-grid">
            ${items}
          </div>
        </div>
      </div>
    </section>
  `
}

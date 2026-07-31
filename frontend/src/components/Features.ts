import { features } from '../data/landing'
import { icon } from './icons'
import { t } from '../i18n/index'

export function Features(): string {
  const cards = features
    .map(
      (feature, index) => `
      <article class="feature-card" data-reveal data-reveal-delay="${index * 100}">
        <div class="feature-image" style="background-image: url('${feature.image}');">
          <div class="feature-image-pattern" style="background: ${feature.imageGradient}"></div>
        </div>
        <div class="feature-body">
          <div class="feature-title-row">
            ${icon(feature.icon, 'feature-icon')}
            <h3>${feature.title}</h3>
          </div>
          <p>${feature.description}</p>
        </div>
      </article>
    `,
    )
    .join('')

  return `
    <section id="services" class="features">
      <div class="container">
        <div class="section-header" data-reveal="fade-up">
          <h2>${t('features.title')}</h2>
          <p>${t('features.subtitle')}</p>
        </div>
        <div class="features-grid">
          ${cards}
        </div>
      </div>
    </section>
  `
}

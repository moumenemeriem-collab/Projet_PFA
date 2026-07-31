import { t } from '../i18n/index'

export function CtaBanner(): string {
  return `
    <section class="cta-section">
      <div class="container">
        <div class="cta-banner" data-reveal="scale">
          <h2 data-reveal="fade-up" data-reveal-delay="80">${t('cta.title')}</h2>
          <p data-reveal="fade-up" data-reveal-delay="160">${t('cta.description')}</p>
          <a href="/register" class="btn btn-primary btn-lg" data-reveal="fade-up" data-reveal-delay="240">${t('cta.button')}</a>
        </div>
      </div>
    </section>
  `
}

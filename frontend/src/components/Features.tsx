import { features } from '../data/landing'
import { Icon } from './icons'
import { t } from '../i18n/index'

export function Features(): React.JSX.Element {
  return (
    <section id="services" className="features">
      <div className="container">
        <div className="section-header" data-reveal="fade-up">
          <h2>{t('features.title')}</h2>
          <p>{t('features.subtitle')}</p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <article className="feature-card" data-reveal data-reveal-delay={String(index * 100)} key={index}>
              <div className="feature-image" style={{ backgroundImage: `url('${feature.image}')` }}>
                <div className="feature-image-pattern" style={{ background: feature.imageGradient }}></div>
              </div>
              <div className="feature-body">
                <div className="feature-title-row">
                  <Icon name={feature.icon} className="feature-icon" />
                  <h3>{feature.title}</h3>
                </div>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

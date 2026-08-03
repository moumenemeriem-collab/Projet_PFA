import { Link } from 'react-router-dom'
import { t } from '../i18n/index'

export function CtaBanner(): React.JSX.Element {
  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-banner" data-reveal="scale">
          <h2 data-reveal="fade-up" data-reveal-delay="80">{t('cta.title')}</h2>
          <p data-reveal="fade-up" data-reveal-delay="160">{t('cta.description')}</p>
          <Link to="/register" className="btn btn-primary btn-lg" data-reveal="fade-up" data-reveal-delay="240">
            {t('cta.button')}
          </Link>
        </div>
      </div>
    </section>
  )
}

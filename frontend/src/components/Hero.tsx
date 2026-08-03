import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import heroBg1 from '../assets/hero.png'
import heroBg2 from '../assets/hero-2.png'
import heroBg3 from '../assets/hero-3.jpg'
import { Icon } from './icons'
import { t } from '../i18n/index'

const slides = [
  { src: heroBg1, alt: 'hero.slide1_alt' },
  { src: heroBg2, alt: 'hero.slide2_alt' },
  { src: heroBg3, alt: 'hero.slide3_alt' },
]

const SLIDESHOW_INTERVAL = 5000

export function Hero(): React.JSX.Element {
  const [active, setActive] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startAutoplay = (): void => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setActive((current) => (current + 1) % slides.length)
    }, SLIDESHOW_INTERVAL)
  }

  useEffect(() => {
    startAutoplay()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const goTo = (index: number): void => {
    setActive(index)
    startAutoplay()
  }

  return (
    <section id="accueil" className="hero">
      <div className="hero-slides" aria-hidden="true">
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className={`hero-slide${i === active ? ' is-active' : ''}${active === i ? '' : ' was-active'}`}
            style={{ ['--hero-bg' as string]: `url('${slide.src}')` }}
            data-slide-index={i}
            aria-hidden="true"
          />
        ))}
        <div className="hero-map-overlay"></div>
      </div>
      <div className="hero-dots" role="group" aria-label={t('hero.slide_nav_label')}>
        {slides.map((_, i) => (
          <button
            key={i}
            className={`hero-dot${i === active ? ' is-active' : ''}`}
            aria-label={`${t('hero.slide_alt')} ${i + 1}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
      <div className="container hero-content">
        <div className="hero-brand" data-reveal data-reveal-immediate data-reveal-delay="100">
          <Icon name="logo" className="logo-icon" />
          <span> GEO INVEST</span>
        </div>

        <h1 className="hero-title" data-reveal data-reveal-immediate data-reveal-delay="320">
          {t('hero.title')}
        </h1>
        <p className="hero-description" data-reveal data-reveal-immediate data-reveal-delay="440">
          {t('hero.description')}
        </p>
        <div className="hero-actions" data-reveal data-reveal-immediate data-reveal-delay="560">
          <Link to="/register" className="btn btn-primary btn-lg">
            {t('hero.cta_signup')}
            <Icon name="arrow" className="btn-icon" />
          </Link>
          <Link to="/login" className="btn btn-outline btn-lg">{t('hero.cta_login')}</Link>
        </div>
      </div>
    </section>
  )
}

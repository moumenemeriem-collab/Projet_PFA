import heroBg1 from '../assets/hero.png'
import heroBg2 from '../assets/hero-2.png'
import heroBg3 from '../assets/hero-3.jpg'
import { icon, logoIcon } from './icons'
import { t } from '../i18n/index'

const slides = [
  { src: heroBg1, alt: 'hero.slide1_alt' },
  { src: heroBg2, alt: 'hero.slide2_alt' },
  { src: heroBg3, alt: 'hero.slide3_alt' },
]

export function Hero(): string {
  const slideElements = slides
    .map(
      (slide, i) =>
        `<div class="hero-slide${i === 0 ? ' is-active' : ''}" style="--hero-bg: url('${slide.src}')" data-slide-index="${i}" aria-hidden="true"></div>`,
    )
    .join('')

  const dots = slides
    .map(
      (_, i) =>
        `<button class="hero-dot${i === 0 ? ' is-active' : ''}" data-slide="${i}" aria-label="${t('hero.slide_alt')} ${i + 1}"></button>`,
    )
    .join('')

  return `
    <section id="accueil" class="hero">
      <div class="hero-slides" aria-hidden="true">
        ${slideElements}
        <div class="hero-map-overlay"></div>
      </div>
      <div class="hero-dots" role="group" aria-label="${t('hero.slide_nav_label')}">
        ${dots}
      </div>
      <div class="container hero-content">
        <div class="hero-brand" data-reveal data-reveal-immediate data-reveal-delay="100">
          ${logoIcon()}
          <span> GEO INVEST</span>
        </div>

        <h1 class="hero-title" data-reveal data-reveal-immediate data-reveal-delay="320">
          ${t('hero.title')}
        </h1>
        <p class="hero-description" data-reveal data-reveal-immediate data-reveal-delay="440">
          ${t('hero.description')}
        </p>
        <div class="hero-actions" data-reveal data-reveal-immediate data-reveal-delay="560">
          <a href="/register" class="btn btn-primary btn-lg">
            ${t('hero.cta_signup')}
            ${icon('arrow', 'btn-icon')}
          </a>
          <a href="/login" class="btn btn-outline btn-lg">${t('hero.cta_login')}</a>
        </div>
      </div>
    </section>
  `
}

export function setupHeroSlideshow(): void {
  const slidesEls = document.querySelectorAll<HTMLElement>('.hero-slide')
  const dots = document.querySelectorAll<HTMLButtonElement>('.hero-dot')
  if (slidesEls.length === 0 || dots.length === 0) return

  let current = 0
  let interval: ReturnType<typeof setInterval>

  function goTo(index: number) {
    if (index === current) return

    const prev = slidesEls[current]
    const next = slidesEls[index]

    prev.classList.remove('is-active')
    prev.classList.add('was-active')

    next.classList.remove('was-active')
    next.classList.add('is-active')

    dots[current]?.classList.remove('is-active')
    dots[index]?.classList.add('is-active')

    setTimeout(() => {
      prev.classList.remove('was-active')
    }, 1800)

    current = index
  }

  function nextSlide() {
    goTo((current + 1) % slidesEls.length)
  }

  function startAutoplay() {
    interval = setInterval(nextSlide, 5000)
  }

  function stopAutoplay() {
    clearInterval(interval)
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = Number(dot.dataset.slide)
      stopAutoplay()
      goTo(index)
      startAutoplay()
    })
  })

  startAutoplay()
}

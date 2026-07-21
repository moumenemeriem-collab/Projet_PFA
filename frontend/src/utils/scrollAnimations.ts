const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function revealElement(element: Element): void {
  const el = element as HTMLElement
  const delay = el.dataset.revealDelay

  if (delay) {
    el.style.transitionDelay = `${delay}ms`
  }

  el.classList.add('is-visible')
}

function setupScrollReveal(): void {
  const elements = document.querySelectorAll<HTMLElement>('[data-reveal]')

  if (REDUCED_MOTION) {
    elements.forEach(revealElement)
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealElement(entry.target)
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
  )

  elements.forEach((element) => {
    if (element.dataset.revealImmediate !== undefined) {
      const delay = Number(element.dataset.revealDelay ?? 0)
      window.setTimeout(() => revealElement(element), delay)
      return
    }

    observer.observe(element)
  })
}

function setupHeaderScroll(): void {
  const header = document.querySelector<HTMLElement>('.header')
  if (!header) return

  const onScroll = (): void => {
    header.classList.toggle('header-scrolled', window.scrollY > 24)
  }

  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
}

function setupActiveNav(): void {
  const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-link')
  const sections = document.querySelectorAll<HTMLElement>('main section[id]')

  if (!navLinks.length || !sections.length) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        const id = entry.target.id
        navLinks.forEach((link) => {
          link.classList.toggle('nav-link-active', link.getAttribute('href') === `#${id}`)
        })
      })
    },
    { rootMargin: '-40% 0px -45% 0px', threshold: 0 },
  )

  sections.forEach((section) => observer.observe(section))
}

function setupHeroParallax(): void {
  const hero = document.querySelector<HTMLElement>('.hero')
  const heroBg = document.querySelector<HTMLElement>('.hero-bg')

  if (!hero || !heroBg || REDUCED_MOTION) return

  let ticking = false

  const updateParallax = (): void => {
    const scrollY = window.scrollY
    const heroHeight = hero.offsetHeight

    if (scrollY <= heroHeight) {
      heroBg.style.transform = `translate3d(0, ${scrollY * 0.28}px, 0) scale(1.05)`
    }

    ticking = false
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax)
        ticking = true
      }
    },
    { passive: true },
  )
}

export function setupScrollAnimations(): void {
  setupScrollReveal()
  setupHeaderScroll()
  setupActiveNav()
  setupHeroParallax()
}

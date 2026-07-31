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
          const target = link.getAttribute('href')?.split('#')[1]
          link.classList.toggle('nav-link-active', target === id)
        })
      })
    },
    { rootMargin: '-40% 0px -45% 0px', threshold: 0 },
  )

  sections.forEach((section) => observer.observe(section))
}

function setupHeroParallax(): void {
  const hero = document.querySelector<HTMLElement>('.hero')
  const heroSlides = document.querySelector<HTMLElement>('.hero-slides')

  if (!hero || !heroSlides || REDUCED_MOTION) return

  let ticking = false

  const updateParallax = (): void => {
    const scrollY = window.scrollY
    const heroHeight = hero.offsetHeight

    if (scrollY <= heroHeight) {
      heroSlides.style.transform = `translate3d(0, ${scrollY * 0.28}px, 0)`
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

const SLIDESHOW_INTERVAL = 3_000

function setupHeroSlideshow(): void {
  const slides = document.querySelectorAll<HTMLElement>('.hero-slide')
  const dots = document.querySelectorAll<HTMLElement>('.hero-dot')

  if (slides.length <= 1) return

  let currentIndex = 0
  let timer: ReturnType<typeof setInterval>

  function goToSlide(index: number): void {
    if (index === currentIndex) return

    const prev = slides[currentIndex]
    const next = slides[index]

    prev.classList.add('was-active')
    prev.classList.remove('is-active')

    next.classList.add('is-active')

    setTimeout(() => {
      prev.classList.remove('was-active')
    }, 1800)

    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index)
    })

    currentIndex = index
  }

  function nextSlide(): void {
    goToSlide((currentIndex + 1) % slides.length)
  }

  function startTimer(): void {
    clearInterval(timer)
    timer = setInterval(nextSlide, SLIDESHOW_INTERVAL)
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = Number(dot.dataset.slide)
      goToSlide(index)
      startTimer()
    })
  })

  startTimer()
}

export function setupScrollAnimations(): void {
  setupScrollReveal()
  setupHeaderScroll()
  setupActiveNav()
  setupHeroParallax()
  setupHeroSlideshow()
}

import { useEffect } from 'react'

const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function revealElement(el: HTMLElement): void {
  const delay = el.dataset.revealDelay
  if (delay) el.style.transitionDelay = `${delay}ms`
  el.classList.add('is-visible')
}

export function PageEffects(): null {
  useEffect(() => {
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    let revealObserver: IntersectionObserver | null = null

    if (REDUCED_MOTION) {
      revealEls.forEach(revealElement)
    } else {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              revealElement(entry.target as HTMLElement)
              revealObserver?.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
      )
      revealEls.forEach((el) => {
        if (el.dataset.revealImmediate !== undefined) {
          const delay = Number(el.dataset.revealDelay ?? 0)
          window.setTimeout(() => revealElement(el), delay)
          return
        }
        revealObserver?.observe(el)
      })
    }

    const header = document.querySelector<HTMLElement>('.header')
    const onScroll = (): void => {
      header?.classList.toggle('header-scrolled', window.scrollY > 24)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    let parallaxTicking = false
    const hero = document.querySelector<HTMLElement>('.hero')
    const heroSlides = document.querySelector<HTMLElement>('.hero-slides')
    const updateParallax = (): void => {
      if (hero && heroSlides && !REDUCED_MOTION) {
        const scrollY = window.scrollY
        const heroHeight = hero.offsetHeight
        if (scrollY <= heroHeight) {
          heroSlides.style.transform = `translate3d(0, ${scrollY * 0.28}px, 0)`
        }
      }
      parallaxTicking = false
    }
    if (hero && heroSlides && !REDUCED_MOTION) {
      window.addEventListener('scroll', () => {
        if (!parallaxTicking) {
          requestAnimationFrame(updateParallax)
          parallaxTicking = true
        }
      }, { passive: true })
    }

    const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav-link'))
    const sections = Array.from(document.querySelectorAll<HTMLElement>('main section[id]'))
    const navObserver = new IntersectionObserver(
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
    sections.forEach((section) => navObserver.observe(section))

    return () => {
      revealObserver?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', updateParallax)
      navObserver.disconnect()
    }
  }, [])

  return null
}

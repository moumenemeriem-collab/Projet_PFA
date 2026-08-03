import { useEffect } from 'react'
import { PageEffects } from '../utils/PageEffects'
import { Header } from '../components/Header'
import { AboutHero } from '../components/AboutHero'
import { AboutTimeline } from '../components/AboutTimeline'
import { AboutCriteria } from '../components/AboutCriteria'
import { AboutProjectTypes } from '../components/AboutProjectTypes'
import { AboutDataSources } from '../components/AboutDataSources'
import { AboutFinalBanner } from '../components/AboutFinalBanner'

export function AboutPage(): React.JSX.Element {
  useEffect(() => {
    const timeline = document.querySelector<HTMLElement>('.about-timeline')
    if (!timeline) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            timeline.classList.add('is-animated')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.2 },
    )

    observer.observe(timeline)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Header />
      <main>
        <AboutHero />
        <AboutTimeline />
        <AboutCriteria />
        <AboutProjectTypes />
        <AboutDataSources />
        <AboutFinalBanner />
      </main>
      <footer className="footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} GEO INVEST.</p>
        </div>
      </footer>
      <PageEffects />
    </>
  )
}

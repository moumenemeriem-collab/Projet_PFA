import { Header, setupHeader } from '../components/Header'
import { AboutHero } from '../components/AboutHero'
import { AboutTimeline } from '../components/AboutTimeline'
import { AboutCriteria } from '../components/AboutCriteria'
import { AboutProjectTypes } from '../components/AboutProjectTypes'
import { AboutDataSources } from '../components/AboutDataSources'
import { AboutFinalBanner } from '../components/AboutFinalBanner'
import { setupScrollAnimations } from '../utils/scrollAnimations'
import { setupChatbot } from '../components/ChatbotWidget'

function setupAboutAnimations(): void {
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
}

function renderAboutPage(): string {
  return `
    ${Header()}
    <main>
      ${AboutHero()}
      ${AboutTimeline()}
      ${AboutCriteria()}
      ${AboutProjectTypes()}
      ${AboutDataSources()}
      ${AboutFinalBanner()}
    </main>
    <footer class="footer">
      <div class="container">
        <p>&copy; ${new Date().getFullYear()} GEO INVEST.</p>
      </div>
    </footer>
  `
}

export function mountAboutPage(root: HTMLElement): void {
  root.innerHTML = renderAboutPage()
  setupHeader()
  setupScrollAnimations()
  setupAboutAnimations()
  setupChatbot()
}

import carteImg from '../assets/features/carte-interactive.jpg'
import { dataSources } from '../data/about'
import { Icon } from './icons'

export function AboutDataSources(): React.JSX.Element {
  return (
    <section className="about-sources-section">
      <div className="sources-hero" aria-hidden="true">
        <img className="sources-hero-img" src={carteImg} alt="" />
        <div className="sources-hero-overlay"></div>
      </div>
      <div className="sources-hero-content">
        <span className="sources-label" data-reveal data-reveal-immediate data-reveal-delay="100">NOS SOURCES</span>
        <h2 className="sources-title" data-reveal data-reveal-immediate data-reveal-delay="250">Des données fiables<br />à chaque étape</h2>
      </div>

      <div className="container">
        <div className="sources-bar" data-reveal="scale" data-reveal-delay="100">
          <div className="sources-grid">
            {dataSources.map((source, index) => (
              <div className="source-item" data-reveal="fade-up-sm" data-reveal-delay={String(index * 80)} key={index}>
                <div className="source-item-circle">
                  <Icon name={source.icon} className="source-item-icon" />
                </div>
                <span className="source-item-label">{source.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

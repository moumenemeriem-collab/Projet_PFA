import { timelineSteps } from '../data/about'
import { Icon } from './icons'

export function AboutTimeline(): React.JSX.Element {
  return (
    <section id="fonctionnement" className="about-timeline-section">
      <div className="container">
        <div className="section-header" data-reveal="fade-up">
          <h2>Comment fonctionne GEO INVEST ?</h2>
          <p>
            Un processus simple et rigoureux en cinq étapes pour transformer
            vos données géospatiales en décisions d'investissement.
          </p>
        </div>
        <div className="about-timeline">
          <div className="about-timeline-line" aria-hidden="true"></div>
          {timelineSteps.map((step, index) => (
            <div className="timeline-step" data-reveal="fade-up-sm" data-reveal-delay={String(index * 150)} key={index}>
              <div className="timeline-step-marker">
                <div className="timeline-step-number">{index + 1}</div>
              </div>
              <div className="timeline-step-card">
                <div className="timeline-step-icon">
                  <Icon name={step.icon} className="timeline-icon" />
                </div>
                <h3 className="timeline-step-title">{step.title}</h3>
                <p className="timeline-step-desc">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

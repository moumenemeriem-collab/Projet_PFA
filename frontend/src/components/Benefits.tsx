import { benefits } from '../data/landing'

const circleCheck = (
  <svg className="mission-check-icon" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

export function Benefits(): React.JSX.Element {
  return (
    <section className="mission-section">
      <div className="container">
        <div className="mission-layout">
          <div className="mission-heading" data-reveal="fade-up">
            <span className="mission-ghost" aria-hidden="true">MISSION</span>
            <div className="mission-title-row">
              <span className="mission-accent-line" aria-hidden="true"></span>
              <h2 className="mission-title">Notre <span className="mission-accent">mission</span></h2>
            </div>
            <p className="mission-intro">
              Transformer la donnée géospatiale en décisions d'investissement fiables et performantes.
            </p>
          </div>
          <div className="mission-content">
            {benefits.map((benefit, index) => (
              <div className="mission-item" data-reveal="fade-right" data-reveal-delay={String(200 + index * 150)} key={index}>
                <div className="mission-item-check">{circleCheck}</div>
                <div className="mission-item-content">
                  <h3 className="mission-item-title">{benefit.title}</h3>
                  <p className="mission-item-desc">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

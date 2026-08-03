import { criteria } from '../data/about'

export function AboutCriteria(): React.JSX.Element {
  return (
    <section className="about-criteria-section">
      <div className="container">
        <div className="criteria-header" data-reveal="fade-up">
          <span className="criteria-ghost" aria-hidden="true">CRITÈRES</span>
          <div className="criteria-title-row">
            <span className="criteria-line" aria-hidden="true"></span>
            <h2 className="criteria-title">Nos critères d'<span className="criteria-accent">analyse</span></h2>
          </div>
          <p className="criteria-subtitle">Une évaluation multicritère basée sur la méthode AHP</p>
        </div>

        <p className="criteria-desc" data-reveal="fade-up" data-reveal-delay="100">
          Chaque parcelle est évaluée selon 9 critères complémentaires croisant
          données cadastrales, urbanisme et marché foncier. L'objectif : produire
          un score de potentiel objectif et reproductible pour guider vos décisions
          d'investissement.
        </p>

        <div className="criteria-grid" data-reveal="fade-up" data-reveal-delay="200">
          {criteria.map((criterion, index) => (
            <div className="criteria-item" data-reveal="fade-up-sm" data-reveal-delay={String(index * 80)} key={index}>
              <div className="criteria-item-circle">
                <svg className="criteria-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
              <span className="criteria-item-text">{criterion.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

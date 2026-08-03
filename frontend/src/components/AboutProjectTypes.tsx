import { projectTypes } from '../data/about'

export function AboutProjectTypes(): React.JSX.Element {
  return (
    <section className="about-projects-section">
      <div className="container">
        <div className="section-header" data-reveal="fade-up">
          <h2>Types de projets analysés</h2>
          <p>
            Quel que soit votre projet d'investissement, GEO INVEST adapte
            son analyse pour chaque type de développement immobilier.
          </p>
        </div>
        <div className="projects-grid">
          {projectTypes.map((project, index) => (
            <div className="project-card" data-reveal="fade-up-sm" data-reveal-delay={String(index * 120)} key={index}>
              <img className="project-card-image" src={project.image} alt={project.title} loading="lazy" />
              <div className="project-card-overlay" style={{ background: project.gradient }} aria-hidden="true"></div>
              <div className="project-card-content">
                <h3 className="project-card-title">{project.title}</h3>
                <p className="project-card-desc">{project.description}</p>
                <p className="project-card-details">{project.details}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

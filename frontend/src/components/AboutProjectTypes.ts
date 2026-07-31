import { projectTypes } from '../data/about'

export function AboutProjectTypes(): string {
  const cards = projectTypes
    .map(
      (project, index) => `
      <div class="project-card" data-reveal="fade-up-sm" data-reveal-delay="${index * 120}">
        <img class="project-card-image" src="${project.image}" alt="${project.title}" loading="lazy">
        <div class="project-card-overlay" style="background: ${project.gradient};" aria-hidden="true"></div>
        <div class="project-card-content">
          <h3 class="project-card-title">${project.title}</h3>
          <p class="project-card-desc">${project.description}</p>
          <p class="project-card-details">${project.details}</p>
        </div>
      </div>
    `,
    )
    .join('')

  return `
    <section class="about-projects-section">
      <div class="container">
        <div class="section-header" data-reveal="fade-up">
          <h2>Types de projets analysés</h2>
          <p>
            Quel que soit votre projet d'investissement, GEO INVEST adapte
            son analyse pour chaque type de développement immobilier.
          </p>
        </div>
        <div class="projects-grid">
          ${cards}
        </div>
      </div>
    </section>
  `
}

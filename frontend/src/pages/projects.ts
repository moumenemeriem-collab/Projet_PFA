import { icons } from '../components/icons.ts'
import { renderDashboardLayout, setupDashboardLayout } from '../components/layout/DashboardLayout.ts'
import { getStoredUser } from '../api/auth.ts'
import { projectStats, staticProjects, type ProjectType } from '../data/projects.ts'

const typeIcons: Record<ProjectType, string> = {
  Résidentiel: icons.building,
  Commercial: icons.store,
  Mixte: icons.layers,
}

function renderProjectCard(project: (typeof staticProjects)[0]): string {
  return `
    <article class="project-card">
      <div class="project-card-image">
        <img src="${project.image}" alt="${project.title}" loading="lazy" />
      </div>
      <div class="project-card-body">
        <div class="project-card-header">
          <h3 class="project-card-title">${project.title}</h3>
          <button type="button" class="project-card-menu" aria-label="Options">${icons.more}</button>
        </div>
        <span class="project-type-tag">
          ${typeIcons[project.type]}
          ${project.type}
        </span>
        <div class="project-metrics">
          <div class="project-metric">
            <span class="project-metric-label">Budget</span>
            <span class="project-metric-value">${icons.euro} ${project.budget}</span>
          </div>
          <div class="project-metric">
            <span class="project-metric-label">Parcelles</span>
            <span class="project-metric-value">${project.parcels} classées</span>
          </div>
        </div>
        <a href="#" class="project-details-link">
          Détails du projet ${icons.chevron}
        </a>
      </div>
    </article>
  `
}

export function renderProjectsPage(): string {
  const user = getStoredUser()
  if (!user) return ''

  const content = `
    <div class="projects-page">
      <div class="projects-page-header">
        <div>
          <h1 class="projects-title">Gestion des Projets</h1>
          <p class="projects-subtitle">
            <span class="status-dot status-dot--inline"><span></span></span>
            Accès direct aux couches SIG
          </p>
        </div>
        <button type="button" class="btn btn-primary btn-action btn-action--create" id="create-project-btn">
          ${icons.plus} Créer un projet
        </button>
      </div>

      <div class="projects-toolbar">
        <div class="search-field">
          ${icons.search}
          <input
            type="search"
            class="search-input"
            placeholder="Rechercher un projet, une zone, ou un budget..."
            disabled
          />
        </div>
        <div class="toolbar-filters">
          <span class="toolbar-label">Filtrer par :</span>
          <select class="toolbar-select" disabled>
            <option>Tous les statuts</option>
          </select>
          <select class="toolbar-select" disabled>
            <option>Tous les types</option>
          </select>
          <button type="button" class="btn btn-outline btn-sm toolbar-sort" disabled>
            ${icons.sort} Trier
          </button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-icon stat-icon--blue">${icons.folder}</span>
            <span class="stat-label">Total projets</span>
          </div>
          <p class="stat-value">${projectStats.total.value}</p>
          <p class="stat-subtext">${projectStats.total.subtext}</p>
        </div>
        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-icon stat-icon--green">${icons.euro}</span>
            <span class="stat-label">Investissement total</span>
          </div>
          <p class="stat-value">${projectStats.investment.value}</p>
        </div>
        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-icon stat-icon--purple">${icons.layers}</span>
            <span class="stat-label">Parcelles classées</span>
          </div>
          <p class="stat-value">${projectStats.classifiedParcels.value}</p>
          <p class="stat-subtext">${projectStats.classifiedParcels.subtext}</p>
        </div>
        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-icon stat-icon--orange">${icons.mapPin}</span>
            <span class="stat-label">Zones à potentiel</span>
          </div>
          <p class="stat-value">${projectStats.potentialZones.value}</p>
          <p class="stat-subtext">${projectStats.potentialZones.subtext}</p>
        </div>
      </div>

      <div class="projects-list-header">
        <h2 class="projects-list-title">Liste des Projets Actifs</h2>
        <div class="projects-list-meta">
          <span>Affichage de ${staticProjects.length} projets sur ${projectStats.total.value}</span>
          <div class="projects-progress">
            <div class="projects-progress-bar" style="width: ${(staticProjects.length / projectStats.total.value) * 100}%"></div>
          </div>
        </div>
      </div>

      <div class="projects-grid">
        ${staticProjects.map(renderProjectCard).join('')}
      </div>

      <div class="projects-load-more">
        <button type="button" class="btn btn-outline" disabled>
          Charger plus de projets
        </button>
      </div>
    </div>
  `

  return renderDashboardLayout({
    user,
    activePage: 'projects',
    content,
  })
}

export function mountProjectsPage(root: HTMLElement): void {
  root.innerHTML = renderProjectsPage()
  setupDashboardLayout(root)
}

import { apiFetch } from './auth.ts'

export interface InvestorResume {
  nb_projets: number
  nb_terrains: number
  nb_analyses: number
  score_moyen: number | null
}

export interface ProjetResume {
  id: number
  nom: string
  type_nom: string
  surface_souhaitee: number
  budget_total: number
  date_creation: string | null
  nb_terrains: number
  nb_analyses: number
  score_moyen: number | null
  derniere_analyse: string | null
}

export interface TerrainResume {
  id: number
  nom: string
  superficie: number
  lat: number | null
  lng: number | null
  score: number
  accessibilite: number
  positionnement: number
  topographie: number
  projet_nom: string
  projet_id: number
}

export interface AnalyseResume {
  id: number
  date_creation: string | null
  nombre_parcelles: number
  statut: string
  projet_nom: string
  projet_id: number
}

export interface ResultatTop {
  id: number
  reference_cadastrale: string
  nom: string
  superficie: number | null
  score_final: number | null
  score_amc: number | null
  score_accessibilite: number | null
  score_positionnement: number | null
  score_topographie: number | null
  rang: number | null
  projet_nom: string
  projet_id: number
}

export interface InvestorDashboardData {
  resume: InvestorResume
  projets: ProjetResume[]
  meilleurs_terrains: TerrainResume[]
  dernieres_analyses: AnalyseResume[]
  top_resultats: ResultatTop[]
}

export async function fetchInvestorDashboard(): Promise<InvestorDashboardData> {
  const res = await apiFetch('/api/projets/investor-dashboard/')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = data.detail || 'Erreur lors du chargement du tableau de bord.'
    throw new Error(msg)
  }
  return res.json() as Promise<InvestorDashboardData>
}

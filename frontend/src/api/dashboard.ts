import { apiFetch } from './auth.ts'

export interface MoisPoint {
  mois: string
  total: number
}

export interface UtilisateursStats {
  total: number
  actifs: number
  actifs_aujourdhui: number
  nouveaux: number
  desactives: number
  par_role: Record<string, number>
  evolution: MoisPoint[]
}

export interface CouchesStats {
  total: number
  ajoutees: number
  modifiees: number
  supprimees: number
  evolution: MoisPoint[]
}

export interface AnalysesStats {
  total: number
  semaine: number
  evolution: MoisPoint[]
}

export interface HistoriqueAction {
  id: number
  action: 'ajout' | 'modification' | 'suppression'
  entite: string
  description: string
  utilisateur: string
  date: string
}

export interface ActiviteStats {
  total: number
  evolution: MoisPoint[]
  historique: HistoriqueAction[]
  projets: number
  parcelles_cadastrales: number
  messages: number
  notifications_non_lues: number
  par_entite: Record<string, number>
}

export interface DashboardStats {
  date: string
  utilisateurs: UtilisateursStats
  couches: CouchesStats
  analyses: AnalysesStats
  activite: ActiviteStats
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await apiFetch('/api/dashboard/')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = data.detail || 'Une erreur est survenue lors du chargement des statistiques.'
    throw new Error(msg)
  }
  return res.json() as Promise<DashboardStats>
}

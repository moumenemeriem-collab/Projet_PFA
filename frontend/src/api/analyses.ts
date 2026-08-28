import { apiFetch } from './auth.ts'
import type { AnalyseCriteres, AnalyseFiltres, CritereConformite } from './terrains.ts'

export interface ResultatAnalyse {
  id: number
  id_parcelle: string
  reference_cadastrale: string
  indice?: string
  nom: string
  superficie: number | null
  lat: number | null
  lng: number | null
  score_accessibilite: number | null
  score_positionnement: number | null
  score_topographie: number | null
  score_superficie: number | null
  score_amc: number | null
  roi: number | null
  marge: number | null
  benefice_net: number | null
  prix_terrain: number | null
  score_rentabilite: number | null
  type_rentabilite: string
  score_final: number | null
  rang: number | null
  nombre_criteres_satisfaits: number
  total_criteres: number
  criteres: AnalyseCriteres[] | null
  criteres_conformite: CritereConformite[] | null
  points_forts: string[] | null
  points_faibles: string[] | null
}

export interface Analyse {
  id: number
  projet: number
  date_creation: string
  filtres: AnalyseFiltres | null
  poids_amc: string
  poids_rentabilite: string
  nombre_parcelles: number
  statut: string
}

export interface AnalyseDetail extends Analyse {
  resultats: ResultatAnalyse[]
}

export async function fetchAnalyses(projetId: number): Promise<Analyse[]> {
  const res = await apiFetch(`/api/projets/${projetId}/analyses/`)
  return parseResponse<Analyse[]>(res)
}

export async function createAnalyse(
  projetId: number,
  filtres: AnalyseFiltres,
): Promise<AnalyseDetail> {
  const res = await apiFetch(`/api/projets/${projetId}/analyses/`, {
    method: 'POST',
    body: JSON.stringify({ filtres }),
  }, 120000)
  return parseResponse<AnalyseDetail>(res)
}

export async function fetchAnalyseDetail(projetId: number, analyseId: number): Promise<AnalyseDetail> {
  const res = await apiFetch(`/api/projets/${projetId}/analyses/${analyseId}/`)
  return parseResponse<AnalyseDetail>(res)
}

export async function fetchAnalyseResultats(
  projetId: number,
  analyseId: number,
): Promise<{ total: number; resultats: ResultatAnalyse[] }> {
  const res = await apiFetch(`/api/projets/${projetId}/analyses/${analyseId}/resultats/`)
  return parseResponse<{ total: number; resultats: ResultatAnalyse[] }>(res)
}

// ---------------------------------------------------------------------------
// Analyse pondérée AHP+ROC
// ---------------------------------------------------------------------------

export interface PonderationRequest {
  matrice_ahp: [number, number]
  ordre_categories: string[]
  ordres_roc: Record<string, string[]>
  selections_criteres: Record<string, string | string[]>
  preferences_localisation: Record<string, string>
  preferences_altitude: string[]
  seuil: number
}

export interface Contribution {
  critere: string
  poids: number
  score: number
  contribution: number
}

export interface TerrainPondere {
  id: number
  nom: string
  superficie: number
  lat: number
  lng: number
  reference_cadastrale?: string
  indice?: string
  consistance?: string
  score_final: number
  rang: number
  contributions: Contribution[]
  distances: Record<string, number | null>
  zone_localisation: string
  altitude: number | null
  geometry?: Record<string, unknown> | null
  fid?: number | null
  num_parcelle?: string
}

export interface PonderationResponse {
  total: number
  resultats: TerrainPondere[]
  poids_globaux: Record<string, number>
  poids_ahp: Record<string, number>
  CR: number
  coherent: boolean
}

export interface PonderationPreference {
  id: number
  projet: number
  matrice_ahp: [number, number]
  ordre_categories: string[]
  ordres_roc: Record<string, string[]>
  selections_criteres: Record<string, string[]>
  preferences_localisation: Record<string, string>
  preferences_altitude: string[]
  seuil: number
  date_creation: string
  date_mise_a_jour: string
}

export async function createAnalysePondere(
  projetId: number,
  payload: PonderationRequest,
): Promise<PonderationResponse> {
  const res = await apiFetch(`/api/projets/${projetId}/analyser-pondere/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 120000)
  return parseResponse<PonderationResponse>(res)
}

export async function fetchPonderationPreferences(
  projetId: number,
): Promise<PonderationPreference | null> {
  const res = await apiFetch(`/api/projets/${projetId}/ponderation-preferences/`)
  if (res.status === 204 || res.status === 404) return null
  return parseResponse<PonderationPreference>(res)
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = data.detail || Object.values(data).flat().join(' ') || 'Une erreur est survenue.'
    throw new Error(msg)
  }
  return res.json()
}

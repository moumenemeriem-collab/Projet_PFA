import { apiFetch } from './auth.ts'

export interface Terrain {
  id: number
  nom: string
  superficie: string
  lat: string
  lng: string
  accessibilite: number
  positionnement: number
  topographie: number
  score: string
  projet: number
  date_creation: string
}

export interface TerrainListResponse {
  count: number
  results: Terrain[]
}

export interface TerrainPayload {
  nom: string
  superficie: number
  lat: number
  lng: number
  accessibilite: number
  positionnement: number
  topographie: number
}

export async function fetchTerrains(projetId: number, params: {
  search?: string
  page?: number
  page_size?: number
} = {}): Promise<TerrainListResponse> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.page) qs.set('page', String(params.page))
  if (params.page_size) qs.set('page_size', String(params.page_size))
  const query = qs.toString()
  const res = await apiFetch(`/api/projets/${projetId}/terrains/${query ? '?' + query : ''}`)
  return parseResponse<TerrainListResponse>(res)
}

export async function createTerrain(projetId: number, payload: TerrainPayload): Promise<Terrain> {
  const res = await apiFetch(`/api/projets/${projetId}/terrains/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseResponse<Terrain>(res)
}

export interface AnalyseFiltres {
  route_type?: string[]
  distance_route?: string
  health?: string[]
  distance_health?: string
  education?: string[]
  distance_education?: string
  commerce?: string[]
  distance_commerce?: string
  transport?: string[]
  distance_transport?: string
  admin?: string[]
  distance_admin?: string
  pole?: string[]
  distance_poles?: string
  localisation?: string[]
  pente?: string[]
  denivele?: string[]
  altitude?: string[]
}

export interface AnalyseResultat {
  id: number
  nom: string
  superficie: number
  lat: number
  lng: number
  score_global: number
  score_final: number
  score_amc: number
  score_accessibilite: number
  score_positionnement: number
  score_topographie: number
  score_superficie: number | null
  roi: number | null
  marge: number | null
  benefice_net: number | null
  score_rentabilite: number | null
  type_rentabilite: 'personnalisee' | 'benchmark' | 'indisponible'
  prix_terrain: number | null
  infos_generales: {
    reference_cadastrale: string
    commune: string
    province: string
    region: string
    superficie: string
    perimetre: string
    latitude: number
    longitude: number
    zone_amenagement: string
  }
  criteres: AnalyseCriteres[]
  criteres_satisfaits: number
  criteres_total: number
  classement: number
  points_forts: string[]
  points_faibles: string[]
}

export interface AnalyseCriteres {
  id: string
  critere: string
  critere_demande: string
  valeur_mesuree: string
  valeur_mesuree_brute: number
  unite: string
  point_interet: string
  conforme: boolean
}

export interface AnalyseResponse {
  total: number
  resultats: AnalyseResultat[]
}

export async function fetchAnalyse(projetId: number, filtres: AnalyseFiltres): Promise<AnalyseResponse> {
  const res = await apiFetch(`/api/projets/${projetId}/analyser-parcelles/`, {
    method: 'POST',
    body: JSON.stringify(filtres),
  })
  return parseResponse<AnalyseResponse>(res)
}

export async function deleteTerrain(projetId: number, terrainId: number): Promise<void> {
  const res = await apiFetch(`/api/projets/${projetId}/terrains/${terrainId}/`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Erreur lors de la suppression.')
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = data.detail || Object.values(data).flat().join(' ') || 'Une erreur est survenue.'
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

import { apiFetch } from './auth.ts'

export interface Terrain {
  id: number
  nom: string
  superficie: string
  lat: string | null
  lng: string | null
  accessibilite: number
  positionnement: number
  topographie: number
  score: string
  projet: number
  utilisateur: number | null
  fid?: number | null
  indice?: string
  complement?: string
  consistance?: string
  num_parcelle?: string
  num_titre_foncier: string
  statut_juridique: string
  prix_demande: string | null
  zonage: string
  cos: string | null
  cus: string | null
  hauteur_maximale: string | null
  equipements: string[]
  geometry: string
  date_creation: string
  rentabilite_json?: Record<string, unknown> | null
}

export interface TerrainListResponse {
  count: number
  results: Terrain[]
}

export interface TerrainPayload {
  num_titre_foncier: string
  statut_juridique: string
  prix_demande: number | null
  zonage: string
  cos: number | null
  cus: number | null
  hauteur_maximale: number | null
  equipements: string[]
  superficie: number | null
  lat: number | null
  lng: number | null
  geometry: string
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
  score_accessibilite: number | null
  score_positionnement: number | null
  score_topographie: number | null
  score_superficie: number | null
  roi: number | null
  marge: number | null
  benefice_net: number | null
  score_rentabilite: number | null
  type_rentabilite: 'personnalisee' | 'benchmark' | 'indisponible'
  prix_terrain: number | null
  infos_generales: {
    reference_cadastrale: string
    indice?: string
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
  criteres_conformite?: CritereConformite[]
  classement: number
  points_forts: string[]
  points_faibles: string[]
  /** Géométrie réelle du terrain (polygone GeoJSON) si disponible. */
  geom?: Record<string, unknown> | null
  fid?: number | null
  num_parcelle?: string
  indice?: string
}

export interface CritereConformite {
  cle: string
  poids: number
  pct: number
  label: string
  valeur: number
  cible: number | number[]
  unite: string
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
  }, 120000)
  return parseResponse<AnalyseResponse>(res)
}

export async function deleteTerrain(projetId: number, terrainId: number): Promise<void> {
  const res = await apiFetch(`/api/projets/${projetId}/terrains/${terrainId}/`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Erreur lors de la suppression.')
  }
}

export async function saveTerrainRentabilite(projetId: number, terrainId: number, rentabiliteJson: Record<string, unknown>): Promise<Terrain> {
  const res = await apiFetch(`/api/projets/${projetId}/terrains/${terrainId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ rentabilite_json: rentabiliteJson }),
  })
  return parseResponse<Terrain>(res)
}

export interface AffectationSurface {
  designation: string
  surface_m2: number
  type: 'constructible' | 'non_constructible' | 'parent'
  type_construction: string | null
  cos: number | null
  cus: number | null
}

export interface SurfaceConstructibleResponse {
  surface_constructible: number
  superficie: number
  taux: number
  non_construable: number
  affectations: AffectationSurface[]
  designation_dominante: string | null
  cos: number | null
  cus: number | null
}

export async function fetchSurfaceConstructible(projetId: number, terrainId: number): Promise<SurfaceConstructibleResponse> {
  const res = await apiFetch(`/api/projets/${projetId}/terrains/${terrainId}/surface-constructible/`)
  return parseResponse<SurfaceConstructibleResponse>(res)
}

export async function computeSurfaceConstructible(projetId: number, geometry: Record<string, unknown>, superficie: number): Promise<SurfaceConstructibleResponse> {
  const res = await apiFetch(`/api/projets/${projetId}/surface-constructible/`, {
    method: 'POST',
    body: JSON.stringify({ geometry, superficie }),
  })
  return parseResponse<SurfaceConstructibleResponse>(res)
}

export interface SurfaceEquipementResponse {
  surface_equipement: number
  taux_equipement: number
  surface_equipement_prive: number
  taux_equipement_prive: number
  surface_voie: number
  surface_espace_vert: number
}

export async function fetchSurfaceEquipement(projetId: number, terrainId: number): Promise<SurfaceEquipementResponse> {
  const res = await apiFetch(`/api/projets/${projetId}/terrains/${terrainId}/surface-equipement/`)
  return parseResponse<SurfaceEquipementResponse>(res)
}

export async function computeSurfaceEquipement(projetId: number, geometry: Record<string, unknown>, superficie = 0): Promise<SurfaceEquipementResponse> {
  const res = await apiFetch(`/api/projets/${projetId}/surface-equipement/`, {
    method: 'POST',
    body: JSON.stringify({ geometry, superficie }),
  })
  return parseResponse<SurfaceEquipementResponse>(res)
}

export interface BulkImportResponse {
  message: string
  nb_importes: number
  nb_ignores: number
}

export async function bulkImportCadastre(projetId: number, file: File, remplacer = false): Promise<BulkImportResponse> {
  const form = new FormData()
  form.append('fichier', file)
  form.append('remplacer', String(remplacer))
  const res = await apiFetch(`/api/projets/${projetId}/terrains/import-cadastre/`, {
    method: 'POST',
    body: form,
    headers: {},
  })
  return parseResponse<BulkImportResponse>(res)
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

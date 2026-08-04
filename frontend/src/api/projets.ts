import { apiFetch } from './auth.ts'

const API_BASE = '/api/projets'

export interface TypeProjet {
  id: number
  nom: string
  description: string
  image_defaut: string | null
  actif: boolean
}

export interface Rentabilite {
  investissement_total: number | null
  revenu_total: number | null
  benefice_net: number | null
  roi: number | null
  marge: number | null
  seuil_unites: number | null
  budget_respecte: boolean | null
  complete: boolean
}

export interface Projet {
  id: number
  nom: string
  description: string
  id_type: number
  type_nom: string
  type_image_defaut?: string | null
  surface_souhaitee: string
  budget_total: string
  prix_terrain: string | null
  nombre_unites: number | null
  surface_construite: string | null
  cout_construction: string | null
  autres_charges: string | null
  prix_vente_unitaire: string | null
  revenu_estime: string | null
  image: string | null
  date_creation: string
  investisseur: number
  rentabilite?: Rentabilite | null
}

export interface ProjetListResponse {
  count: number
  results: Projet[]
}

export interface ProjetPayload {
  nom: string
  description?: string
  id_type: number
  surface_souhaitee: number
  budget_total: number
  prix_terrain?: number | null
  nombre_unites?: number | null
  surface_construite?: number | null
  cout_construction?: number | null
  autres_charges?: number | null
  prix_vente_unitaire?: number | null
  revenu_estime?: number | null
  image?: string
}

export async function fetchTypesProjet(): Promise<TypeProjet[]> {
  const res = await apiFetch(`${API_BASE}/types/`)
  return parseResponse<TypeProjet[]>(res)
}

export async function fetchProjets(params: {
  search?: string
  type?: number
  page?: number
  page_size?: number
} = {}): Promise<ProjetListResponse> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.type) qs.set('type', String(params.type))
  if (params.page) qs.set('page', String(params.page))
  if (params.page_size) qs.set('page_size', String(params.page_size))
  const query = qs.toString()
  const res = await apiFetch(`${API_BASE}/${query ? '?' + query : ''}`)
  return parseResponse<ProjetListResponse>(res)
}

export async function fetchProjet(id: number): Promise<Projet> {
  const res = await apiFetch(`${API_BASE}/${id}/`)
  return parseResponse<Projet>(res)
}

export async function createProjet(payload: ProjetPayload): Promise<Projet> {
  const res = await apiFetch(`${API_BASE}/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseResponse<Projet>(res)
}

export async function updateProjet(id: number, payload: Partial<ProjetPayload>): Promise<Projet> {
  const res = await apiFetch(`${API_BASE}/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return parseResponse<Projet>(res)
}

export async function deleteProjet(id: number): Promise<void> {
  const res = await apiFetch(`${API_BASE}/${id}/`, { method: 'DELETE' })
  if (!res.ok) {
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

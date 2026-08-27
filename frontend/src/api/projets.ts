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
  ok: boolean
  error?: string
  surfaces?: {
    surface_brute: number
    shon: number
    shob: number
    surface_vendable: number
    surface_appartements: number
    surface_commerces: number
    surface_bureaux: number
    surface_equipements: number
    surface_equipements_prives: number
    surface_voie: number
    surface_espace_vert: number
    surface_a_amenager: number
  }
  ca?: {
    ca_appartements: number
    ca_commerces: number
    ca_bureaux: number
    ca_equipements: number
    ca_equipements_prives: number
    ca_total: number
  }
  construction?: {
    cout_appartements: number
    cout_commerces: number
    cout_bureaux: number
    cout_equipements: number
    cout_equipements_prives: number
    cout_total: number
  }
  charges?: {
    frais_etudes: number
    imprevus: number
    frais_commercialisation: number
    amenagement: number
    cout_acquisition_foncier?: number
  }
  acquisition?: {
    prix_foncier: number
    frais_acquisition: number
    cout_total: number
  }
  cout_total_projet?: number
  benefice_net?: number
  roi?: number
  van?: number
  tri?: number
  flux?: Array<{
    annee: number
    ca: number
    ca_commercialisation?: number
    ca_equipements?: number
    ca_total?: number
    acquisition: number
    construction: number
    etudes_honoraires: number
    imprevus: number
    autre_charge?: number
    commercialisation: number
    amenagement: number
    flux_net: number
  }>
  repartition_construction?: number[]
  repartition_ventes?: number[]
  repartition_ventes_equipement?: number[]
  repartition_ventes_equipement_prive?: number[]
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
  prix_foncier_m2?: string | null
  frais_acquisition?: string
  taux_chute?: string
  cos?: string | null
  cus?: string | null
  surface_constructible?: string | null
  surface_voie?: string | null
  surface_espace_vert?: string | null
  has_appartement?: boolean
  has_commerce?: boolean
  has_bureau?: boolean
  has_equipement?: boolean
  has_equipement_prive?: boolean
  quote_part_appartement?: string
  quote_part_commerce?: string
  quote_part_bureau?: string
  quote_part_equipement?: string
  quote_part_equipement_prive?: string
  prix_vente_appartement?: string | null
  prix_vente_commerce?: string | null
  prix_vente_bureau?: string | null
  surface_equipement?: string | null
  prix_vente_equipement?: string | null
  surface_equipement_prive?: string | null
  prix_vente_equipement_prive?: string | null
  cout_construction_appartement?: string | null
  cout_construction_commerce?: string | null
  cout_construction_bureau?: string | null
  cout_construction_equipement?: string | null
  cout_construction_equipement_prive?: string | null
  taux_etudes_honoraires?: string
  taux_imprevus?: string
  taux_commercialisation?: string
  duree_construction?: number
  duree_commercialisation?: number
  taux_actualisation?: string
  repartition_construction?: number[] | null
  repartition_ventes?: number[] | null
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
  surface_totale?: number
  budget_total: number
  prix_terrain?: number
  nombre_unites?: number
  surface_construite?: number
  cout_construction?: number
  autres_charges?: number
  prix_vente_unitaire?: number
  revenu_estime?: number
  image?: string
  prix_foncier_m2?: number
  frais_acquisition?: number
  taux_chute?: number
  cos?: number
  cus?: number
  surface_constructible?: number
  surface_voie?: number
  surface_espace_vert?: number
  has_appartement?: boolean
  has_commerce?: boolean
  has_bureau?: boolean
  has_equipement?: boolean
  has_equipement_prive?: boolean
  quote_part_appartement?: number
  quote_part_commerce?: number
  quote_part_bureau?: number
  quote_part_equipement?: number
  quote_part_equipement_prive?: number
  prix_vente_appartement?: number
  prix_vente_commerce?: number
  prix_vente_bureau?: number
  surface_equipement?: number
  prix_vente_equipement?: number
  surface_equipement_prive?: number
  prix_vente_equipement_prive?: number
  cout_construction_appartement?: number
  cout_construction_commerce?: number
  cout_construction_bureau?: number
  cout_construction_equipement?: number
  cout_construction_equipement_prive?: number
  taux_etudes_honoraires?: number
  taux_imprevus?: number
  taux_commercialisation?: number
  duree_construction?: number
  duree_commercialisation?: number
  taux_actualisation?: number
  repartition_construction?: number[]
  repartition_ventes?: number[]
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

export async function previewRentabilite(payload: ProjetPayload): Promise<Rentabilite> {
  const res = await apiFetch(`${API_BASE}/rentabilite/preview/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return parseResponse<Rentabilite>(res)
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

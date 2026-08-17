const API_BASE = '/api/projets/couches'

export interface AttributDefinition {
  nom: string
  type: string
}

export interface Couche {
  id: number
  nom: string
  nom_affichage: string
  description: string
  categorie: string
  type_geometrie: string
  attributs: AttributDefinition[]
  table_liee: string | null
  fichier: string | null
  taille_fichier: number | null
  format_fichier: string
  etat: string
  message_erreur: string
  taille_affichage: string
  ordre: number
  date_creation: string
  date_mise_a_jour: string
}

export interface CoucheListResponse {
  count: number
  results: Couche[]
}

export interface ImportCouche {
  id: number
  couche: number
  fichier: string
  statut: string
  message_erreur: string | null
  date_import: string
}

async function apiJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = localStorage.getItem('access_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(url, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : 'Erreur serveur'
    throw new Error(msg)
  }
  return data as T
}

export async function fetchCouches(): Promise<Couche[]> {
  const data = await apiJson<unknown>(API_BASE + '/')
  if (Array.isArray(data)) return data as Couche[]
  return (data as CoucheListResponse).results
}

export async function fetchCouche(id: number): Promise<Couche> {
  return apiJson<Couche>(`${API_BASE}/${id}/`)
}

export interface CoucheFeature {
  type: string
  properties: Record<string, unknown>
  geometry: unknown
}

export interface CoucheFeatureCollection {
  type: 'FeatureCollection'
  features: CoucheFeature[]
}

export async function fetchCoucheGeoJSON(id: number): Promise<CoucheFeatureCollection> {
  const token = localStorage.getItem('access_token')
  const response = await fetch(`${API_BASE}/${id}/download/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data || data.type !== 'FeatureCollection') {
    throw new Error('Erreur lors du chargement de la couche')
  }
  return data as CoucheFeatureCollection
}

export async function importerCouche(id: number, file: File): Promise<ImportCouche> {
  const formData = new FormData()
  formData.append('fichier', file)
  const token = localStorage.getItem('access_token')
  const response = await fetch(`${API_BASE}/${id}/import/`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : "Erreur lors de l'import"
    throw new Error(msg)
  }
  return data as ImportCouche
}

export function telechargerCouche(id: number): void {
  const token = localStorage.getItem('access_token')
  const url = `${API_BASE}/${id}/download/`
  fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(res => {
      if (!res.ok) throw new Error('Téléchargement échoué')
      return res.blob()
    })
    .then(blob => {
      const link = document.createElement('a')
      const blobUrl = URL.createObjectURL(blob)
      link.href = blobUrl
      link.download = `couche-${id}.geojson`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    })
    .catch(err => alert(err.message))
}

export interface CoucheFeatureRow {
  id: number
  geometry: unknown
  properties: Record<string, unknown>
}

export interface CoucheFeaturesResponse {
  count: number
  results: CoucheFeatureRow[]
}

export async function fetchCoucheFeatures(id: number, params?: { search?: string; page?: number; page_size?: number }): Promise<CoucheFeaturesResponse> {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.page_size) qs.set('page_size', String(params.page_size))
  const url = `${API_BASE}/${id}/features/${qs.toString() ? '?' + qs.toString() : ''}`
  return apiJson<CoucheFeaturesResponse>(url)
}

export async function createCoucheFeature(id: number, properties: Record<string, unknown>, geometry?: unknown): Promise<{ id: number }> {
  const token = localStorage.getItem('access_token')
  const response = await fetch(`${API_BASE}/${id}/features/create/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ properties, geometry: geometry ?? null }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Erreur lors de la création')
  return data as { id: number }
}

export async function updateCoucheFeature(coucheId: number, featureId: number, properties: Record<string, unknown>, geometry?: unknown): Promise<void> {
  const token = localStorage.getItem('access_token')
  const response = await fetch(`${API_BASE}/${coucheId}/features/${featureId}/update/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ properties, geometry }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Erreur lors de la mise à jour')
}

export async function deleteCoucheFeature(coucheId: number, featureId: number): Promise<void> {
  const token = localStorage.getItem('access_token')
  const response = await fetch(`${API_BASE}/${coucheId}/features/${featureId}/delete/`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Erreur lors de la suppression')
}

export async function duplicateCoucheFeature(coucheId: number, featureId: number): Promise<{ id: number }> {
  const token = localStorage.getItem('access_token')
  const response = await fetch(`${API_BASE}/${coucheId}/features/${featureId}/duplicate/`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Erreur lors de la duplication')
  return data as { id: number }
}

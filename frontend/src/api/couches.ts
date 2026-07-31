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
      link.href = URL.createObjectURL(blob)
      link.download = `couche-${id}.geojson`
      link.click()
      URL.revokeObjectURL(url)
    })
    .catch(err => alert(err.message))
}

import { API_BASE, apiJson, type Utilisateur } from './auth.ts'

export interface AdminUtilisateur extends Utilisateur {
  mot_de_passe: string
}

export interface UserListResponse {
  count: number
  results: AdminUtilisateur[]
}

export interface UserFormPayload {
  prenom: string
  nom: string
  email: string
  telephone?: string
  role: 'investisseur' | 'admin'
  mot_de_passe: string
  confirmer_mot_de_passe: string
}

export async function fetchUsers(search = '', role = ''): Promise<UserListResponse> {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (role) params.set('role', role)
  const query = params.toString() ? `?${params.toString()}` : ''

  return apiJson<UserListResponse>(`${API_BASE}/users/${query}`)
}

export async function createUser(payload: UserFormPayload): Promise<AdminUtilisateur> {
  const data = await apiJson<{ utilisateur: AdminUtilisateur }>(`${API_BASE}/users/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.utilisateur
}

export async function updateUser(
  id: number,
  payload: Partial<UserFormPayload>,
): Promise<AdminUtilisateur> {
  const data = await apiJson<{ utilisateur: AdminUtilisateur }>(`${API_BASE}/users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.utilisateur
}

export async function deleteUser(id: number): Promise<void> {
  await apiJson<{ message: string }>(`${API_BASE}/users/${id}/`, {
    method: 'DELETE',
  })
}

export function getInitials(user: Utilisateur): string {
  return `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()
}

export function getFullName(user: Utilisateur): string {
  return `${user.prenom} ${user.nom}`
}

export function exportUsersCsv(users: Utilisateur[]): void {
  const header = 'Prénom,Nom,Email,Téléphone,Rôle,Date création'
  const rows = users.map((user) =>
    [user.prenom, user.nom, user.email, user.telephone ?? '', user.role, user.date_creation]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'utilisateurs-websig.csv'
  link.click()
  URL.revokeObjectURL(url)
}

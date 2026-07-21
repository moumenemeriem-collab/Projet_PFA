import { ApiError, formatApiErrors, type Utilisateur, updateStoredUser } from './auth.ts'

const API_BASE = '/api/auth'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : 'Une erreur est survenue. Veuillez réessayer.'
    throw new ApiError(message, response.status, data)
  }

  return data as T
}

export interface ProfileUpdatePayload {
  prenom: string
  nom: string
  email: string
  telephone?: string
}

export interface ChangePasswordPayload {
  mot_de_passe_actuel: string
  nouveau_mot_de_passe: string
  confirmer_mot_de_passe: string
}

export async function fetchProfile(): Promise<Utilisateur> {
  const response = await fetch(`${API_BASE}/me/`, {
    headers: authHeaders(),
  })
  return parseResponse<Utilisateur>(response)
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<Utilisateur> {
  const response = await fetch(`${API_BASE}/me/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await parseResponse<{ utilisateur: Utilisateur }>(response)
  updateStoredUser(data.utilisateur)
  return data.utilisateur
}

export async function changePassword(payload: ChangePasswordPayload): Promise<string> {
  const response = await fetch(`${API_BASE}/me/password/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await parseResponse<{ message: string }>(response)
  return data.message
}

export function getInitials(user: Utilisateur): string {
  return `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()
}

export function getRoleLabel(role: Utilisateur['role']): string {
  return role === 'investisseur'
    ? 'Investisseur • WebSIG Khémisset'
    : 'Administrateur • WebSIG Khémisset'
}

export { formatApiErrors }

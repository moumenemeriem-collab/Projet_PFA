const API_BASE = '/api/auth'

export interface Utilisateur {
  id: number
  prenom: string
  nom: string
  email: string
  telephone: string | null
  role: 'investisseur' | 'admin'
  date_creation: string
}

export interface AuthResponse {
  message: string
  utilisateur: Utilisateur
  tokens: {
    access: string
    refresh: string
  }
}

export interface RegisterPayload {
  prenom: string
  nom: string
  email: string
  telephone?: string
  mot_de_passe: string
  confirmer_mot_de_passe: string
}

export interface LoginPayload {
  email: string
  mot_de_passe: string
}

class ApiError extends Error {
  status: number
  errors: Record<string, unknown>

  constructor(message: string, status: number, errors: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

function extractErrorMessage(data: Record<string, unknown>): string {
  if (typeof data.detail === 'string') return data.detail

  if (Array.isArray(data.messages)) {
    const messages = data.messages
      .map((item) => {
        if (typeof item === 'object' && item !== null && 'message' in item) {
          return String((item as { message: string }).message)
        }
        return ''
      })
      .filter(Boolean)
    if (messages.length > 0) return messages.join(' ')
  }

  const fieldMessages = Object.entries(data)
    .filter(([key]) => !['detail', 'code', 'messages'].includes(key))
    .flatMap(([, value]) => {
      if (Array.isArray(value)) return value.map(String)
      if (typeof value === 'string') return [value]
      return []
    })

  if (fieldMessages.length > 0) return fieldMessages.join(' ')

  return 'Une erreur est survenue. Veuillez réessayer.'
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const payload = data as Record<string, unknown>
    throw new ApiError(extractErrorMessage(payload), response.status, payload)
  }

  return data as T
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return null

  const response = await fetch(`${API_BASE}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })

  if (!response.ok) return null

  const data = (await response.json()) as { access: string; refresh?: string }
  localStorage.setItem('access_token', data.access)
  if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
  return data.access
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const buildHeaders = () => {
    const headers = new Headers(options.headers)
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json')
    }
    const token = localStorage.getItem('access_token')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  }

  let response = await fetch(url, { ...options, headers: buildHeaders() })

  if (response.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      response = await fetch(url, { ...options, headers: buildHeaders() })
    } else {
      clearSession()
      window.location.href = '/login'
      throw new ApiError('Session expirée. Veuillez vous reconnecter.', 401)
    }
  }

  return response
}

export async function apiJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(url, options)
  return parseResponse<T>(response)
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<AuthResponse>(response)
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<AuthResponse>(response)
}

export function saveSession(tokens: AuthResponse['tokens'], utilisateur: Utilisateur): void {
  localStorage.setItem('access_token', tokens.access)
  localStorage.setItem('refresh_token', tokens.refresh)
  localStorage.setItem('utilisateur', JSON.stringify(utilisateur))
}

export function updateStoredUser(utilisateur: Utilisateur): void {
  localStorage.setItem('utilisateur', JSON.stringify(utilisateur))
}

export function clearSession(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('utilisateur')
}

export function getStoredUser(): Utilisateur | null {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return null
  try {
    return JSON.parse(raw) as Utilisateur
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('access_token') && !!getStoredUser()
}

export function getPostAuthRedirect(role: Utilisateur['role']): string {
  if (role === 'investisseur') return '/projets'
  if (role === 'admin') return '/admin/utilisateurs'
  return '/'
}

export function formatApiErrors(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'
  }

  if (error.errors && typeof error.errors === 'object') {
    const messages = Object.entries(error.errors)
      .filter(([key]) => !['detail', 'code', 'messages'].includes(key))
      .flatMap(([, value]) => {
        if (Array.isArray(value)) return value.map(String)
        if (typeof value === 'string') return [value]
        return []
      })
    if (messages.length > 0) return messages.join(' ')
  }

  if (error.status === 401) {
    return 'Session expirée. Veuillez vous reconnecter.'
  }

  return error.message
}

export { ApiError, API_BASE }

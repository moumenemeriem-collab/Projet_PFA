import { apiJson } from './auth.ts'

export interface Utilisateur {
  id: number
  prenom: string
  nom: string
  email: string
  telephone: string | null
  role: 'investisseur' | 'admin'
  date_creation: string
}

export interface Reponse {
  id: number
  message: number
  auteur: Utilisateur
  contenu: string
  date_creation: string
  date_modification: string
}

export interface Message {
  id: number
  expediteur: Utilisateur
  sujet: string
  contenu: string
  date_creation: string
  date_modification: string
  est_lu: boolean
  nb_reponses?: number
  derniere_reponse?: Reponse | null
  reponses?: Reponse[]
}

export interface MessageListResponse {
  count: number
  results: Message[]
}

export interface AdminMessageListResponse {
  count: number
  non_lus: number
  total: number
  results: Message[]
}

const MESSAGES_BASE = '/api/messages'

export function fetchMessages(search = '', statut = '', page = 1): Promise<MessageListResponse> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (statut) params.set('statut', statut)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return apiJson<MessageListResponse>(`${MESSAGES_BASE}/${qs ? '?' + qs : ''}`)
}

export function fetchAdminMessages(search = '', statut = '', page = 1): Promise<AdminMessageListResponse> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (statut) params.set('statut', statut)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return apiJson<AdminMessageListResponse>(`${MESSAGES_BASE}/admin/${qs ? '?' + qs : ''}`)
}

export function fetchMessage(id: number): Promise<Message> {
  return apiJson<Message>(`${MESSAGES_BASE}/${id}/`)
}

export function createMessage(payload: { sujet: string; contenu: string }): Promise<{ message: string; data: Message }> {
  return apiJson<{ message: string; data: Message }>(`${MESSAGES_BASE}/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMessage(id: number, payload: { sujet?: string; contenu?: string }): Promise<{ message: string; data: Message }> {
  return apiJson<{ message: string; data: Message }>(`${MESSAGES_BASE}/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteMessage(id: number): Promise<{ message: string }> {
  return apiJson<{ message: string }>(`${MESSAGES_BASE}/${id}/`, {
    method: 'DELETE',
  })
}

export function createReponse(messageId: number, contenu: string): Promise<{ message: string; data: Reponse }> {
  return apiJson<{ message: string; data: Reponse }>(`${MESSAGES_BASE}/${messageId}/repondre/`, {
    method: 'POST',
    body: JSON.stringify({ contenu }),
  })
}

export function updateReponse(id: number, payload: { contenu: string }): Promise<{ message: string; data: Reponse }> {
  return apiJson<{ message: string; data: Reponse }>(`${MESSAGES_BASE}/reponses/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteReponse(id: number): Promise<{ message: string }> {
  return apiJson<{ message: string }>(`${MESSAGES_BASE}/reponses/${id}/`, {
    method: 'DELETE',
  })
}

export function marquerMessageLu(id: number): Promise<{ message: string }> {
  return apiJson<{ message: string }>(`${MESSAGES_BASE}/admin/${id}/marquer-lu/`, {
    method: 'POST',
  })
}

export function getFullName(user: Utilisateur): string {
  return `${user.prenom} ${user.nom}`
}

export function getInitials(user: Utilisateur): string {
  return `${user.prenom.charAt(0)}${user.nom.charAt(0)}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export interface Notification {
  id: number
  titre: string
  contenu: string
  type_notif: string
  message_id: number | null
  lu: boolean
  date_creation: string
}

export interface NotificationListResponse {
  non_lues: number
  results: Notification[]
}

export function fetchNotifications(): Promise<NotificationListResponse> {
  return apiJson<NotificationListResponse>(`${MESSAGES_BASE}/notifications/`)
}

export function markNotificationsRead(): Promise<{ message: string }> {
  return apiJson<{ message: string }>(`${MESSAGES_BASE}/notifications/marquer-lues/`, {
    method: 'POST',
  })
}

export function deleteNotification(id: number): Promise<{ message: string }> {
  return apiJson<{ message: string }>(`${MESSAGES_BASE}/notifications/${id}/`, {
    method: 'DELETE',
  })
}

import { useEffect } from 'react'
import { Icon } from './icons'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ titre: string; categorie: string; score: number }>
}

interface StoredConversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

const SUGGESTIONS = [
  'Qu\'est-ce que GEO INVEST ?',
  'Comment fonctionne le classement multicritères ?',
  'Quels sont les frais d\'un achat immobilier au Maroc ?',
  'Qu\'est-ce qu\'un titre foncier ?',
]

const STORAGE_KEY = 'geoInvest_chat_conversations'

const dynamicIconStrings: Record<string, string> = {
  robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="9" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="16" r="1" fill="currentColor" stroke="none"/><path d="M12 11V7"/><path d="M8 4h8l1 4H7l1-4z"/><line x1="12" y1="3" x2="12" y2="1"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
}

function iconStr(name: string, className = 'icon'): string {
  const base = dynamicIconStrings[name]
  if (base) return base.replace('<svg', `<svg class="${className}"`)
  return ''
}

let chatOpen = false
let messages: ChatMessage[] = []
let isLoading = false
let conversations: StoredConversation[] = []
let activeConversationId: string | null = null
let archiveOpen = false

function loadConversations(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    conversations = raw ? (JSON.parse(raw) as StoredConversation[]) : []
  } catch {
    conversations = []
  }
}

function saveConversations(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  } catch {
    // stockage indisponible : on ignore
  }
}

function getActiveConversation(): StoredConversation | null {
  return conversations.find((c) => c.id === activeConversationId) ?? null
}

function persistCurrent(): void {
  const conv = getActiveConversation()
  if (conv) {
    conv.updatedAt = Date.now()
    saveConversations()
  }
}

function bindConversation(conv: StoredConversation | null): void {
  if (conv) {
    messages = conv.messages
    activeConversationId = conv.id
  } else {
    messages = []
    activeConversationId = null
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function createMessagesHtml(): string {
  if (messages.length === 0) {
    return `
      <div class="chatbot-welcome">
        <div class="chatbot-welcome-icon">
          ${iconStr('robot', 'chatbot-welcome-svg')}
        </div>
        <h3 class="chatbot-welcome-title">Assistant GEO INVEST</h3>
        <p class="chatbot-welcome-text">
          Posez vos questions sur l'investissement foncier au Maroc, l'urbanisme, la fiscalité ou le fonctionnement de la plateforme.
        </p>
        <div class="chatbot-suggestions">
          ${SUGGESTIONS.map((s) => `
            <button class="chatbot-suggestion-btn" data-suggestion="${escapeHtml(s)}">
              ${escapeHtml(s)}
            </button>
          `).join('')}
        </div>
      </div>
    `
  }

  return messages
    .map(
      (msg) => `
      <div class="chatbot-message chatbot-message--${msg.role}">
        <div class="chatbot-message-avatar chatbot-message-avatar--${msg.role}">
          ${msg.role === 'assistant' ? iconStr('robot', 'chatbot-msg-icon') : iconStr('user', 'chatbot-msg-icon')}
        </div>
        <div class="chatbot-message-content">
          <div class="chatbot-message-text">${
            msg.role === 'assistant' && !msg.content && isLoading
              ? '<span class="chatbot-typing"><span></span><span></span><span></span></span>'
              : renderMarkdown(msg.content)
          }</div>
          ${
            msg.sources && msg.sources.length > 0
              ? `<div class="chatbot-sources">
                  <span class="chatbot-sources-label">Sources :</span>
                  ${msg.sources.map((s) => `<span class="chatbot-source-tag">${escapeHtml(s.titre)}</span>`).join('')}
                </div>`
              : ''
          }
        </div>
      </div>
    `,
    )
    .join('')
}

export function ChatbotWidget(): React.JSX.Element {
  useEffect(() => {
    loadConversations()

    const toggle = document.getElementById('chatbot-toggle')
    const closeBtn = document.getElementById('chatbot-close')
    const newBtn = document.getElementById('chatbot-new')
    const archiveToggle = document.getElementById('chatbot-archive-toggle')
    const archiveList = document.getElementById('chatbot-archive-list')
    const form = document.getElementById('chatbot-form') as HTMLFormElement | null
    const input = document.getElementById('chatbot-input') as HTMLInputElement | null

    toggle?.addEventListener('click', toggleChat)
    closeBtn?.addEventListener('click', toggleChat)
    newBtn?.addEventListener('click', newChat)
    archiveToggle?.addEventListener('click', toggleArchive)

    archiveList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const openBtn = target.closest<HTMLElement>('.chatbot-archive-open')
      if (openBtn?.dataset.chatId) {
        openConversation(openBtn.dataset.chatId)
        return
      }
      const delBtn = target.closest<HTMLElement>('.chatbot-archive-delete')
      if (delBtn?.dataset.chatDel) {
        deleteConversation(delBtn.dataset.chatDel)
      }
    })

    form?.addEventListener('submit', formHandler)

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        form?.dispatchEvent(new Event('submit'))
      }
    })

    setupSuggestionListeners()

    return () => {
      toggle?.removeEventListener('click', toggleChat)
      closeBtn?.removeEventListener('click', toggleChat)
      newBtn?.removeEventListener('click', newChat)
      archiveToggle?.removeEventListener('click', toggleArchive)
      form?.removeEventListener('submit', formHandler)
    }
  }, [])

  return (
    <>
      <button className="about-chat-btn" id="chatbot-toggle" aria-label="Assistant IA">
        <span className="about-chat-icon"><Icon name="robot" /></span>
        <span className="chatbot-pulse"></span>
        <span className="chatbot-ai-badge">AI</span>
      </button>

      <div className="chatbot-panel" id="chatbot-panel" aria-hidden="true">
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <div className="chatbot-header-avatar">
              <Icon name="robot" className="chatbot-header-icon" />
            </div>
            <div>
              <h3 className="chatbot-header-title">Assistant GEO INVEST</h3>
              <span className="chatbot-header-status">En ligne</span>
            </div>
          </div>
          <div className="chatbot-header-actions">
            <button className="chatbot-header-btn" id="chatbot-new" aria-label="Nouveau chat" title="Nouveau chat">
              <Icon name="plus" className="chatbot-header-action-icon" />
            </button>
            <button className="chatbot-header-btn" id="chatbot-archive-toggle" aria-label="Historique" title="Historique">
              <Icon name="folder" className="chatbot-header-action-icon" />
            </button>
            <button className="chatbot-close-btn" id="chatbot-close" aria-label="Fermer">
              <Icon name="close" className="chatbot-close-icon" />
            </button>
          </div>
        </div>

        <div className="chatbot-archive" id="chatbot-archive" aria-hidden="true">
          <div className="chatbot-archive-head">
            <span className="chatbot-archive-title">Historique des conversations</span>
          </div>
          <div className="chatbot-archive-list" id="chatbot-archive-list"></div>
        </div>

        <div className="chatbot-messages" id="chatbot-messages"></div>

        <div className="chatbot-input-area">
          <form className="chatbot-form" id="chatbot-form">
            <input
              type="text"
              className="chatbot-input"
              id="chatbot-input"
              placeholder="Posez votre question..."
              maxLength={1000}
              autoComplete="off"
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              id="chatbot-send"
              aria-label="Envoyer"
            >
              <Icon name="send" className="chatbot-send-icon" />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

function scrollToBottom(): void {
  const container = document.getElementById('chatbot-messages')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

async function readStream(response: Response, assistantMsg: ChatMessage): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sepIdx: number
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sepIdx)
      buffer = buffer.slice(sepIdx + 2)

      const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'))
      if (!dataLine) continue
      const payload = dataLine.slice(5).trim()
      if (!payload) continue

      let data: { type?: string; text?: string; message?: string; sources?: ChatMessage['sources'] }
      try {
        data = JSON.parse(payload)
      } catch {
        continue
      }

      if (data.type === 'token' && data.text) {
        assistantMsg.content += data.text
        updateChatContent()
      } else if (data.type === 'done' && data.sources) {
        assistantMsg.sources = data.sources
      } else if (data.type === 'error') {
        assistantMsg.content = data.message || 'Désolé, une erreur est survenue.'
      }
    }
  }
}

async function sendMessage(text: string): Promise<void> {
  if (isLoading || !text.trim()) return

  closeArchive()

  const userMsg: ChatMessage = { role: 'user', content: text.trim() }
  messages.push(userMsg)
  const assistantMsg: ChatMessage = { role: 'assistant', content: '', sources: [] }
  messages.push(assistantMsg)

  if (!activeConversationId) {
    const title = text.trim().length > 42 ? `${text.trim().slice(0, 42)}…` : text.trim()
    const conv: StoredConversation = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages,
    }
    conversations.unshift(conv)
    activeConversationId = conv.id
  }
  persistCurrent()

  isLoading = true
  updateChatContent()

  const history = messages
    .slice(0, -1)
    .filter((m) => m.content)
    .map((m) => ({ role: m.role, content: m.content }))

  try {
    const response = await fetch('/api/chatbot/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim(), history }),
    })

    if (!response.ok) {
      assistantMsg.content = 'Désolé, une erreur est survenue.'
    } else {
      const contentType = response.headers.get('Content-Type') || ''
      if (contentType.includes('text/event-stream')) {
        await readStream(response, assistantMsg)
      } else {
        const data = await response.json()
        assistantMsg.content = data.response || 'Désolé, une erreur est survenue.'
        assistantMsg.sources = data.sources || []
      }
    }
  } catch {
    assistantMsg.content = 'Impossible de contacter le serveur. Vérifiez votre connexion.'
  } finally {
    isLoading = false
    persistCurrent()
    updateChatContent()
  }
}

function newChat(): void {
  if (isLoading) return
  bindConversation(null)
  closeArchive()
  updateChatContent()
}

function openConversation(id: string): void {
  if (isLoading) return
  const conv = conversations.find((c) => c.id === id)
  if (!conv) return
  bindConversation(conv)
  closeArchive()
  updateChatContent()
}

function deleteConversation(id: string): void {
  if (isLoading) return
  const deletingActive = activeConversationId === id
  conversations = conversations.filter((c) => c.id !== id)
  saveConversations()
  if (deletingActive) {
    bindConversation(null)
  }
  updateChatContent()
}

function toggleArchive(): void {
  if (isLoading) return
  archiveOpen = !archiveOpen
  const panel = document.getElementById('chatbot-panel')
  const archive = document.getElementById('chatbot-archive')
  if (panel) {
    panel.classList.toggle('chatbot-panel--archive', archiveOpen)
  }
  if (archive) {
    archive.setAttribute('aria-hidden', String(!archiveOpen))
  }
  if (archiveOpen) renderArchiveList()
}

function closeArchive(): void {
  archiveOpen = false
  const panel = document.getElementById('chatbot-panel')
  const archive = document.getElementById('chatbot-archive')
  if (panel) {
    panel.classList.remove('chatbot-panel--archive')
  }
  if (archive) {
    archive.setAttribute('aria-hidden', 'true')
  }
}

function renderArchiveList(): void {
  const list = document.getElementById('chatbot-archive-list')
  if (!list) return

  if (conversations.length === 0) {
    list.innerHTML = '<div class="chatbot-archive-empty">Aucune conversation sauvegardée pour le moment.</div>'
    return
  }

  list.innerHTML = conversations
    .map(
      (conv) => `
        <div class="chatbot-archive-item${conv.id === activeConversationId ? ' is-active' : ''}">
          <button class="chatbot-archive-open" data-chat-id="${conv.id}" title="${escapeHtml(conv.title)}">
            <span class="chatbot-archive-item-title">${escapeHtml(conv.title)}</span>
            <span class="chatbot-archive-item-meta">${formatDate(conv.updatedAt)} &middot; ${conv.messages.length} msg</span>
          </button>
          <button class="chatbot-archive-delete" data-chat-del="${conv.id}" aria-label="Supprimer" title="Supprimer">
            ${iconStr('trash', 'chatbot-archive-del-icon')}
          </button>
        </div>
      `,
    )
    .join('')
}

function updateChatContent(): void {
  const container = document.getElementById('chatbot-messages')
  if (container) {
    container.innerHTML = createMessagesHtml()
    scrollToBottom()
    setupSuggestionListeners()
  }

  const sendBtn = document.getElementById('chatbot-send') as HTMLButtonElement | null
  if (sendBtn) {
    sendBtn.disabled = isLoading
    sendBtn.innerHTML = isLoading
      ? '<span class="chatbot-spinner"></span>'
      : iconStr('send', 'chatbot-send-icon')
  }

  if (archiveOpen) renderArchiveList()
}

function toggleChat(): void {
  chatOpen = !chatOpen
  const panel = document.getElementById('chatbot-panel')
  const toggle = document.getElementById('chatbot-toggle')

  if (panel) {
    panel.classList.toggle('is-open', chatOpen)
    panel.setAttribute('aria-hidden', String(!chatOpen))
  }
  if (toggle) {
    toggle.classList.toggle('is-active', chatOpen)
  }

  if (chatOpen) {
    closeArchive()
    setTimeout(() => {
      const input = document.getElementById('chatbot-input') as HTMLInputElement | null
      input?.focus()
      scrollToBottom()
    }, 300)
  }
}

function setupSuggestionListeners(): void {
  document.querySelectorAll<HTMLButtonElement>('.chatbot-suggestion-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.suggestion
      if (text) sendMessage(text)
    })
  })
}

function formHandler(e: Event): void {
  e.preventDefault()
  const input = document.getElementById('chatbot-input') as HTMLInputElement | null
  if (input?.value.trim()) {
    sendMessage(input.value)
    input.value = ''
  }
}

import { icon } from './icons'

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
          ${icon('robot', 'chatbot-welcome-svg')}
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
          ${msg.role === 'assistant' ? icon('robot', 'chatbot-msg-icon') : icon('user', 'chatbot-msg-icon')}
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

export function ChatbotWidget(): string {
  return `
    <button class="about-chat-btn" id="chatbot-toggle" aria-label="Assistant IA">
      <span class="about-chat-icon">${icon('robot', '')}</span>
      <span class="chatbot-pulse"></span>
      <span class="chatbot-ai-badge">AI</span>
    </button>

    <div class="chatbot-panel" id="chatbot-panel" aria-hidden="true">
      <div class="chatbot-header">
        <div class="chatbot-header-info">
          <div class="chatbot-header-avatar">
            ${icon('robot', 'chatbot-header-icon')}
          </div>
          <div>
            <h3 class="chatbot-header-title">Assistant GEO INVEST</h3>
            <span class="chatbot-header-status">En ligne</span>
          </div>
        </div>
        <div class="chatbot-header-actions">
          <button class="chatbot-header-btn" id="chatbot-new" aria-label="Nouveau chat" title="Nouveau chat">
            ${icon('plus', 'chatbot-header-action-icon')}
          </button>
          <button class="chatbot-header-btn" id="chatbot-archive-toggle" aria-label="Historique" title="Historique">
            ${icon('folder', 'chatbot-header-action-icon')}
          </button>
          <button class="chatbot-close-btn" id="chatbot-close" aria-label="Fermer">
            ${icon('close', 'chatbot-close-icon')}
          </button>
        </div>
      </div>

      <div class="chatbot-archive" id="chatbot-archive" aria-hidden="true">
        <div class="chatbot-archive-head">
          <span class="chatbot-archive-title">Historique des conversations</span>
        </div>
        <div class="chatbot-archive-list" id="chatbot-archive-list"></div>
      </div>

      <div class="chatbot-messages" id="chatbot-messages">
        ${createMessagesHtml()}
      </div>

      <div class="chatbot-input-area">
        <form class="chatbot-form" id="chatbot-form">
          <input
            type="text"
            class="chatbot-input"
            id="chatbot-input"
            placeholder="Posez votre question..."
            maxlength="1000"
            autocomplete="off"
          />
          <button
            type="submit"
            class="chatbot-send-btn"
            id="chatbot-send"
            aria-label="Envoyer"
            ${isLoading ? 'disabled' : ''}
          >
            ${isLoading ? '<span class="chatbot-spinner"></span>' : icon('send', 'chatbot-send-icon')}
          </button>
        </form>
      </div>
    </div>
  `
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
            ${icon('trash', 'chatbot-archive-del-icon')}
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
      : icon('send', 'chatbot-send-icon')
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

export function setupChatbot(): void {
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

  form?.addEventListener('submit', (e) => {
    e.preventDefault()
    if (input?.value.trim()) {
      sendMessage(input.value)
      input.value = ''
    }
  })

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      form?.dispatchEvent(new Event('submit'))
    }
  })

  setupSuggestionListeners()
}

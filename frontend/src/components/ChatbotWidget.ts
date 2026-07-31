import { icon } from './icons'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ titre: string; categorie: string; score: number }>
}

const SUGGESTIONS = [
  'Qu\'est-ce que GEO INVEST ?',
  'Comment fonctionne le classement multicritères ?',
  'Quels sont les frais d\'un achat immobilier au Maroc ?',
  'Qu\'est-ce qu\'un titre foncier ?',
]

let chatOpen = false
let messages: ChatMessage[] = []
let isLoading = false

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
          <div class="chatbot-message-text">${renderMarkdown(msg.content)}</div>
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
        <button class="chatbot-close-btn" id="chatbot-close" aria-label="Fermer">
          ${icon('close', 'chatbot-close-icon')}
        </button>
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

async function sendMessage(text: string): Promise<void> {
  if (isLoading || !text.trim()) return

  messages.push({ role: 'user', content: text.trim() })
  isLoading = true
  updateChatContent()

  try {
    const response = await fetch('/api/chatbot/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() }),
    })

    const data = await response.json()

    messages.push({
      role: 'assistant',
      content: data.response || 'Désolé, une erreur est survenue.',
      sources: data.sources || [],
    })
  } catch {
    messages.push({
      role: 'assistant',
      content: 'Impossible de contacter le serveur. Vérifiez votre connexion.',
    })
  } finally {
    isLoading = false
    updateChatContent()
  }
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
  const toggle = document.getElementById('chatbot-toggle')
  const closeBtn = document.getElementById('chatbot-close')
  const form = document.getElementById('chatbot-form') as HTMLFormElement | null
  const input = document.getElementById('chatbot-input') as HTMLInputElement | null

  toggle?.addEventListener('click', toggleChat)
  closeBtn?.addEventListener('click', toggleChat)

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

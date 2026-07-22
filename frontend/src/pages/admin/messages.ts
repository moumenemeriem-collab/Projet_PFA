import { icons } from '../../components/icons.ts'
import { renderAdminLayout, setupAdminLayout } from '../../components/layout/AdminLayout.ts'
import { formatApiErrors, getStoredUser } from '../../api/auth.ts'
import {
  createReponse,
  deleteMessage,
  fetchAdminMessages,
  fetchMessage,
  formatDate,
  formatDateTime,
  getFullName,
  getInitials,
  marquerMessageLu,
  updateMessage,
  type Message,
  type Reponse,
} from '../../api/messagerie.ts'

interface AdminMessagesState {
  messages: Message[]
  search: string
  statut: '' | 'lu' | 'non_lu'
  selectedId: number | null
  selectedMessage: Message | null
  view: 'list' | 'detail'
  nonLus: number
  total: number
  showEditModal: boolean
}

const stateRef: { current: AdminMessagesState | null } = { current: null }
let searchTimer: ReturnType<typeof setTimeout> | null = null
let pageRoot: HTMLElement | null = null

function renderMessageRow(msg: Message): string {
  return `
    <div class="msg-item${!msg.est_lu ? ' msg-item--unread' : ''}" data-msg-id="${msg.id}">
      <div class="msg-item-avatar">
        <span class="msg-avatar-circle">${getInitials(msg.expediteur)}</span>
      </div>
      <div class="msg-item-body">
        <div class="msg-item-header">
          <span class="msg-item-sujet">${msg.sujet}</span>
          <span class="msg-item-date">${formatDate(msg.date_creation)}</span>
        </div>
        <div class="msg-item-sender">
          ${getFullName(msg.expediteur)} &middot; ${msg.expediteur.email}
        </div>
        <div class="msg-item-preview">
          ${msg.contenu.substring(0, 80)}...
        </div>
        <div class="msg-item-meta">
          ${!msg.est_lu ? '<span class="msg-unread-dot"></span><span class="msg-unread-label">Non lu</span>' : ''}
          ${msg.nb_reponses !== undefined ? `<span class="msg-reply-count">${msg.nb_reponses} réponse${msg.nb_reponses > 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
    </div>
  `
}

function renderDetail(msg: Message): string {
  const reponses = msg.reponses ?? []
  return `
    <div class="msg-detail">
      <div class="msg-detail-header">
        <button type="button" class="msg-back-btn" id="msg-back-btn">${icons.chevronLeft} Retour à la liste</button>
        <div class="msg-detail-actions">
          <button type="button" class="msg-action-btn msg-action-btn--edit" data-action="edit" data-msg-id="${msg.id}">${icons.edit} Modifier</button>
          <button type="button" class="msg-action-btn msg-action-btn--delete" data-action="delete" data-msg-id="${msg.id}">${icons.trash} Supprimer</button>
        </div>
      </div>
      <div id="detail-alert" class="contact-alert" hidden></div>
      <div class="msg-detail-subject">
        <h2>${msg.sujet}</h2>
        <span class="msg-detail-date">${formatDateTime(msg.date_creation)}</span>
      </div>
      <div class="msg-detail-message">
        <div class="msg-detail-author">
          <span class="msg-avatar-circle msg-avatar-circle--sm">${getInitials(msg.expediteur)}</span>
          <div>
            <span class="msg-author-name">${getFullName(msg.expediteur)}</span>
            <span class="msg-author-email">${msg.expediteur.email}</span>
            ${msg.expediteur.telephone ? `<span class="msg-author-phone">Tel: ${msg.expediteur.telephone}</span>` : ''}
          </div>
        </div>
        <div class="msg-detail-content">${msg.contenu}</div>
      </div>
      ${reponses.length > 0 ? `
        <div class="msg-replies">
          <h3 class="msg-replies-title">${icons.reply} Réponses (${reponses.length})</h3>
          ${reponses.map((r: Reponse) => `
            <div class="msg-reply">
              <div class="msg-reply-header">
                <div class="msg-detail-author">
                  <span class="msg-avatar-circle msg-avatar-circle--sm msg-avatar-circle--admin">${getInitials(r.auteur)}</span>
                  <div>
                    <span class="msg-author-name">${getFullName(r.auteur)}</span>
                    <span class="msg-author-email">${r.auteur.email}</span>
                  </div>
                </div>
                <span class="msg-reply-date">${formatDateTime(r.date_creation)}</span>
              </div>
              <div class="msg-reply-content">${r.contenu}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="msg-reply-form">
        <h3 class="msg-reply-form-title">Répondre à ${getFullName(msg.expediteur)}</h3>
        <div id="reply-alert" class="contact-alert" hidden></div>
        <form id="reply-form" novalidate>
          <textarea id="reply-contenu" class="contact-input contact-textarea" rows="4" placeholder="Tapez votre réponse..." required></textarea>
          <button type="submit" class="btn btn-primary" id="reply-submit-btn">
            <span class="contact-submit-icon">${icons.send}</span> Envoyer la réponse
          </button>
        </form>
      </div>
    </div>
  `
}

function renderEditModal(msg: Message): string {
  return `
    <div class="admin-modal-overlay" id="edit-msg-modal">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h3>Modifier le message</h3>
          <button type="button" class="admin-modal-close" id="edit-modal-close" aria-label="Fermer">${icons.close}</button>
        </div>
        <form id="edit-msg-form" class="admin-modal-form" novalidate>
          <div id="edit-msg-error" class="form-alert form-alert--error" hidden></div>
          <div class="form-field">
            <label for="edit-msg-sujet" class="form-label">Sujet</label>
            <input id="edit-msg-sujet" name="sujet" class="modal-input" value="${msg.sujet.replace(/"/g, '&quot;')}" required />
          </div>
          <div class="form-field">
            <label for="edit-msg-contenu" class="form-label">Message</label>
            <textarea id="edit-msg-contenu" name="contenu" class="modal-input" rows="6" required style="resize:vertical;min-height:120px">${msg.contenu}</textarea>
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="btn btn-outline" id="edit-modal-cancel">Annuler</button>
            <button type="submit" class="btn btn-primary" id="edit-modal-submit">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  `
}

function renderContent(state: AdminMessagesState): string {
  let viewHtml = ''

  if (state.view === 'detail' && state.selectedMessage) {
    viewHtml = renderDetail(state.selectedMessage)
  } else {
    viewHtml = `
      <div class="msg-page">
        <div class="msg-page-header">
          <div>
            <h2 class="msg-page-title">Messagerie</h2>
            <p class="msg-page-desc">Gérez les messages des investisseurs</p>
          </div>
          <div class="msg-stats-row">
            <div class="msg-stat-card">
              <span class="msg-stat-value">${state.total}</span>
              <span class="msg-stat-label">Total</span>
            </div>
            <div class="msg-stat-card msg-stat-card--unread">
              <span class="msg-stat-value">${state.nonLus}</span>
              <span class="msg-stat-label">Non lus</span>
            </div>
          </div>
        </div>
        <div id="page-alert" class="contact-alert" hidden></div>
        <div id="page-error" class="contact-alert contact-alert--error" hidden></div>
        <div class="msg-toolbar">
          <div class="msg-search-field">
            ${icons.search}
            <input type="search" id="msg-search" class="msg-search-input" placeholder="Rechercher par nom, email, sujet..." value="${state.search}" />
          </div>
          <select id="msg-statut-filter" class="toolbar-select">
            <option value="" ${state.statut === '' ? 'selected' : ''}>Tous</option>
            <option value="non_lu" ${state.statut === 'non_lu' ? 'selected' : ''}>Non lus</option>
            <option value="lu" ${state.statut === 'lu' ? 'selected' : ''}>Lus</option>
          </select>
        </div>
        <div class="msg-list">
          ${state.messages.length > 0
            ? state.messages.map(m => renderMessageRow(m)).join('')
            : '<div class="msg-empty"><p>Aucun message trouvé.</p></div>'}
        </div>
      </div>
    `
  }

  const modalHtml = state.showEditModal && state.selectedMessage ? renderEditModal(state.selectedMessage) : ''
  return viewHtml + modalHtml
}

function showPageAlert(id: string, message: string, isError = false): void {
  if (!pageRoot) return
  const el = pageRoot.querySelector<HTMLElement>(`#${id}`)
  if (!el) return
  el.textContent = message
  el.className = `contact-alert ${isError ? 'contact-alert--error' : 'contact-alert--success'}`
  el.hidden = false
  setTimeout(() => { el.hidden = true }, 5000)
}

function renderPage(state: AdminMessagesState): void {
  if (!pageRoot) return
  stateRef.current = state
  const contentRoot = pageRoot.querySelector('.admin-content')
  if (!contentRoot) return
  contentRoot.innerHTML = renderContent(state)
  bindEvents()
}

function bindEvents(): void {
  if (!pageRoot || !stateRef.current) return

  pageRoot.querySelector('#msg-back-btn')?.addEventListener('click', () => {
    renderPage({ ...stateRef.current!, view: 'list', selectedMessage: null, selectedId: null, showEditModal: false })
  })

  pageRoot.querySelectorAll('.msg-item').forEach(el => {
    el.addEventListener('click', async () => {
      const id = Number((el as HTMLElement).dataset.msgId)
      try {
        const msg = await fetchMessage(id)
        if (!msg.est_lu) {
          await marquerMessageLu(id)
          msg.est_lu = true
        }
        renderPage({ ...stateRef.current!, view: 'detail', selectedMessage: msg, selectedId: id, showEditModal: false })
      } catch (error) {
        showPageAlert('page-error', formatApiErrors(error), true)
      }
    })
  })

  pageRoot.querySelector<HTMLInputElement>('#msg-search')?.addEventListener('input', (e) => {
    const search = (e.target as HTMLInputElement).value
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(async () => {
      if (!stateRef.current) return
      try {
        const data = await fetchAdminMessages(search, stateRef.current.statut)
        renderPage({ ...stateRef.current, search, messages: data.results, nonLus: data.non_lus, total: data.total })
      } catch (error) {
        showPageAlert('page-error', formatApiErrors(error), true)
      }
    }, 300)
  })

  pageRoot.querySelector<HTMLSelectElement>('#msg-statut-filter')?.addEventListener('change', async (e) => {
    const statut = (e.target as HTMLSelectElement).value as AdminMessagesState['statut']
    if (!stateRef.current) return
    try {
      const data = await fetchAdminMessages(stateRef.current.search, statut)
      renderPage({ ...stateRef.current, statut, messages: data.results, nonLus: data.non_lus, total: data.total })
    } catch (error) {
      showPageAlert('page-error', formatApiErrors(error), true)
    }
  })

  pageRoot.querySelector('#reply-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const contenu = String(pageRoot!.querySelector<HTMLInputElement>('#reply-contenu')?.value ?? '').trim()
    const submitBtn = pageRoot!.querySelector<HTMLButtonElement>('#reply-submit-btn')
    if (!contenu || !submitBtn || !stateRef.current?.selectedMessage) return

    submitBtn.disabled = true
    try {
      await createReponse(stateRef.current.selectedMessage.id, contenu)
      const msg = await fetchMessage(stateRef.current.selectedMessage.id)
      renderPage({ ...stateRef.current, selectedMessage: msg, showEditModal: false })
      showPageAlert('reply-alert', 'Réponse envoyée avec succès.')
    } catch (error) {
      showPageAlert('reply-alert', formatApiErrors(error), true)
    } finally {
      submitBtn.disabled = false
    }
  })

  pageRoot.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!stateRef.current?.selectedMessage) return
      renderPage({ ...stateRef.current, showEditModal: true })
    })
  })

  pageRoot.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number((btn as HTMLElement).dataset.msgId)
      if (!confirm('Supprimer ce message ? Cette action est irréversible.')) return
      try {
        await deleteMessage(id)
        const data = await fetchAdminMessages(stateRef.current?.search, stateRef.current?.statut)
        renderPage({ ...stateRef.current!, view: 'list', messages: data.results, selectedMessage: null, selectedId: null, showEditModal: false, nonLus: data.non_lus, total: data.total })
        showPageAlert('page-alert', 'Message supprimé avec succès.')
      } catch (error) {
        showPageAlert('page-error', formatApiErrors(error), true)
      }
    })
  })

  const editModal = pageRoot.querySelector<HTMLElement>('#edit-msg-modal')
  if (editModal) {
    const closeModal = () => {
      if (stateRef.current) renderPage({ ...stateRef.current, showEditModal: false })
    }

    editModal.querySelector('#edit-modal-close')?.addEventListener('click', closeModal)
    editModal.querySelector('#edit-modal-cancel')?.addEventListener('click', closeModal)
    editModal.addEventListener('click', (e) => { if (e.target === editModal) closeModal() })

    editModal.querySelector('#edit-msg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const msg = stateRef.current?.selectedMessage
      if (!msg) return
      const errorEl = editModal.querySelector<HTMLElement>('#edit-msg-error')
      const submitBtn = editModal.querySelector<HTMLButtonElement>('#edit-modal-submit')
      if (errorEl) errorEl.hidden = true
      if (submitBtn) submitBtn.disabled = true

      const sujet = String(editModal.querySelector<HTMLInputElement>('#edit-msg-sujet')?.value ?? '').trim()
      const contenu = String(editModal.querySelector<HTMLTextAreaElement>('#edit-msg-contenu')?.value ?? '').trim()

      if (!sujet || !contenu) {
        if (errorEl) {
          errorEl.textContent = 'Tous les champs sont obligatoires.'
          errorEl.hidden = false
        }
        if (submitBtn) submitBtn.disabled = false
        return
      }

      try {
        await updateMessage(msg.id, { sujet, contenu })
        const updated = await fetchMessage(msg.id)
        renderPage({ ...stateRef.current!, showEditModal: false, selectedMessage: updated })
        showPageAlert('page-alert', 'Message modifié avec succès.')
      } catch (error) {
        if (errorEl) {
          errorEl.textContent = formatApiErrors(error)
          errorEl.hidden = false
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false
      }
    })
  }
}

export async function mountAdminMessagesPage(root: HTMLElement): Promise<void> {
  pageRoot = root
  const storedUser = getStoredUser()
  if (!storedUser) return

  root.innerHTML = renderAdminLayout({
    user: storedUser,
    activePage: 'messages',
    content: `<div class="admin-loading"><div class="admin-loading-spinner"></div><p>Chargement des messages…</p></div>`,
  })
  setupAdminLayout(root)

  try {
    const data = await fetchAdminMessages()
    renderPage({
      messages: data.results, search: '', statut: '',
      selectedId: null, selectedMessage: null, view: 'list',
      nonLus: data.non_lus, total: data.total, showEditModal: false,
    })
  } catch (error) {
    root.querySelector('.admin-content')!.innerHTML = `
      <div class="admin-error-state">
        <p>${formatApiErrors(error)}</p>
        <a href="/login" class="btn btn-primary">Se reconnecter</a>
      </div>
    `
  }
}

import { icons } from '../components/icons.ts'
import { renderAppLayout, setupAppLayout } from '../components/layout/AppLayout.ts'
import { formatApiErrors, getStoredUser } from '../api/auth.ts'
import {
  createMessage,
  createReponse,
  deleteMessage,
  deleteReponse,
  fetchMessage,
  fetchMessages,
  fetchNotifications,
  formatDate,
  formatDateTime,
  getFullName,
  getInitials,
  updateMessage,
  updateReponse,
  type Message,
  type Reponse,
} from '../api/messagerie.ts'
import { t } from '../i18n/index'

interface MessagesPageState {
  messages: Message[]
  search: string
  statut: '' | 'lu' | 'non_lu'
  selectedId: number | null
  selectedMessage: Message | null
  view: 'list' | 'detail' | 'compose'
  loading: boolean
  showEditModal: boolean
  currentPage: number
  totalCount: number
  currentUserId: number
  editingReponse: Reponse | null
}

const PAGE_SIZE = 6
const stateRef: { current: MessagesPageState | null } = { current: null }
let searchTimer: ReturnType<typeof setTimeout> | null = null
let pageRoot: HTMLElement | null = null

function renderMessageRow(msg: Message): string {
  const lastReply = msg.derniere_reponse
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
        <div class="msg-item-preview">
          ${lastReply
            ? `<span class="msg-reply-badge">${t('messages.admin_reply_badge')}</span> ${lastReply.contenu.substring(0, 60)}...`
            : msg.contenu.substring(0, 80) + '...'}
        </div>
        <div class="msg-item-meta">
          ${!msg.est_lu ? '<span class="msg-unread-dot"></span>' : ''}
          ${msg.nb_reponses !== undefined ? `<span class="msg-reply-count">${t('messages.reply_count').replace('{{count}}', String(msg.nb_reponses))}</span>` : ''}
        </div>
      </div>
      <div class="msg-item-actions">
        <button type="button" class="table-action-btn" data-action="list-edit" data-msg-id="${msg.id}" title="${t('messages.edit')}">${icons.edit}</button>
        <button type="button" class="table-action-btn table-action-btn--danger" data-action="list-delete" data-msg-id="${msg.id}" title="${t('messages.delete')}">${icons.trash}</button>
      </div>
    </div>
  `
}

function renderPagination(state: MessagesPageState): string {
  const totalPages = Math.max(1, Math.ceil(state.totalCount / PAGE_SIZE))
  const start = (state.currentPage - 1) * PAGE_SIZE + 1
  const end = Math.min(state.currentPage * PAGE_SIZE, state.totalCount)

  if (state.totalCount === 0) return ''

  let pagesHtml = ''
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7) {
      if (i === 1 || i === totalPages || (i >= state.currentPage - 1 && i <= state.currentPage + 1)) {
        pagesHtml += `<button type="button" class="pagination-btn pagination-btn--page${i === state.currentPage ? ' pagination-btn--active' : ''}" data-page="${i}">${i}</button>`
      } else if (i === state.currentPage - 2 || i === state.currentPage + 2) {
        pagesHtml += '<span class="pagination-ellipsis">...</span>'
      }
    } else {
      pagesHtml += `<button type="button" class="pagination-btn pagination-btn--page${i === state.currentPage ? ' pagination-btn--active' : ''}" data-page="${i}">${i}</button>`
    }
  }

  return `
    <div class="users-pagination">
      <span class="pagination-info">${t('messages.pagination_showing')} ${start}-${end} ${t('messages.pagination_on')} ${state.totalCount} ${t('messages.pagination_results')}</span>
      <div class="users-pagination-controls">
        <button type="button" class="pagination-btn" data-page="prev" ${state.currentPage <= 1 ? 'disabled' : ''}>${icons.chevronLeft} ${t('messages.pagination_prev')}</button>
        ${pagesHtml}
        <button type="button" class="pagination-btn" data-page="next" ${state.currentPage >= totalPages ? 'disabled' : ''}>${t('messages.pagination_next')} ${icons.chevron}</button>
      </div>
    </div>
  `
}

function renderDetail(msg: Message, state: MessagesPageState): string {
  const reponses = msg.reponses ?? []
  return `
    <div class="msg-detail">
      <div class="msg-detail-header">
        <button type="button" class="msg-back-btn" id="msg-back-btn">${icons.chevronLeft} ${t('messages.back')}</button>
        <div class="msg-detail-actions">
          <button type="button" class="msg-action-btn msg-action-btn--edit" data-action="edit" data-msg-id="${msg.id}">${icons.edit} ${t('messages.edit')}</button>
          <button type="button" class="msg-action-btn msg-action-btn--delete" data-action="delete" data-msg-id="${msg.id}">${icons.trash} ${t('messages.delete')}</button>
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
          </div>
        </div>
        <div class="msg-detail-content">${msg.contenu}</div>
      </div>
      ${reponses.length > 0 ? `
        <div class="msg-replies">
          <h3 class="msg-replies-title">${icons.reply} ${t('messages.replies_title')} (${reponses.length})</h3>
          ${reponses.map((r: Reponse) => {
            const isOwn = r.auteur.id === state.currentUserId
            return `
              <div class="msg-reply ${isOwn ? 'msg-reply--own' : 'msg-reply--other'}">
                <div class="msg-reply-header">
                  <div class="msg-detail-author">
                    <span class="msg-avatar-circle msg-avatar-circle--sm ${isOwn ? '' : 'msg-avatar-circle--admin'}">${getInitials(r.auteur)}</span>
                    <div>
                      <span class="msg-author-name">${getFullName(r.auteur)}</span>
                      <span class="msg-author-email">${r.auteur.email}</span>
                    </div>
                  </div>
                  <div class="msg-reply-header-right">
                    <span class="msg-reply-date">${formatDateTime(r.date_creation)}</span>
                    ${isOwn ? `
                      <div class="msg-reply-actions">
                        <button type="button" class="table-action-btn" data-action="reply-edit" data-reply-id="${r.id}" title="${t('messages.edit')}">${icons.edit}</button>
                        <button type="button" class="table-action-btn table-action-btn--danger" data-action="reply-delete" data-reply-id="${r.id}" title="${t('messages.delete')}">${icons.trash}</button>
                      </div>
                    ` : ''}
                  </div>
                </div>
                <div class="msg-reply-content">${r.contenu}</div>
              </div>
            `
          }).join('')}
        </div>
      ` : `
        <div class="msg-no-replies">
          <p>${t('messages.no_replies')}</p>
        </div>
      `}
      <div class="msg-reply-form">
        <h3 class="msg-reply-form-title">${t('messages.add_reply')}</h3>
        <div id="reply-alert" class="contact-alert" hidden></div>
        <form id="reply-form" novalidate>
          <textarea id="reply-contenu" class="contact-input contact-textarea" rows="3" placeholder="${t('messages.reply_placeholder')}" required></textarea>
          <button type="submit" class="btn btn-primary btn-sm" id="reply-submit-btn">
            <span class="contact-submit-icon">${icons.send}</span> ${t('messages.send')}
          </button>
        </form>
      </div>
    </div>
  `
}

function renderCompose(): string {
  return `
    <div class="msg-compose">
      <div class="msg-detail-header">
        <button type="button" class="msg-back-btn" id="msg-back-btn">${icons.chevronLeft} ${t('messages.back')}</button>
      </div>
      <h2 class="msg-compose-title">${t('messages.compose_title')}</h2>
      <p class="msg-compose-desc">${t('messages.compose_desc')}</p>
      <div id="compose-alert" class="contact-alert" hidden></div>
      <form id="compose-form" novalidate>
        <div class="contact-form-field">
          <label for="compose-sujet" class="contact-label">${t('messages.subject')}</label>
          <input id="compose-sujet" name="sujet" type="text" class="contact-input" placeholder="${t('messages.compose_placeholder_subject')}" required />
        </div>
        <div class="contact-form-field">
          <label for="compose-contenu" class="contact-label">${t('messages.content')}</label>
          <textarea id="compose-contenu" name="contenu" class="contact-input contact-textarea" rows="6" placeholder="${t('messages.compose_placeholder_content')}" required></textarea>
        </div>
        <button type="submit" class="btn btn-primary" id="compose-submit-btn">
          <span class="contact-submit-icon">${icons.send}</span> ${t('messages.compose_submit')}
        </button>
      </form>
    </div>
  `
}

function renderEditModal(msg: Message): string {
  return `
    <div class="admin-modal-overlay" id="edit-msg-modal">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h3>${t('messages.edit_message')}</h3>
          <button type="button" class="admin-modal-close" id="edit-modal-close" aria-label="${t('common.close')}">${icons.close}</button>
        </div>
        <form id="edit-msg-form" class="admin-modal-form" novalidate>
          <div id="edit-msg-error" class="form-alert form-alert--error" hidden></div>
          <div class="form-field">
            <label for="edit-msg-sujet" class="form-label">${t('messages.subject')}</label>
            <input id="edit-msg-sujet" name="sujet" class="modal-input" value="${msg.sujet.replace(/"/g, '&quot;')}" required />
          </div>
          <div class="form-field">
            <label for="edit-msg-contenu" class="form-label">${t('messages.content')}</label>
            <textarea id="edit-msg-contenu" name="contenu" class="modal-input" rows="6" required style="resize:vertical;min-height:120px">${msg.contenu}</textarea>
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="btn btn-outline" id="edit-modal-cancel">${t('messages.cancel')}</button>
            <button type="submit" class="btn btn-primary" id="edit-modal-submit">${t('messages.save')}</button>
          </div>
        </form>
      </div>
    </div>
  `
}

function renderReplyEditModal(rep: Reponse): string {
  return `
    <div class="admin-modal-overlay" id="edit-reply-modal">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h3>${t('messages.edit_reply')}</h3>
          <button type="button" class="admin-modal-close" id="edit-reply-modal-close" aria-label="${t('common.close')}">${icons.close}</button>
        </div>
        <form id="edit-reply-form" class="admin-modal-form" novalidate>
          <div id="edit-reply-error" class="form-alert form-alert--error" hidden></div>
          <div class="form-field">
            <label for="edit-reply-contenu" class="form-label">${t('messages.reply_label')}</label>
            <textarea id="edit-reply-contenu" name="contenu" class="modal-input" rows="6" required style="resize:vertical;min-height:120px">${rep.contenu}</textarea>
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="btn btn-outline" id="edit-reply-cancel">${t('messages.cancel')}</button>
            <button type="submit" class="btn btn-primary" id="edit-reply-submit">${t('messages.save')}</button>
          </div>
        </form>
      </div>
    </div>
  `
}

function renderContent(state: MessagesPageState): string {
  let viewHtml = ''

  if (state.view === 'compose') {
    viewHtml = renderCompose()
  } else if (state.view === 'detail' && state.selectedMessage) {
    viewHtml = renderDetail(state.selectedMessage, state)
  } else {
    viewHtml = `
      <div class="msg-page">
        <div class="msg-page-header">
          <div>
            <h2 class="msg-page-title">${t('messages.title')}</h2>
            <p class="msg-page-desc">${t('messages.investor_desc')}</p>
          </div>
          <button type="button" class="btn btn-primary btn-action" id="compose-btn">
            ${icons.plus} ${t('messages.new_message')}
          </button>
        </div>
        <div id="page-alert" class="contact-alert" hidden></div>
        <div id="page-error" class="contact-alert contact-alert--error" hidden></div>
        <div class="msg-toolbar">
          <div class="msg-search-field">
            ${icons.search}
            <input type="search" id="msg-search" class="msg-search-input" placeholder="${t('messages.search_placeholder')}" value="${state.search}" />
          </div>
          <select id="msg-statut-filter" class="toolbar-select">
            <option value="" ${state.statut === '' ? 'selected' : ''}>${t('messages.all')}</option>
            <option value="non_lu" ${state.statut === 'non_lu' ? 'selected' : ''}>${t('messages.unread')}</option>
            <option value="lu" ${state.statut === 'lu' ? 'selected' : ''}>${t('messages.read')}</option>
          </select>
        </div>
        <div class="msg-list">
          ${state.messages.length > 0
            ? state.messages.map(m => renderMessageRow(m)).join('')
            : `<div class="msg-empty"><p>${t('messages.empty')}</p></div>`}
        </div>
        ${renderPagination(state)}
      </div>
    `
  }

  const modalHtml = state.showEditModal && state.selectedMessage ? renderEditModal(state.selectedMessage) : ''
  const replyModalHtml = state.editingReponse ? renderReplyEditModal(state.editingReponse) : ''
  return viewHtml + modalHtml + replyModalHtml
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

function renderPage(state: MessagesPageState): void {
  if (!pageRoot) return
  stateRef.current = state
  const contentRoot = pageRoot.querySelector('.app-content')
  if (!contentRoot) return
  contentRoot.innerHTML = renderContent(state)
  bindEvents()
}

async function loadPage(page: number, extra?: Partial<MessagesPageState>): Promise<void> {
  if (!stateRef.current) return
  try {
    const data = await fetchMessages(stateRef.current.search, stateRef.current.statut, page)
    renderPage({
      ...stateRef.current,
      ...extra,
      messages: data.results,
      currentPage: page,
      totalCount: data.count,
    })
  } catch (error) {
    showPageAlert('page-error', formatApiErrors(error), true)
  }
}

function bindEvents(): void {
  if (!pageRoot || !stateRef.current) return

  pageRoot.querySelector('#compose-btn')?.addEventListener('click', () => {
    renderPage({ ...stateRef.current!, view: 'compose', selectedMessage: null, selectedId: null, showEditModal: false })
  })

  pageRoot.querySelector('#msg-back-btn')?.addEventListener('click', () => {
    loadPage(stateRef.current!.currentPage, { view: 'list', selectedMessage: null, selectedId: null, showEditModal: false })
  })

  pageRoot.querySelectorAll('.msg-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-action]')) return
      const id = Number((el as HTMLElement).dataset.msgId)
      try {
        const msg = await fetchMessage(id)
        renderPage({ ...stateRef.current!, view: 'detail', selectedMessage: msg, selectedId: id, showEditModal: false })
      } catch (error) {
        showPageAlert('page-error', formatApiErrors(error), true)
      }
    })
  })

  pageRoot.querySelectorAll('[data-action="list-edit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = Number((btn as HTMLElement).dataset.msgId)
      try {
        const msg = await fetchMessage(id)
        renderPage({ ...stateRef.current!, view: 'detail', selectedMessage: msg, selectedId: id, showEditModal: true })
      } catch (error) {
        showPageAlert('page-error', formatApiErrors(error), true)
      }
    })
  })

  pageRoot.querySelectorAll('[data-action="list-delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = Number((btn as HTMLElement).dataset.msgId)
      if (!confirm(t('messages.confirm_delete_message'))) return
      try {
        await deleteMessage(id)
        await loadPage(stateRef.current!.currentPage)
        showPageAlert('page-alert', t('messages.message_deleted'))
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
        const data = await fetchMessages(search, stateRef.current.statut)
        renderPage({ ...stateRef.current, search, messages: data.results, currentPage: 1, totalCount: data.count })
      } catch (error) {
        showPageAlert('page-error', formatApiErrors(error), true)
      }
    }, 300)
  })

  pageRoot.querySelector<HTMLSelectElement>('#msg-statut-filter')?.addEventListener('change', async (e) => {
    const statut = (e.target as HTMLSelectElement).value as MessagesPageState['statut']
    if (!stateRef.current) return
    try {
      const data = await fetchMessages(stateRef.current.search, statut)
      renderPage({ ...stateRef.current, statut, messages: data.results, currentPage: 1, totalCount: data.count })
    } catch (error) {
      showPageAlert('page-error', formatApiErrors(error), true)
    }
  })

  pageRoot.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = (btn as HTMLElement).dataset.page
      if (!val || !stateRef.current) return
      let newPage = stateRef.current.currentPage
      if (val === 'prev') newPage = Math.max(1, stateRef.current.currentPage - 1)
      else if (val === 'next') newPage = stateRef.current.currentPage + 1
      else newPage = Number(val)
      loadPage(newPage)
    })
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
      renderPage({ ...stateRef.current, selectedMessage: msg, showEditModal: false, editingReponse: null })
      showPageAlert('reply-alert', t('messages.reply_sent'))
    } catch (error) {
      showPageAlert('reply-alert', formatApiErrors(error), true)
    } finally {
      submitBtn.disabled = false
    }
  })

  pageRoot.querySelectorAll('[data-action="reply-edit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const replyId = Number((btn as HTMLElement).dataset.replyId)
      const msg = stateRef.current?.selectedMessage
      if (!msg) return
      const rep = (msg.reponses ?? []).find((r: Reponse) => r.id === replyId)
      if (rep) renderPage({ ...stateRef.current!, editingReponse: rep })
    })
  })

  pageRoot.querySelectorAll('[data-action="reply-delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const replyId = Number((btn as HTMLElement).dataset.replyId)
      if (!confirm(t('messages.confirm_delete_reply'))) return
      try {
        await deleteReponse(replyId)
        const msg = await fetchMessage(stateRef.current!.selectedMessage!.id)
        renderPage({ ...stateRef.current!, selectedMessage: msg, editingReponse: null })
        showPageAlert('detail-alert', t('messages.reply_deleted'))
      } catch (error) {
        showPageAlert('detail-alert', formatApiErrors(error), true)
      }
    })
  })

  const replyModal = pageRoot.querySelector<HTMLElement>('#edit-reply-modal')
  if (replyModal) {
    const closeReplyModal = () => {
      if (stateRef.current) renderPage({ ...stateRef.current, editingReponse: null })
    }

    replyModal.querySelector('#edit-reply-modal-close')?.addEventListener('click', closeReplyModal)
    replyModal.querySelector('#edit-reply-cancel')?.addEventListener('click', closeReplyModal)
    replyModal.addEventListener('click', (e) => { if (e.target === replyModal) closeReplyModal() })

    replyModal.querySelector('#edit-reply-form')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const rep = stateRef.current?.editingReponse
      if (!rep) return
      const errorEl = replyModal.querySelector<HTMLElement>('#edit-reply-error')
      const submitBtn = replyModal.querySelector<HTMLButtonElement>('#edit-reply-submit')
      if (errorEl) errorEl.hidden = true
      if (submitBtn) submitBtn.disabled = true

      const contenu = String(replyModal.querySelector<HTMLTextAreaElement>('#edit-reply-contenu')?.value ?? '').trim()

      if (!contenu) {
        if (errorEl) {
          errorEl.textContent = t('common.validation_content_required')
          errorEl.hidden = false
        }
        if (submitBtn) submitBtn.disabled = false
        return
      }

      try {
        await updateReponse(rep.id, { contenu })
        const msg = await fetchMessage(stateRef.current!.selectedMessage!.id)
        renderPage({ ...stateRef.current!, selectedMessage: msg, editingReponse: null })
        showPageAlert('detail-alert', t('messages.reply_edited'))
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

  pageRoot.querySelector('#compose-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const sujet = String(pageRoot!.querySelector<HTMLInputElement>('#compose-sujet')?.value ?? '').trim()
    const contenu = String(pageRoot!.querySelector<HTMLInputElement>('#compose-contenu')?.value ?? '').trim()
    const submitBtn = pageRoot!.querySelector<HTMLButtonElement>('#compose-submit-btn')
    if (!sujet || !contenu || !submitBtn) return

    submitBtn.disabled = true
    try {
      await createMessage({ sujet, contenu })
      await loadPage(1, { view: 'list', selectedMessage: null, selectedId: null, showEditModal: false })
      showPageAlert('page-alert', t('messages.message_sent'))
    } catch (error) {
      showPageAlert('compose-alert', formatApiErrors(error), true)
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
      if (!confirm(t('messages.confirm_delete_message'))) return
      try {
        await deleteMessage(id)
        await loadPage(stateRef.current!.currentPage, { view: 'list', selectedMessage: null, selectedId: null, showEditModal: false })
        showPageAlert('page-alert', t('messages.message_deleted'))
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
          errorEl.textContent = t('common.validation_all_required')
          errorEl.hidden = false
        }
        if (submitBtn) submitBtn.disabled = false
        return
      }

      try {
        await updateMessage(msg.id, { sujet, contenu })
        const updated = await fetchMessage(msg.id)
        renderPage({ ...stateRef.current!, showEditModal: false, selectedMessage: updated })
        showPageAlert('page-alert', t('messages.message_edited'))
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

export async function mountMessagesPage(root: HTMLElement): Promise<void> {
  pageRoot = root
  const storedUser = getStoredUser()
  if (!storedUser) return

  let nonLues = 0
  try {
    const notifData = await fetchNotifications()
    nonLues = notifData.non_lues
  } catch { /* ignore */ }

  root.innerHTML = renderAppLayout({
    user: storedUser,
    role: 'investisseur',
    activePage: 'messages',
    content: `<div class="admin-loading"><div class="admin-loading-spinner"></div><p>${t('messages.loading')}</p></div>`,
    nonLues,
  })
  setupAppLayout(root)

  try {
    const data = await fetchMessages()
    renderPage({
      messages: data.results, search: '', statut: '',
      selectedId: null, selectedMessage: null, view: 'list', loading: false, showEditModal: false,
      currentPage: 1, totalCount: data.count, currentUserId: storedUser.id, editingReponse: null,
    })
  } catch (error) {
    root.querySelector('.app-content')!.innerHTML = `
      <div class="admin-error-state">
        <p>${formatApiErrors(error)}</p>
        <a href="/login" class="btn btn-primary">${t('messages.error_login')}</a>
      </div>
    `
  }
}

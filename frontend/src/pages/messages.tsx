import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { formatApiErrors, getStoredUser } from '../api/auth'
import {
  createMessage,
  createReponse,
  deleteMessage,
  deleteReponse,
  fetchMessage,
  fetchMessages,
  formatDate,
  formatDateTime,
  getFullName,
  getInitials,
  updateMessage,
  updateReponse,
  type Message,
  type Reponse,
} from '../api/messagerie'
import { t } from '../i18n/index'

const PAGE_SIZE = 6

interface AlertState {
  message: string
  isError: boolean
}

export function MessagesPage(): React.JSX.Element {
  const storedUser = getStoredUser()
  const currentUserId = storedUser?.id ?? -1
  const [searchParams, setSearchParams] = useSearchParams()
  const messageIdParam = searchParams.get('message')

  const [view, setView] = useState<'list' | 'detail' | 'compose'>('list')
  const [messages, setMessages] = useState<Message[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState<'' | 'lu' | 'non_lu'>('')
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingReponse, setEditingReponse] = useState<Reponse | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [initialError, setInitialError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [alerts, setAlerts] = useState<Record<string, AlertState>>({})
  const alertTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [replyContenu, setReplyContenu] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [composeSending, setComposeSending] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [replyEditError, setReplyEditError] = useState('')
  const [replyEditSaving, setReplyEditSaving] = useState(false)

  const showAlert = (id: string, message: string, isError = false): void => {
    setAlerts((prev) => ({ ...prev, [id]: { message, isError } }))
    if (alertTimers.current[id]) clearTimeout(alertTimers.current[id])
    alertTimers.current[id] = setTimeout(() => {
      setAlerts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      delete alertTimers.current[id]
    }, 5000)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    const isInitial = initialLoading
    const doFetch = async (): Promise<void> => {
      try {
        const data = await fetchMessages(search, statut, currentPage)
        if (cancelled) return
        setMessages(data.results)
        setTotalCount(data.count)
        if (isInitial) {
          setInitialLoading(false)
          setInitialError('')
        }
      } catch (error) {
        if (cancelled) return
        if (isInitial) {
          setInitialLoading(false)
          setInitialError(formatApiErrors(error))
        } else {
          showAlert('page-error', formatApiErrors(error), true)
        }
      }
    }
    void doFetch()
    return () => {
      cancelled = true
    }
  }, [search, statut, currentPage, refreshKey])

  const goBackToList = (): void => {
    setView('list')
    setSelectedMessage(null)
    setShowEditModal(false)
    setEditingReponse(null)
    setRefreshKey((k) => k + 1)
  }

  const handleCompose = (): void => {
    setView('compose')
    setSelectedMessage(null)
    setShowEditModal(false)
    setEditingReponse(null)
  }

  const openMessage = async (id: number): Promise<void> => {
    try {
      const msg = await fetchMessage(id)
      setSelectedMessage(msg)
      setView('detail')
      setShowEditModal(false)
      setEditingReponse(null)
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    }
  }

  useEffect(() => {
    if (!messageIdParam) return
    const id = Number(messageIdParam)
    if (Number.isInteger(id) && id > 0) {
      void openMessage(id)
    }
    const params = new URLSearchParams(searchParams.toString())
    params.delete('message')
    setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIdParam])

  const handleListEdit = async (id: number, e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation()
    try {
      const msg = await fetchMessage(id)
      setSelectedMessage(msg)
      setView('detail')
      setShowEditModal(true)
      setEditingReponse(null)
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    }
  }

  const handleListDelete = async (id: number, e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation()
    if (!window.confirm(t('messages.confirm_delete_message'))) return
    try {
      await deleteMessage(id)
      setRefreshKey((k) => k + 1)
      showAlert('page-alert', t('messages.message_deleted'))
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    }
  }

  const handlePage = (val: string): void => {
    let newPage = currentPage
    if (val === 'prev') newPage = Math.max(1, currentPage - 1)
    else if (val === 'next') newPage = currentPage + 1
    else newPage = Number(val)
    setCurrentPage(newPage)
  }

  const handleDetailEdit = (): void => {
    if (!selectedMessage) return
    setEditError('')
    setShowEditModal(true)
  }

  const handleDetailDelete = async (): Promise<void> => {
    const msg = selectedMessage
    if (!msg) return
    if (!window.confirm(t('messages.confirm_delete_message'))) return
    try {
      await deleteMessage(msg.id)
      setView('list')
      setSelectedMessage(null)
      setShowEditModal(false)
      setEditingReponse(null)
      setRefreshKey((k) => k + 1)
      showAlert('page-alert', t('messages.message_deleted'))
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    }
  }

  const handleReplySubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const contenu = replyContenu.trim()
    if (!contenu || !selectedMessage || replySending) return
    setReplySending(true)
    try {
      await createReponse(selectedMessage.id, contenu)
      const msg = await fetchMessage(selectedMessage.id)
      setSelectedMessage(msg)
      setEditingReponse(null)
      setReplyContenu('')
      showAlert('reply-alert', t('messages.reply_sent'))
    } catch (error) {
      showAlert('reply-alert', formatApiErrors(error), true)
    } finally {
      setReplySending(false)
    }
  }

  const handleReplyEdit = (replyId: number, e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation()
    const msg = selectedMessage
    if (!msg) return
    const rep = (msg.reponses ?? []).find((r: Reponse) => r.id === replyId)
    if (rep) {
      setEditingReponse(rep)
      setReplyEditError('')
    }
  }

  const handleReplyDelete = async (replyId: number, e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation()
    if (!window.confirm(t('messages.confirm_delete_reply'))) return
    const msg = selectedMessage
    if (!msg) return
    try {
      await deleteReponse(replyId)
      const updated = await fetchMessage(msg.id)
      setSelectedMessage(updated)
      setEditingReponse(null)
      showAlert('detail-alert', t('messages.reply_deleted'))
    } catch (error) {
      showAlert('detail-alert', formatApiErrors(error), true)
    }
  }

  const closeReplyModal = (): void => {
    setEditingReponse(null)
    setReplyEditError('')
  }

  const handleReplyModalSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const rep = editingReponse
    const msg = selectedMessage
    if (!rep || !msg || replyEditSaving) return
    const contenu = String(new FormData(e.currentTarget).get('contenu') ?? '').trim()
    if (!contenu) {
      setReplyEditError(t('common.validation_content_required'))
      return
    }
    setReplyEditError('')
    setReplyEditSaving(true)
    try {
      await updateReponse(rep.id, { contenu })
      const updated = await fetchMessage(msg.id)
      setSelectedMessage(updated)
      setEditingReponse(null)
      showAlert('detail-alert', t('messages.reply_edited'))
    } catch (error) {
      setReplyEditError(formatApiErrors(error))
    } finally {
      setReplyEditSaving(false)
    }
  }

  const handleComposeSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const sujet = String(formData.get('sujet') ?? '').trim()
    const contenu = String(formData.get('contenu') ?? '').trim()
    if (!sujet || !contenu || composeSending) return
    setComposeSending(true)
    try {
      await createMessage({ sujet, contenu })
      setView('list')
      setSelectedMessage(null)
      setShowEditModal(false)
      setEditingReponse(null)
      setCurrentPage(1)
      setRefreshKey((k) => k + 1)
      showAlert('page-alert', t('messages.message_sent'))
    } catch (error) {
      showAlert('compose-alert', formatApiErrors(error), true)
    } finally {
      setComposeSending(false)
    }
  }

  const closeEditModal = (): void => {
    setShowEditModal(false)
    setEditError('')
  }

  const handleEditModalSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const msg = selectedMessage
    if (!msg || editSaving) return
    const formData = new FormData(e.currentTarget)
    const sujet = String(formData.get('sujet') ?? '').trim()
    const contenu = String(formData.get('contenu') ?? '').trim()
    if (!sujet || !contenu) {
      setEditError(t('common.validation_all_required'))
      return
    }
    setEditError('')
    setEditSaving(true)
    try {
      await updateMessage(msg.id, { sujet, contenu })
      const updated = await fetchMessage(msg.id)
      setSelectedMessage(updated)
      setShowEditModal(false)
      showAlert('page-alert', t('messages.message_edited'))
    } catch (error) {
      setEditError(formatApiErrors(error))
    } finally {
      setEditSaving(false)
    }
  }

  const alertClass = (id: string): string => {
    const a = alerts[id]
    return `contact-alert${a ? ` contact-alert--${a.isError ? 'error' : 'success'}` : ''}`
  }

  const renderMessageRow = (msg: Message): React.JSX.Element => (
    <div
      className={`msg-item${!msg.est_lu ? ' msg-item--unread' : ''}`}
      key={msg.id}
      onClick={() => {
        void openMessage(msg.id)
      }}
    >
      <div className="msg-item-avatar">
        <span className="msg-avatar-circle">{getInitials(msg.expediteur)}</span>
      </div>
      <div className="msg-item-body">
        <div className="msg-item-header">
          <span className="msg-item-sujet">{msg.sujet}</span>
          <span className="msg-item-date">{formatDate(msg.date_creation)}</span>
        </div>
        <div className="msg-item-preview">
          {msg.derniere_reponse ? (
            <>
              <span className="msg-reply-badge">{t('messages.admin_reply_badge')}</span>{' '}
              {msg.derniere_reponse.contenu.substring(0, 60)}...
            </>
          ) : (
            msg.contenu.substring(0, 80) + '...'
          )}
        </div>
        <div className="msg-item-meta">
          {!msg.est_lu ? <span className="msg-unread-dot"></span> : null}
          {msg.nb_reponses !== undefined ? (
            <span className="msg-reply-count">{t('messages.reply_count').replace('{{count}}', String(msg.nb_reponses))}</span>
          ) : null}
        </div>
      </div>
      <div className="msg-item-actions">
        <button
          type="button"
          className="table-action-btn"
          title={t('messages.edit')}
          onClick={(e) => {
            void handleListEdit(msg.id, e)
          }}
        >
          {icons.edit}
        </button>
        <button
          type="button"
          className="table-action-btn table-action-btn--danger"
          title={t('messages.delete')}
          onClick={(e) => {
            void handleListDelete(msg.id, e)
          }}
        >
          {icons.trash}
        </button>
      </div>
    </div>
  )

  const renderPagination = (): React.JSX.Element | null => {
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    const start = (currentPage - 1) * PAGE_SIZE + 1
    const end = Math.min(currentPage * PAGE_SIZE, totalCount)

    if (totalCount === 0) return null

    const pageBtns: React.ReactNode[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
          pageBtns.push(
            <button
              type="button"
              className={`pagination-btn pagination-btn--page${i === currentPage ? ' pagination-btn--active' : ''}`}
              key={i}
              onClick={() => handlePage(String(i))}
            >
              {i}
            </button>,
          )
        } else if (i === currentPage - 2 || i === currentPage + 2) {
          pageBtns.push(<span className="pagination-ellipsis" key={i}>...</span>)
        }
      } else {
        pageBtns.push(
          <button
            type="button"
            className={`pagination-btn pagination-btn--page${i === currentPage ? ' pagination-btn--active' : ''}`}
            key={i}
            onClick={() => handlePage(String(i))}
          >
            {i}
          </button>,
        )
      }
    }

    return (
      <div className="users-pagination">
        <span className="pagination-info">
          {t('messages.pagination_showing')} {start}-{end} {t('messages.pagination_on')} {totalCount}{' '}
          {t('messages.pagination_results')}
        </span>
        <div className="users-pagination-controls">
          <button type="button" className="pagination-btn" disabled={currentPage <= 1} onClick={() => handlePage('prev')}>
            {icons.chevronLeft} {t('messages.pagination_prev')}
          </button>
          {pageBtns}
          <button type="button" className="pagination-btn" disabled={currentPage >= totalPages} onClick={() => handlePage('next')}>
            {t('messages.pagination_next')} {icons.chevron}
          </button>
        </div>
      </div>
    )
  }

  const listView = (
    <div className="msg-page">
      <div className="msg-page-header">
        <div>
          <h2 className="msg-page-title">{t('messages.title')}</h2>
          <p className="msg-page-desc">{t('messages.investor_desc')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-action" onClick={handleCompose}>
          {icons.plus} {t('messages.new_message')}
        </button>
      </div>
      <div id="page-alert" className={alertClass('page-alert')} hidden={!alerts['page-alert']}>
        {alerts['page-alert']?.message ?? ''}
      </div>
      <div id="page-error" className="contact-alert contact-alert--error" hidden={!alerts['page-error']}>
        {alerts['page-error']?.message ?? ''}
      </div>
      <div className="msg-toolbar">
        <div className="msg-search-field">
          {icons.search}
          <input
            type="search"
            id="msg-search"
            className="msg-search-input"
            placeholder={t('messages.search_placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          id="msg-statut-filter"
          className="toolbar-select"
          value={statut}
          onChange={(e) => {
            setStatut(e.target.value as '' | 'lu' | 'non_lu')
            setCurrentPage(1)
          }}
        >
          <option value="">{t('messages.all')}</option>
          <option value="non_lu">{t('messages.unread')}</option>
          <option value="lu">{t('messages.read')}</option>
        </select>
      </div>
      <div className="msg-list">
        {messages.length > 0 ? (
          messages.map(renderMessageRow)
        ) : (
          <div className="msg-empty">
            <p>{t('messages.empty')}</p>
          </div>
        )}
      </div>
      {renderPagination()}
    </div>
  )

  const detailView = selectedMessage ? (
    <div className="msg-detail">
      <div className="msg-detail-header">
        <button type="button" className="msg-back-btn" onClick={goBackToList}>
          {icons.chevronLeft} {t('messages.back')}
        </button>
        <div className="msg-detail-actions">
          <button type="button" className="msg-action-btn msg-action-btn--edit" onClick={handleDetailEdit}>
            {icons.edit} {t('messages.edit')}
          </button>
          <button type="button" className="msg-action-btn msg-action-btn--delete" onClick={() => { void handleDetailDelete() }}>
            {icons.trash} {t('messages.delete')}
          </button>
        </div>
      </div>
      <div id="detail-alert" className={alertClass('detail-alert')} hidden={!alerts['detail-alert']}>
        {alerts['detail-alert']?.message ?? ''}
      </div>
      <div className="msg-detail-subject">
        <h2>{selectedMessage.sujet}</h2>
        <span className="msg-detail-date">{formatDateTime(selectedMessage.date_creation)}</span>
      </div>
      <div className="msg-detail-message">
        <div className="msg-detail-author">
          <span className="msg-avatar-circle msg-avatar-circle--sm">{getInitials(selectedMessage.expediteur)}</span>
          <div>
            <span className="msg-author-name">{getFullName(selectedMessage.expediteur)}</span>
            <span className="msg-author-email">{selectedMessage.expediteur.email}</span>
          </div>
        </div>
        <div className="msg-detail-content">{selectedMessage.contenu}</div>
      </div>
      {selectedMessage.reponses && selectedMessage.reponses.length > 0 ? (
        <div className="msg-replies">
          <h3 className="msg-replies-title">
            {icons.reply} {t('messages.replies_title')} ({selectedMessage.reponses.length})
          </h3>
          {selectedMessage.reponses.map((r: Reponse) => {
            const isOwn = r.auteur.id === currentUserId
            return (
              <div className={`msg-reply ${isOwn ? 'msg-reply--own' : 'msg-reply--other'}`} key={r.id}>
                <div className="msg-reply-header">
                  <div className="msg-detail-author">
                    <span className={`msg-avatar-circle msg-avatar-circle--sm${isOwn ? '' : ' msg-avatar-circle--admin'}`}>
                      {getInitials(r.auteur)}
                    </span>
                    <div>
                      <span className="msg-author-name">{getFullName(r.auteur)}</span>
                      <span className="msg-author-email">{r.auteur.email}</span>
                    </div>
                  </div>
                  <div className="msg-reply-header-right">
                    <span className="msg-reply-date">{formatDateTime(r.date_creation)}</span>
                    {isOwn ? (
                      <div className="msg-reply-actions">
                        <button
                          type="button"
                          className="table-action-btn"
                          title={t('messages.edit')}
                          onClick={(e) => handleReplyEdit(r.id, e)}
                        >
                          {icons.edit}
                        </button>
                        <button
                          type="button"
                          className="table-action-btn table-action-btn--danger"
                          title={t('messages.delete')}
                          onClick={(e) => {
                            void handleReplyDelete(r.id, e)
                          }}
                        >
                          {icons.trash}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="msg-reply-content">{r.contenu}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="msg-no-replies">
          <p>{t('messages.no_replies')}</p>
        </div>
      )}
      <div className="msg-reply-form">
        <h3 className="msg-reply-form-title">{t('messages.add_reply')}</h3>
        <div id="reply-alert" className={alertClass('reply-alert')} hidden={!alerts['reply-alert']}>
          {alerts['reply-alert']?.message ?? ''}
        </div>
        <form id="reply-form" noValidate onSubmit={handleReplySubmit}>
          <textarea
            id="reply-contenu"
            className="contact-input contact-textarea"
            rows={3}
            placeholder={t('messages.reply_placeholder')}
            required
            value={replyContenu}
            onChange={(e) => setReplyContenu(e.target.value)}
          ></textarea>
          <button type="submit" className="btn btn-primary btn-sm" disabled={replySending}>
            <span className="contact-submit-icon">{icons.send}</span> {t('messages.send')}
          </button>
        </form>
      </div>
    </div>
  ) : null

  const composeView = (
    <div className="msg-compose">
      <div className="msg-detail-header">
        <button type="button" className="msg-back-btn" onClick={goBackToList}>
          {icons.chevronLeft} {t('messages.back')}
        </button>
      </div>
      <h2 className="msg-compose-title">{t('messages.compose_title')}</h2>
      <p className="msg-compose-desc">{t('messages.compose_desc')}</p>
      <div id="compose-alert" className={alertClass('compose-alert')} hidden={!alerts['compose-alert']}>
        {alerts['compose-alert']?.message ?? ''}
      </div>
      <form id="compose-form" noValidate onSubmit={handleComposeSubmit}>
        <div className="contact-form-field">
          <label htmlFor="compose-sujet" className="contact-label">{t('messages.subject')}</label>
          <input
            id="compose-sujet"
            name="sujet"
            type="text"
            className="contact-input"
            placeholder={t('messages.compose_placeholder_subject')}
            required
          />
        </div>
        <div className="contact-form-field">
          <label htmlFor="compose-contenu" className="contact-label">{t('messages.content')}</label>
          <textarea
            id="compose-contenu"
            name="contenu"
            className="contact-input contact-textarea"
            rows={6}
            placeholder={t('messages.compose_placeholder_content')}
            required
          ></textarea>
        </div>
        <button type="submit" className="btn btn-primary" disabled={composeSending}>
          <span className="contact-submit-icon">{icons.send}</span> {t('messages.compose_submit')}
        </button>
      </form>
    </div>
  )

  const editModal = (
    <div
      className="admin-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeEditModal()
      }}
    >
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h3>{t('messages.edit_message')}</h3>
          <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={closeEditModal}>
            {icons.close}
          </button>
        </div>
        <form className="admin-modal-form" noValidate onSubmit={handleEditModalSubmit}>
          <div className="form-alert form-alert--error" hidden={!editError}>{editError}</div>
          <div className="form-field">
            <label htmlFor="edit-msg-sujet" className="form-label">{t('messages.subject')}</label>
            <input id="edit-msg-sujet" name="sujet" className="modal-input" defaultValue={selectedMessage?.sujet} required />
          </div>
          <div className="form-field">
            <label htmlFor="edit-msg-contenu" className="form-label">{t('messages.content')}</label>
            <textarea
              id="edit-msg-contenu"
              name="contenu"
              className="modal-input"
              rows={6}
              required
              style={{ resize: 'vertical', minHeight: 120 }}
              defaultValue={selectedMessage?.contenu}
            ></textarea>
          </div>
          <div className="admin-modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeEditModal}>{t('messages.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={editSaving}>{t('messages.save')}</button>
          </div>
        </form>
      </div>
    </div>
  )

  const replyEditModal = (
    <div
      className="admin-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeReplyModal()
      }}
    >
      <div className="admin-modal" role="dialog" aria-modal="true">
        <div className="admin-modal-header">
          <h3>{t('messages.edit_reply')}</h3>
          <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={closeReplyModal}>
            {icons.close}
          </button>
        </div>
        <form className="admin-modal-form" noValidate onSubmit={handleReplyModalSubmit}>
          <div className="form-alert form-alert--error" hidden={!replyEditError}>{replyEditError}</div>
          <div className="form-field">
            <label htmlFor="edit-reply-contenu" className="form-label">{t('messages.reply_label')}</label>
            <textarea
              id="edit-reply-contenu"
              name="contenu"
              className="modal-input"
              rows={6}
              required
              style={{ resize: 'vertical', minHeight: 120 }}
              defaultValue={editingReponse?.contenu}
            ></textarea>
          </div>
          <div className="admin-modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeReplyModal}>{t('messages.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={replyEditSaving}>{t('messages.save')}</button>
          </div>
        </form>
      </div>
    </div>
  )

  let content: React.ReactNode
  if (initialLoading) {
    content = (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>{t('messages.loading')}</p>
      </div>
    )
  } else if (initialError) {
    content = (
      <div className="admin-error-state">
        <p>{initialError}</p>
        <Link to="/login" className="btn btn-primary">{t('messages.error_login')}</Link>
      </div>
    )
  } else if (view === 'compose') {
    content = composeView
  } else if (view === 'detail') {
    content = detailView
  } else {
    content = listView
  }

  return (
    <DashboardLayout role="investisseur" activePage="messages">
      {content}
      {showEditModal && selectedMessage ? editModal : null}
      {editingReponse ? replyEditModal : null}
    </DashboardLayout>
  )
}

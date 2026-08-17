import { useCallback, useEffect, useRef, useState } from 'react'
import { icons } from './icons'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { LigneFormModal } from './LigneFormModal'
import {
  type AttributDefinition,
  type CoucheFeatureRow,
  createCoucheFeature,
  deleteCoucheFeature,
  duplicateCoucheFeature,
  fetchCoucheFeatures,
  updateCoucheFeature,
} from '../api/couches'

const ATTR_BADGE_CLASS: Record<string, string> = {
  string: 'is-string', varchar: 'is-string', text: 'is-string', character: 'is-string',
  integer: 'is-number', int: 'is-number', int4: 'is-number', bigint: 'is-number',
  int8: 'is-number', smallint: 'is-number', int2: 'is-number',
  double: 'is-number', float: 'is-number', float8: 'is-number', numeric: 'is-number', decimal: 'is-number',
  boolean: 'is-bool', bool: 'is-bool',
  date: 'is-date', timestamp: 'is-date', time: 'is-date',
}

interface GererLignesModalProps {
  coucheId: number
  coucheName: string
  attributs: AttributDefinition[]
  onClose: () => void
  onUpdated: () => void
}

export function GererLignesModal({ coucheId, coucheName, attributs, onClose, onUpdated }: GererLignesModalProps): React.JSX.Element {
  const [rows, setRows] = useState<CoucheFeatureRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editRow, setEditRow] = useState<CoucheFeatureRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CoucheFeatureRow | null>(null)
  const pageSize = 100
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (p: number, q: string): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchCoucheFeatures(coucheId, { search: q || undefined, page: p, page_size: pageSize })
      setRows(data.results)
      setTotal(data.count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [coucheId])

  useEffect(() => {
    void load(page, search)
  }, [page, search, load])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchInput])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const toggleSelect = (id: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (): void => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.id)))
  }

  const handleSave = async (properties: Record<string, unknown>, geometry?: { type: string; coordinates: any } | null): Promise<void> => {
    if (editRow) {
      await updateCoucheFeature(coucheId, editRow.id, properties, geometry ?? undefined)
    } else {
      await createCoucheFeature(coucheId, properties, geometry ?? undefined)
    }
    setFormOpen(false)
    setEditRow(null)
    onUpdated()
    await load(page, search)
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    await deleteCoucheFeature(coucheId, deleteTarget.id)
    setDeleteTarget(null)
    onUpdated()
    await load(page, search)
  }

  const handleDuplicate = async (row: CoucheFeatureRow): Promise<void> => {
    await duplicateCoucheFeature(coucheId, row.id)
    onUpdated()
    await load(page, search)
  }

  const handleExport = (): Promise<void> => {
    const exportRows = selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows
    const headers = attributs.map((a) => a.nom)
    const csvLines = [headers.join(',')]
    exportRows.forEach((r) => {
      csvLines.push(headers.map((h) => {
        const v = r.properties[h]
        if (v == null) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','))
    })
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${coucheName}_export.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return Promise.resolve()
  }

  return (
    <div className="admin-modal-overlay couche-modal-overlay gerer-overlay" onClick={onClose}>
      <div className="admin-modal gerer-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="couche-modal-header gerer-header">
          <h3>Gérer les données : {coucheName}</h3>
          <button type="button" className="couche-modal-close" aria-label="Fermer" onClick={onClose}>{icons.close}</button>
        </div>

        <div className="gerer-toolbar">
          <div className="gerer-search">
            {icons.search}
            <input
              type="search"
              className="gerer-search-input"
              placeholder="Rechercher..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="gerer-toolbar-actions">
            <button type="button" className="gerer-btn-add" onClick={() => { setEditRow(null); setFormOpen(true) }}>
              {icons.plus} Ajouter une ligne
            </button>
            <button type="button" className="gerer-btn-export" onClick={() => { void handleExport() }}>
              {icons.download} Exporter{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
        </div>

        {error ? <div className="form-alert form-alert--error gerer-alert">{error}</div> : null}

        <div className="gerer-table-wrap">
          <table className="gerer-table">
            <thead>
              <tr>
                <th className="gerer-th-check"><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} /></th>
                {attributs.map((a) => (
                  <th key={a.nom}>
                    <span className="gerer-th-inner">{a.nom} <span className={`couche-attr-type ${ATTR_BADGE_CLASS[a.type.toLowerCase()] || ''}`}>{a.type}</span></span>
                  </th>
                ))}
                <th className="gerer-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={attributs.length + 2} className="gerer-empty"><div className="admin-loading-spinner"></div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={attributs.length + 2} className="gerer-empty">Aucune donnée disponible.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={selected.has(r.id) ? 'gerer-tr--selected' : ''}>
                    <td className="gerer-td-check"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                    {attributs.map((a) => (
                      <td key={a.nom} className="gerer-td-value">{r.properties[a.nom] != null ? String(r.properties[a.nom]) : <span className="gerer-null">—</span>}</td>
                    ))}
                    <td className="gerer-td-actions">
                      <button type="button" className="gerer-action-btn gerer-action-btn--edit" title="Modifier" onClick={() => { setEditRow(r); setFormOpen(true) }}>{icons.edit}</button>
                      <button type="button" className="gerer-action-btn gerer-action-btn--duplicate" title="Dupliquer" onClick={() => { void handleDuplicate(r) }}>{icons.plus}</button>
                      <button type="button" className="gerer-action-btn gerer-action-btn--danger" title="Supprimer" onClick={() => setDeleteTarget(r)}>{icons.trash}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="gerer-pagination">
          <span className="gerer-page-info">{total} résultat(s)</span>
          <div className="gerer-page-controls">
            <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
            <span className="gerer-page-num">{page} / {totalPages}</span>
            <button type="button" className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
          </div>
        </div>
      </div>

      {formOpen ? (
        <LigneFormModal
          attributs={attributs}
          initial={editRow?.properties}
          title={editRow ? `Modifier la ligne #${editRow.id}` : 'Ajouter une ligne'}
          onSave={async (props, geom) => { await handleSave(props, geom) }}
          onClose={() => { setFormOpen(false); setEditRow(null) }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteDialog
          label={`Supprimer la ligne #${deleteTarget.id} ?`}
          onConfirm={() => { void handleDelete() }}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  )
}

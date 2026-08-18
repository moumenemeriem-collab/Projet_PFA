import { useEffect, useState } from 'react'
import { icons } from './icons'
import { FormMapPanel } from './FormMapPanel'
import type { AttributDefinition } from '../api/couches'

interface LigneFormModalProps {
  attributs: AttributDefinition[]
  initial?: Record<string, unknown>
  title: string
  onSave: (properties: Record<string, unknown>, geometry?: { type: string; coordinates: any } | null) => Promise<void>
  onClose: () => void
}

const EDITABLE_ATTRS_BLACKLIST = new Set(['fid'])

export function LigneFormModal({ attributs, initial, title, onSave, onClose }: LigneFormModalProps): React.JSX.Element {
  const editableAttributs = attributs.filter((a) => !EDITABLE_ATTRS_BLACKLIST.has(a.nom.toLowerCase()))
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [geometry, setGeometry] = useState<{ type: string; coordinates: any } | null>(null)

  useEffect(() => {
    const f: Record<string, string> = {}
    editableAttributs.forEach((a) => {
      const v = initial?.[a.nom]
      f[a.nom] = v != null ? String(v) : ''
    })
    setForm(f)
  }, [editableAttributs, initial])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    for (const a of editableAttributs) {
      const v = form[a.nom]
      if (v === '' || v === undefined) continue
      if (a.type.toLowerCase() === 'number' || a.type.toLowerCase() === 'integer') {
        const n = Number(v)
        if (Number.isNaN(n)) {
          setError(`Le champ "${a.nom}" doit être un nombre.`)
          return
        }
      }
    }
    const properties: Record<string, unknown> = {}
    editableAttributs.forEach((a) => {
      const v = form[a.nom]
      if (v === '' || v === undefined) {
        properties[a.nom] = null
      } else if (a.type.toLowerCase() === 'number' || a.type.toLowerCase() === 'integer') {
        properties[a.nom] = Number(v)
      } else {
        properties[a.nom] = v
      }
    })
    setSaving(true)
    try {
      await onSave(properties, geometry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay ligne-form-overlay" onClick={onClose}>
      <div className="ligne-form-split" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ligne-form-left">
          <div className="couche-modal-header">
            <h3>{title}</h3>
            <button type="button" className="couche-modal-close" aria-label="Fermer" onClick={onClose}>{icons.close}</button>
          </div>
          <form className="ligne-form-body" onSubmit={(e) => { void handleSubmit(e) }}>
            {error ? <div className="form-alert form-alert--error">{error}</div> : null}
            {editableAttributs.map((a) => (
              <div className="ligne-form-field" key={a.nom}>
                <label className="form-label">{a.nom}</label>
                <input
                  className="modal-input"
                  type={a.type.toLowerCase() === 'number' || a.type.toLowerCase() === 'integer' ? 'number' : 'text'}
                  step={a.type.toLowerCase() === 'number' || a.type.toLowerCase() === 'integer' ? 'any' : undefined}
                  value={form[a.nom] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [a.nom]: e.target.value }))}
                />
              </div>
            ))}
            {geometry ? (
              <div className="ligne-form-geometry-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>Géométrie définie ({geometry.type})</span>
                <button type="button" className="ligne-form-geometry-clear" onClick={() => setGeometry(null)}>{icons.close}</button>
              </div>
            ) : null}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : icons.save} Enregistrer</button>
            </div>
          </form>
        </div>
        <div className="ligne-form-right">
          <FormMapPanel onGeometry={setGeometry} />
        </div>
      </div>
    </div>
  )
}

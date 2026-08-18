import { icons } from './icons'

interface ConfirmDeleteDialogProps {
  label: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteDialog({ label, onConfirm, onCancel }: ConfirmDeleteDialogProps): React.JSX.Element {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">{icons.trash}</div>
        <p className="confirm-text">{label}</p>
        <p className="confirm-sub">Cette action est irréversible.</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-sm btn-outline" onClick={onCancel}>Annuler</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={onConfirm}>Supprimer</button>
        </div>
      </div>
    </div>
  )
}

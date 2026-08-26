import type { ReactNode } from 'react'

interface WizardNextButtonProps {
  onClick: () => void
  disabled?: boolean
  children?: ReactNode
  variant?: 'primary' | 'secondary'
  icon?: string
}

export function WizardNextButton({
  onClick,
  disabled = false,
  children,
  variant = 'primary',
  icon,
}: WizardNextButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`wz-btn wz-btn--${variant}`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && <span className="wz-btn-icon">{icon}</span>}
      <span className="wz-btn-text">{children}</span>
    </button>
  )
}

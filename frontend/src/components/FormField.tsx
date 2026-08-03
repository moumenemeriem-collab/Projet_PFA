import { useState, type ReactNode } from 'react'
import { icons } from './icons'
import { t } from '../i18n/index'

interface FormFieldProps {
  id: string
  label: string
  type?: string
  placeholder?: string
  icon?: string
  required?: boolean
  autocomplete?: string
  extraLabel?: ReactNode
  togglePassword?: boolean
  half?: boolean
  defaultValue?: string
  readOnly?: boolean
}

export function FormField({
  id,
  label,
  type = 'text',
  placeholder = '',
  icon,
  required = true,
  autocomplete,
  extraLabel,
  togglePassword = false,
  half = false,
  defaultValue = '',
  readOnly = false,
}: FormFieldProps): React.JSX.Element {
  const [showPassword, setShowPassword] = useState(false)
  const inputType = togglePassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className={`form-field${half ? ' form-field--half' : ''}`}>
      <div className="form-field-label-row">
        <label htmlFor={id} className="form-label">{label}</label>
        {extraLabel}
      </div>
      <div className="input-wrapper">
        {icon ? <span className="input-icon">{icons[icon as keyof typeof icons]}</span> : null}
        <input
          id={id}
          name={id}
          type={inputType}
          className="form-input"
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          readOnly={readOnly}
          autoComplete={autocomplete}
        />
        {togglePassword ? (
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? t('common.hide_password') : t('common.show_password')}
            onClick={() => setShowPassword((s) => !s)}
          >
            {showPassword ? icons.eyeOff : icons.eye}
          </button>
        ) : null}
      </div>
    </div>
  )
}

import { icons } from '../icons.ts'

export interface FormFieldOptions {
  id: string
  label: string
  type?: string
  placeholder?: string
  icon?: keyof typeof icons
  required?: boolean
  autocomplete?: string
  extraLabel?: string
  togglePassword?: boolean
  half?: boolean
  value?: string
  readonly?: boolean
}

export function renderFormField(options: FormFieldOptions): string {
  const {
    id,
    label,
    type = 'text',
    placeholder = '',
    icon,
    required = true,
    autocomplete,
    extraLabel = '',
    togglePassword = false,
    half = false,
    value = '',
    readonly = false,
  } = options

  const inputType = togglePassword ? 'password' : type

  return `
    <div class="form-field${half ? ' form-field--half' : ''}">
      <div class="form-field-label-row">
        <label for="${id}" class="form-label">${label}</label>
        ${extraLabel}
      </div>
      <div class="input-wrapper">
        ${icon ? `<span class="input-icon">${icons[icon]}</span>` : ''}
        <input
          id="${id}"
          name="${id}"
          type="${inputType}"
          class="form-input"
          placeholder="${placeholder}"
          value="${value.replace(/"/g, '&quot;')}"
          ${required ? 'required' : ''}
          ${readonly ? 'readonly' : ''}
          ${autocomplete ? `autocomplete="${autocomplete}"` : ''}
        />
        ${
          togglePassword
            ? `<button type="button" class="password-toggle" data-target="${id}" aria-label="Afficher le mot de passe">${icons.eye}</button>`
            : ''
        }
      </div>
    </div>
  `
}

export function setupPasswordToggles(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('.password-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target
      if (!targetId) return
      const input = root.querySelector<HTMLInputElement>(`#${targetId}`)
      if (!input) return
      const isPassword = input.type === 'password'
      input.type = isPassword ? 'text' : 'password'
      btn.innerHTML = isPassword ? icons.eyeOff : icons.eye
      btn.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe')
    })
  })
}

import { icons } from '../components/icons.ts'
import { renderAuthLayout } from '../components/layout/AuthLayout.ts'
import { renderFormField, setupPasswordToggles } from '../components/ui/FormField.ts'
import { formatApiErrors, getPostAuthRedirect, login, saveSession } from '../api/auth.ts'
import { t, setupLangSwitcher } from '../i18n/index'

export function renderLoginPage(): string {
  return renderAuthLayout({
    activePage: 'login',
    title: t('auth.login.title'),
    subtitle: t('auth.login.subtitle'),
    cardContent: `
      <form id="login-form" class="auth-form" novalidate>
        <div id="login-error" class="form-alert form-alert--error" hidden></div>
        ${renderFormField({
          id: 'email',
          label: t('auth.login.email_label'),
          type: 'email',
          placeholder: 'nom@exemple.com',
          icon: 'mail',
          autocomplete: 'email',
        })}
        ${renderFormField({
          id: 'mot_de_passe',
          label: t('auth.login.password_label'),
          placeholder: '••••••••',
          icon: 'lock',
          togglePassword: true,
          autocomplete: 'current-password',
          extraLabel: `<a href="#" class="form-link">${t('auth.login.forgot_password')}</a>`,
        })}
        <button type="submit" class="btn btn-primary btn-block" id="login-submit">
          ${t('auth.login.submit')} ${icons.chevron}
        </button>
      </form>
    `,
    footerContent: `
      ${t('auth.login.no_account')}
      <a href="/register" class="form-link form-link--strong">${t('auth.login.create_account')}</a>
    `,
    
  })
}

export function mountLoginPage(root: HTMLElement): void {
  root.innerHTML = renderLoginPage()
  setupPasswordToggles(root)
  setupLangSwitcher(root)

  const form = root.querySelector<HTMLFormElement>('#login-form')
  const errorEl = root.querySelector<HTMLDivElement>('#login-error')
  const submitBtn = root.querySelector<HTMLButtonElement>('#login-submit')

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!form || !errorEl || !submitBtn) return

    errorEl.hidden = true
    submitBtn.disabled = true
    submitBtn.classList.add('btn--loading')

    const formData = new FormData(form)

    try {
      const response = await login({
        email: String(formData.get('email') ?? ''),
        mot_de_passe: String(formData.get('mot_de_passe') ?? ''),
      })
      saveSession(response.tokens, response.utilisateur)
      window.location.href = getPostAuthRedirect(response.utilisateur.role)
    } catch (error) {
      errorEl.textContent = formatApiErrors(error)
      errorEl.hidden = false
    } finally {
      submitBtn.disabled = false
      submitBtn.classList.remove('btn--loading')
    }
  })
}

import { icons } from '../components/icons.ts'
import { renderAuthLayout } from '../components/layout/AuthLayout.ts'
import { renderFormField, setupPasswordToggles } from '../components/ui/FormField.ts'
import { formatApiErrors, getPostAuthRedirect, register, saveSession } from '../api/auth.ts'
import { t, setupLangSwitcher } from '../i18n/index'

function getBenefits() {
  return [
    t('auth.register.benefit_1'),
    t('auth.register.benefit_2'),
    t('auth.register.benefit_3'),
  ]
}

export function renderRegisterPage(): string {
  const benefits = getBenefits()
  return renderAuthLayout({
    activePage: 'register',
    wide: true,
    title: t('auth.register.title'),
    subtitle: t('auth.register.subtitle'),
    cardContent: `
      <form id="register-form" class="auth-form" novalidate>
        <div id="register-error" class="form-alert form-alert--error" hidden></div>
        <div class="form-row">
          ${renderFormField({
            id: 'prenom',
            label: t('auth.register.prenom'),
            placeholder: 'Jean',
            icon: 'user',
            autocomplete: 'given-name',
            half: true,
          })}
          ${renderFormField({
            id: 'nom',
            label: t('auth.register.nom'),
            placeholder: 'Dupont',
            icon: 'user',
            autocomplete: 'family-name',
            half: true,
          })}
        </div>
        <div class="form-row">
          ${renderFormField({
            id: 'email',
            label: t('auth.register.email'),
            type: 'email',
            placeholder: 'nom@exemple.com',
            icon: 'mail',
            autocomplete: 'email',
            half: true,
          })}
          ${renderFormField({
            id: 'telephone',
            label: t('auth.register.telephone'),
            type: 'tel',
            placeholder: '+212 6XX XX XX XX',
            icon: 'phone',
            autocomplete: 'tel',
            required: false,
            half: true,
          })}
        </div>
        <div class="form-row">
          ${renderFormField({
            id: 'mot_de_passe',
            label: t('auth.register.password'),
            placeholder: '••••••••',
            icon: 'lock',
            togglePassword: true,
            autocomplete: 'new-password',
            half: true,
          })}
          ${renderFormField({
            id: 'confirmer_mot_de_passe',
            label: t('auth.register.confirm_password'),
            placeholder: '••••••••',
            icon: 'lock',
            togglePassword: true,
            autocomplete: 'new-password',
            half: true,
          })}
        </div>
        <label class="checkbox-field">
          <input type="checkbox" name="cgu" required />
          <span>
            ${t('auth.register.cgu')}
            <a href="#" class="form-link">${t('auth.register.cgu_link')}</a>
            ${t('auth.register.cgu_and')}
            <a href="#" class="form-link">${t('auth.register.privacy_link')}</a>.
          </span>
        </label>
        <button type="submit" class="btn btn-primary btn-block" id="register-submit">
          ${t('auth.register.submit')} ${icons.chevron}
        </button>
        <div class="benefits">
          <h3 class="benefits-title">${t('auth.register.why_join')}</h3>
          <ul class="benefits-list">
            ${benefits
              .map(
                (item) => `
              <li>
                <span class="benefits-check">${icons.check}</span>
                ${item}
              </li>
            `,
              )
              .join('')}
          </ul>
        </div>
      </form>
    `,
    footerContent: `
      ${t('auth.register.has_account')}
      <a href="/login" class="form-link form-link--strong">${t('auth.register.login_link')}</a>
    `,
    pageFooter: `
      <div class="register-footer-status">
        <span>${t('auth.register.instance_label')}</span>
        <span class="status-dot"><span></span> ${t('auth.register.servers_status')}</span>
      </div>
    `,
  })
}

export function mountRegisterPage(root: HTMLElement): void {
  root.innerHTML = renderRegisterPage()
  setupPasswordToggles(root)
  setupLangSwitcher(root)

  const form = root.querySelector<HTMLFormElement>('#register-form')
  const errorEl = root.querySelector<HTMLDivElement>('#register-error')
  const submitBtn = root.querySelector<HTMLButtonElement>('#register-submit')

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!form || !errorEl || !submitBtn) return

    errorEl.hidden = true
    submitBtn.disabled = true
    submitBtn.classList.add('btn--loading')

    const formData = new FormData(form)

    try {
      const response = await register({
        prenom: String(formData.get('prenom') ?? ''),
        nom: String(formData.get('nom') ?? ''),
        email: String(formData.get('email') ?? ''),
        telephone: String(formData.get('telephone') ?? '') || undefined,
        mot_de_passe: String(formData.get('mot_de_passe') ?? ''),
        confirmer_mot_de_passe: String(formData.get('confirmer_mot_de_passe') ?? ''),
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

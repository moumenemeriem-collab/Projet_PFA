import { icons } from '../components/icons.ts'
import { renderAuthLayout } from '../components/layout/AuthLayout.ts'
import { renderFormField, setupPasswordToggles } from '../components/ui/FormField.ts'
import { formatApiErrors, getPostAuthRedirect, register, saveSession } from '../api/auth.ts'

const benefits = [
  'Accès aux parcelles numérisées',
  'Analyses multicritères avancées',
  'Rapports d\'investissement PDF',
]

export function renderRegisterPage(): string {
  return renderAuthLayout({
    activePage: 'register',
    wide: true,
    title: 'Créer un compte',
    subtitle: 'Rejoignez la plateforme SIG leader pour l\'investissement foncier.',
    cardContent: `
      <form id="register-form" class="auth-form" novalidate>
        <div id="register-error" class="form-alert form-alert--error" hidden></div>
        <div class="form-row">
          ${renderFormField({
            id: 'prenom',
            label: 'Prénom',
            placeholder: 'Jean',
            icon: 'user',
            autocomplete: 'given-name',
            half: true,
          })}
          ${renderFormField({
            id: 'nom',
            label: 'Nom',
            placeholder: 'Dupont',
            icon: 'user',
            autocomplete: 'family-name',
            half: true,
          })}
        </div>
        <div class="form-row">
          ${renderFormField({
            id: 'email',
            label: 'Adresse e-mail',
            type: 'email',
            placeholder: 'nom@exemple.com',
            icon: 'mail',
            autocomplete: 'email',
            half: true,
          })}
          ${renderFormField({
            id: 'telephone',
            label: 'Numéro de téléphone',
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
            label: 'Mot de passe',
            placeholder: '••••••••',
            icon: 'lock',
            togglePassword: true,
            autocomplete: 'new-password',
            half: true,
          })}
          ${renderFormField({
            id: 'confirmer_mot_de_passe',
            label: 'Confirmer le mot de passe',
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
            J'accepte les
            <a href="#" class="form-link">Conditions Générales d'Utilisation</a>
            et la
            <a href="#" class="form-link">Politique de Confidentialité</a>.
          </span>
        </label>
        <button type="submit" class="btn btn-primary btn-block" id="register-submit">
          S'inscrire ${icons.chevron}
        </button>
        <div class="benefits">
          <h3 class="benefits-title">Pourquoi nous rejoindre ?</h3>
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
      Déjà membre de la communauté ?
      <a href="/login" class="form-link form-link--strong">Se connecter</a>
    `,
    pageFooter: `
      <div class="register-footer-status">
        <span>Instance de production — Région</span>
        <span class="status-dot"><span></span> Serveurs SIG Opérationnels</span>
      </div>
    `,
  })
}

export function mountRegisterPage(root: HTMLElement): void {
  root.innerHTML = renderRegisterPage()
  setupPasswordToggles(root)

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

import { icons } from '../components/icons.ts'
import { renderAppLayout, setupAppLayout } from '../components/layout/AppLayout.ts'
import { renderFormField, setupPasswordToggles } from '../components/ui/FormField.ts'
import { formatApiErrors, getStoredUser, type Utilisateur } from '../api/auth.ts'
import {
  changePassword,
  fetchProfile,
  getInitials,
  getRoleLabel,
  updateProfile,
} from '../api/profile.ts'
import { t } from '../i18n/index'

interface ProfileFormState {
  prenom: string
  nom: string
  email: string
  telephone: string
}

function renderProfileContent(user: Utilisateur): string {
  const telephone = user.telephone ?? ''

  return `
    <div class="profile-page">
      <header class="profile-page-header">
        <h1 class="profile-title">${t('profile.title')}</h1>
        <p class="profile-subtitle">${t('profile.subtitle')}</p>
      </header>

      <div id="profile-success" class="form-alert form-alert--success" hidden></div>
      <div id="profile-error" class="form-alert form-alert--error" hidden></div>

      <form id="profile-form" class="profile-card" novalidate>
        <div class="profile-card-header">
          <span class="profile-card-icon profile-card-icon--blue">${icons.user}</span>
          <div>
            <h2 class="profile-card-title">${t('profile.general_title')}</h2>
            <p class="profile-card-desc">${t('profile.general_desc')}</p>
          </div>
        </div>

        <div class="profile-avatar-row">
          <div class="profile-avatar" id="profile-avatar">${getInitials(user)}</div>
          <div class="profile-avatar-info">
            <p class="profile-avatar-name" id="profile-display-name">${user.prenom} ${user.nom}</p>
            <p class="profile-avatar-role">${getRoleLabel(user.role)}</p>
            <div class="profile-avatar-actions">
            </div>
          </div>
        </div>

        <div class="form-row">
          ${renderFormField({
            id: 'prenom',
            label: t('auth.register.prenom'),
            placeholder: 'Jean',
            icon: 'user',
            autocomplete: 'given-name',
            half: true,
            value: user.prenom,
          })}
          ${renderFormField({
            id: 'nom',
            label: t('auth.register.nom'),
            placeholder: 'Dupont',
            icon: 'user',
            autocomplete: 'family-name',
            half: true,
            value: user.nom,
          })}
        </div>
        ${renderFormField({
          id: 'email',
          label: t('auth.register.email'),
          type: 'email',
          placeholder: 'nom@exemple.com',
          icon: 'mail',
          autocomplete: 'email',
          value: user.email,
          extraLabel: `<span class="email-verified">${icons.check} ${t('profile.email_verified')}</span>`,
        })}
        ${renderFormField({
          id: 'telephone',
          label: t('auth.register.telephone'),
          type: 'tel',
          placeholder: '+212 6XX XX XX XX',
          icon: 'phone',
          autocomplete: 'tel',
          required: false,
          value: telephone,
        })}

        <div class="profile-save-bar" id="profile-save-bar" hidden>
          <div class="profile-save-actions">
            <button type="button" class="btn btn-text" id="profile-cancel-btn">${t('profile.cancel')}</button>
            <button type="submit" class="btn btn-primary btn-sm" id="profile-save-btn">
              ${icons.save} ${t('profile.save')}
            </button>
          </div>
        </div>
      </form>

      <form id="password-form" class="profile-card profile-card--password" novalidate>
        <div class="profile-card-header">
          <span class="profile-card-icon profile-card-icon--red">${icons.lock}</span>
          <div>
            <h2 class="profile-card-title">${t('profile.password_title')}</h2>
            <p class="profile-card-desc">${t('profile.password_desc')}</p>
          </div>
        </div>

        ${renderFormField({
          id: 'mot_de_passe_actuel',
          label: t('profile.current_password'),
          placeholder: '••••••••',
          icon: 'lock',
          togglePassword: true,
          autocomplete: 'current-password',
        })}
        <div class="form-row">
          ${renderFormField({
            id: 'nouveau_mot_de_passe',
            label: t('profile.new_password'),
            placeholder: '••••••••',
            icon: 'lock',
            togglePassword: true,
            autocomplete: 'new-password',
            half: true,
          })}
          ${renderFormField({
            id: 'confirmer_mot_de_passe',
            label: t('profile.confirm_password'),
            placeholder: '••••••••',
            icon: 'lock',
            togglePassword: true,
            autocomplete: 'new-password',
            half: true,
          })}
        </div>

        <div class="password-rules">
          <p class="password-rules-title">${t('profile.security_rules')}</p>
          <ul>
            <li>${t('profile.rule_1')}</li>
            <li>${t('profile.rule_2')}</li>
            <li>${t('profile.rule_3')}</li>
            <li>${t('profile.rule_4')}</li>
          </ul>
        </div>

        <div class="profile-form-actions">
          <button type="submit" class="btn btn-primary btn-action btn-action--password" id="password-submit-btn">
            ${icons.save} ${t('profile.update_password')}
          </button>
        </div>
      </form>
    </div>
  `
}

function getFormState(form: HTMLFormElement): ProfileFormState {
  const formData = new FormData(form)
  return {
    prenom: String(formData.get('prenom') ?? '').trim(),
    nom: String(formData.get('nom') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    telephone: String(formData.get('telephone') ?? '').trim(),
  }
}

function statesEqual(a: ProfileFormState, b: ProfileFormState): boolean {
  return (
    a.prenom === b.prenom &&
    a.nom === b.nom &&
    a.email === b.email &&
    a.telephone === b.telephone
  )
}

function showAlert(el: HTMLElement | null, message: string): void {
  if (!el) return
  el.textContent = message
  el.hidden = false
  setTimeout(() => {
    el.hidden = true
  }, 5000)
}

function hideAlerts(root: HTMLElement): void {
  root.querySelector<HTMLElement>('#profile-success')!.hidden = true
  root.querySelector<HTMLElement>('#profile-error')!.hidden = true
}

function setupProfileForm(root: HTMLElement, initial: ProfileFormState): void {
  const form = root.querySelector<HTMLFormElement>('#profile-form')
  const saveBar = root.querySelector<HTMLElement>('#profile-save-bar')
  const cancelBtn = root.querySelector<HTMLButtonElement>('#profile-cancel-btn')
  const saveBtn = root.querySelector<HTMLButtonElement>('#profile-save-btn')
  const successEl = root.querySelector<HTMLElement>('#profile-success')
  const errorEl = root.querySelector<HTMLElement>('#profile-error')

  if (!form || !saveBar) return

  let baseline = { ...initial }

  const updateDirtyState = (): void => {
    const current = getFormState(form)
    saveBar.hidden = statesEqual(current, baseline)
  }

  form.addEventListener('input', updateDirtyState)

  cancelBtn?.addEventListener('click', () => {
    const prenom = form.querySelector<HTMLInputElement>('#prenom')
    const nom = form.querySelector<HTMLInputElement>('#nom')
    const email = form.querySelector<HTMLInputElement>('#email')
    const telephone = form.querySelector<HTMLInputElement>('#telephone')

    if (prenom) prenom.value = baseline.prenom
    if (nom) nom.value = baseline.nom
    if (email) email.value = baseline.email
    if (telephone) telephone.value = baseline.telephone
    saveBar.hidden = true
    hideAlerts(root)
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    hideAlerts(root)
    if (saveBtn) {
      saveBtn.disabled = true
      saveBtn.classList.add('btn--loading')
    }

    try {
      const payload = getFormState(form)
      const updated = await updateProfile({
        ...payload,
        telephone: payload.telephone || undefined,
      })

      baseline = {
        prenom: updated.prenom,
        nom: updated.nom,
        email: updated.email,
        telephone: updated.telephone ?? '',
      }

      root.querySelector('#profile-display-name')!.textContent = `${updated.prenom} ${updated.nom}`
      root.querySelector('#profile-avatar')!.textContent = getInitials(updated)
      root.querySelector('.nav-link--user')!.textContent = `${updated.prenom} ${updated.nom}`

      saveBar.hidden = true
      showAlert(successEl, t('profile.success'))
    } catch (error) {
      showAlert(errorEl, formatApiErrors(error))
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false
        saveBtn.classList.remove('btn--loading')
      }
    }
  })
}

function setupPasswordForm(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('#password-form')
  const submitBtn = root.querySelector<HTMLButtonElement>('#password-submit-btn')
  const successEl = root.querySelector<HTMLElement>('#profile-success')
  const errorEl = root.querySelector<HTMLElement>('#profile-error')

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    hideAlerts(root)
    if (!form || !submitBtn) return

    submitBtn.disabled = true
    submitBtn.classList.add('btn--loading')

    const formData = new FormData(form)

    try {
      const message = await changePassword({
        mot_de_passe_actuel: String(formData.get('mot_de_passe_actuel') ?? ''),
        nouveau_mot_de_passe: String(formData.get('nouveau_mot_de_passe') ?? ''),
        confirmer_mot_de_passe: String(formData.get('confirmer_mot_de_passe') ?? ''),
      })
      form.reset()
      showAlert(successEl, message)
    } catch (error) {
      showAlert(errorEl, formatApiErrors(error))
    } finally {
      submitBtn.disabled = false
      submitBtn.classList.remove('btn--loading')
    }
  })
}

export async function mountProfilePage(root: HTMLElement): Promise<void> {
  const storedUser = getStoredUser()
  if (!storedUser) return

  root.innerHTML = renderAppLayout({
    user: storedUser,
    role: 'investisseur',
    activePage: 'profile',
    content: `
      <div class="profile-loading">
        <div class="profile-loading-spinner"></div>
        <p>${t('profile.loading')}</p>
      </div>
    `,
  })
  setupAppLayout(root)

  try {
    const user = await fetchProfile()
    root.querySelector('.app-content')!.innerHTML = renderProfileContent(user)
    setupPasswordToggles(root)

    const initial: ProfileFormState = {
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      telephone: user.telephone ?? '',
    }

    setupProfileForm(root, initial)
    setupPasswordForm(root)
  } catch {
    root.querySelector('.app-content')!.innerHTML = `
      <div class="profile-error-state">
        <p>${t('profile.error')}</p>
        <button type="button" class="btn btn-primary" onclick="location.reload()">${t('profile.retry')}</button>
      </div>
    `
  }
}

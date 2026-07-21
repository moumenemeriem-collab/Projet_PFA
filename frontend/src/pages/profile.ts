import { icons } from '../components/icons.ts'
import { renderDashboardLayout, setupDashboardLayout } from '../components/layout/DashboardLayout.ts'
import { renderFormField, setupPasswordToggles } from '../components/ui/FormField.ts'
import { formatApiErrors, getStoredUser, type Utilisateur } from '../api/auth.ts'
import {
  changePassword,
  fetchProfile,
  getInitials,
  getRoleLabel,
  updateProfile,
} from '../api/profile.ts'

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
        <h1 class="profile-title">Mon Profil Utilisateur</h1>
        <p class="profile-subtitle">Gérez vos informations personnelles et vos paramètres de sécurité.</p>
      </header>

      <div id="profile-success" class="form-alert form-alert--success" hidden></div>
      <div id="profile-error" class="form-alert form-alert--error" hidden></div>

      <form id="profile-form" class="profile-card" novalidate>
        <div class="profile-card-header">
          <span class="profile-card-icon profile-card-icon--blue">${icons.user}</span>
          <div>
            <h2 class="profile-card-title">Informations générales</h2>
            <p class="profile-card-desc">Ces détails sont utilisés pour les rapports d'analyse de parcelles.</p>
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
            label: 'Prénom',
            placeholder: 'Jean',
            icon: 'user',
            autocomplete: 'given-name',
            half: true,
            value: user.prenom,
          })}
          ${renderFormField({
            id: 'nom',
            label: 'Nom',
            placeholder: 'Dupont',
            icon: 'user',
            autocomplete: 'family-name',
            half: true,
            value: user.nom,
          })}
        </div>
        ${renderFormField({
          id: 'email',
          label: 'Email professionnel',
          type: 'email',
          placeholder: 'nom@exemple.com',
          icon: 'mail',
          autocomplete: 'email',
          value: user.email,
          extraLabel: `<span class="email-verified">${icons.check} Email vérifié</span>`,
        })}
        ${renderFormField({
          id: 'telephone',
          label: 'Numéro de téléphone',
          type: 'tel',
          placeholder: '+212 6XX XX XX XX',
          icon: 'phone',
          autocomplete: 'tel',
          required: false,
          value: telephone,
        })}

        <div class="profile-save-bar" id="profile-save-bar" hidden>
          <div class="profile-save-actions">
            <button type="button" class="btn btn-text" id="profile-cancel-btn">Annuler les changements</button>
            <button type="submit" class="btn btn-primary btn-sm" id="profile-save-btn">
              ${icons.save} Sauvegarder
            </button>
          </div>
        </div>
      </form>

      <form id="password-form" class="profile-card profile-card--password" novalidate>
        <div class="profile-card-header">
          <span class="profile-card-icon profile-card-icon--red">${icons.lock}</span>
          <div>
            <h2 class="profile-card-title">Changer le mot de passe</h2>
            <p class="profile-card-desc">Mettez à jour votre mot de passe pour sécuriser votre compte.</p>
          </div>
        </div>

        ${renderFormField({
          id: 'mot_de_passe_actuel',
          label: 'Mot de passe actuel',
          placeholder: '••••••••',
          icon: 'lock',
          togglePassword: true,
          autocomplete: 'current-password',
        })}
        <div class="form-row">
          ${renderFormField({
            id: 'nouveau_mot_de_passe',
            label: 'Nouveau mot de passe',
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

        <div class="password-rules">
          <p class="password-rules-title">Règles de sécurité :</p>
          <ul>
            <li>Minimum 8 caractères</li>
            <li>Au moins une majuscule et un chiffre</li>
            <li>Éviter les mots de passe courants</li>
            <li>Différent de vos informations personnelles</li>
          </ul>
        </div>

        <div class="profile-form-actions">
          <button type="submit" class="btn btn-primary btn-action btn-action--password" id="password-submit-btn">
            ${icons.save} Mettre à jour le mot de passe
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
      showAlert(successEl, 'Profil mis à jour avec succès.')
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

  root.innerHTML = renderDashboardLayout({
    user: storedUser,
    activePage: 'profile',
    content: `
      <div class="profile-loading">
        <div class="profile-loading-spinner"></div>
        <p>Chargement du profil…</p>
      </div>
    `,
  })
  setupDashboardLayout(root)

  try {
    const user = await fetchProfile()
    root.querySelector('.dashboard-content')!.innerHTML = renderProfileContent(user)
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
    root.querySelector('.dashboard-content')!.innerHTML = `
      <div class="profile-error-state">
        <p>Impossible de charger votre profil.</p>
        <button type="button" class="btn btn-primary" onclick="location.reload()">Réessayer</button>
      </div>
    `
  }
}

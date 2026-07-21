import { icons } from '../../components/icons.ts'
import { renderAdminLayout, setupAdminLayout } from '../../components/layout/AdminLayout.ts'
import { renderFormField, setupPasswordToggles } from '../../components/ui/FormField.ts'
import { formatApiErrors, getStoredUser, type Utilisateur } from '../../api/auth.ts'
import {
  changePassword,
  fetchProfile,
  getInitials,
  getRoleLabel,
  updateProfile,
} from '../../api/profile.ts'

interface ProfileFormState {
  prenom: string
  nom: string
  email: string
  telephone: string
}

function renderAdminProfileContent(user: Utilisateur): string {
  const telephone = user.telephone ?? ''

  return `
    <div class="admin-profile-page">
      <header class="admin-profile-header">
        <div>
          <h2 class="admin-profile-title">Mon Profil</h2>
          <p class="admin-profile-desc">Gérez vos informations personnelles et vos paramètres de sécurité.</p>
        </div>
      </header>

      <div id="profile-success" class="form-alert form-alert--success" hidden></div>
      <div id="profile-error" class="form-alert form-alert--error" hidden></div>

      <form id="profile-form" class="admin-profile-card" novalidate>
        <div class="admin-profile-card-header">
          <span class="admin-profile-card-icon admin-profile-card-icon--blue">${icons.user}</span>
          <div>
            <h3 class="admin-profile-card-title">Informations générales</h3>
            <p class="admin-profile-card-desc">Ces détails sont utilisés pour l'administration de la plateforme.</p>
          </div>
        </div>

        <div class="admin-profile-avatar-row">
          <div class="admin-profile-avatar" id="admin-profile-avatar">${getInitials(user)}</div>
          <div class="admin-profile-avatar-info">
            <p class="admin-profile-avatar-name" id="admin-profile-display-name">${user.prenom} ${user.nom}</p>
            <p class="admin-profile-avatar-role">${getRoleLabel(user.role)}</p>
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

        <div class="admin-profile-save-bar" id="admin-profile-save-bar" hidden>
          <div class="admin-profile-save-actions">
            <button type="button" class="btn btn-text" id="admin-profile-cancel-btn">Annuler les changements</button>
            <button type="submit" class="btn btn-primary btn-sm" id="admin-profile-save-btn">
              ${icons.save} Sauvegarder
            </button>
          </div>
        </div>
      </form>

      <form id="password-form" class="admin-profile-card admin-profile-card--password" novalidate>
        <div class="admin-profile-card-header">
          <span class="admin-profile-card-icon admin-profile-card-icon--red">${icons.lock}</span>
          <div>
            <h3 class="admin-profile-card-title">Changer le mot de passe</h3>
            <p class="admin-profile-card-desc">Mettez à jour votre mot de passe pour sécuriser votre compte.</p>
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

        <div class="admin-profile-form-actions">
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
  const saveBar = root.querySelector<HTMLElement>('#admin-profile-save-bar')
  const cancelBtn = root.querySelector<HTMLButtonElement>('#admin-profile-cancel-btn')
  const saveBtn = root.querySelector<HTMLButtonElement>('#admin-profile-save-btn')
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

      root.querySelector('#admin-profile-display-name')!.textContent = `${updated.prenom} ${updated.nom}`
      root.querySelector('#admin-profile-avatar')!.textContent = getInitials(updated)

      const topbarName = root.querySelector('.admin-topbar-user-name')
      if (topbarName) topbarName.textContent = `${updated.prenom} ${updated.nom}`

      const topbarAvatar = root.querySelector('.admin-topbar-avatar')
      if (topbarAvatar) topbarAvatar.textContent = `${updated.prenom.charAt(0)}${updated.nom.charAt(0)}`

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

export async function mountAdminProfilePage(root: HTMLElement): Promise<void> {
  const storedUser = getStoredUser()
  if (!storedUser) return

  root.innerHTML = renderAdminLayout({
    user: storedUser,
    activePage: 'profile',
    content: `
      <div class="admin-loading">
        <div class="admin-loading-spinner"></div>
        <p>Chargement du profil…</p>
      </div>
    `,
  })
  setupAdminLayout(root)

  try {
    const user = await fetchProfile()
    root.querySelector('.admin-content')!.innerHTML = renderAdminProfileContent(user)
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
    root.querySelector('.admin-content')!.innerHTML = `
      <div class="admin-error-state">
        <p>Impossible de charger votre profil.</p>
        <a href="/login" class="btn btn-primary">Se reconnecter</a>
      </div>
    `
  }
}

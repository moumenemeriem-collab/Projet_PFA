import { useEffect, useRef, useState } from 'react'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { FormField } from '../components/FormField'
import { formatApiErrors, type Utilisateur } from '../api/auth'
import {
  changePassword,
  fetchProfile,
  getInitials,
  getRoleLabel,
  updateProfile,
} from '../api/profile'
import { t } from '../i18n/index'

interface ProfileFormState {
  prenom: string
  nom: string
  email: string
  telephone: string
}

export function ProfilePage(): React.JSX.Element {
  const [profile, setProfile] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSuccess = (message: string): void => {
    setSuccess(message)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setSuccess(''), 5000)
  }

  const showError = (message: string): void => {
    setError(message)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(''), 5000)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    fetchProfile()
      .then((user) => {
        if (cancelled) return
        setProfile(user)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const baseline: ProfileFormState | null = profile
    ? {
        prenom: profile.prenom,
        nom: profile.nom,
        email: profile.email,
        telephone: profile.telephone ?? '',
      }
    : null

  const handleProfileInput = (e: React.FormEvent<HTMLFormElement>): void => {
    if (!baseline) return
    const formData = new FormData(e.currentTarget)
    const current: ProfileFormState = {
      prenom: String(formData.get('prenom') ?? '').trim(),
      nom: String(formData.get('nom') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      telephone: String(formData.get('telephone') ?? '').trim(),
    }
    setDirty(
      !(
        current.prenom === baseline.prenom &&
        current.nom === baseline.nom &&
        current.email === baseline.email &&
        current.telephone === baseline.telephone
      ),
    )
  }

  const handleCancel = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const form = e.currentTarget.closest('form') as HTMLFormElement
    form.reset()
    setDirty(false)
    setSuccess('')
    setError('')
  }

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!profile) return
    const formData = new FormData(e.currentTarget)
    setSaving(true)
    setSuccess('')
    setError('')
    try {
      const updated = await updateProfile({
        prenom: String(formData.get('prenom') ?? '').trim(),
        nom: String(formData.get('nom') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        telephone: String(formData.get('telephone') ?? '').trim() || undefined,
      })
      setProfile(updated)
      setDirty(false)
      showSuccess(t('profile.success'))
    } catch (err) {
      showError(formatApiErrors(err))
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setPwSaving(true)
    setSuccess('')
    setError('')
    try {
      const message = await changePassword({
        mot_de_passe_actuel: String(formData.get('mot_de_passe_actuel') ?? ''),
        nouveau_mot_de_passe: String(formData.get('nouveau_mot_de_passe') ?? ''),
        confirmer_mot_de_passe: String(formData.get('confirmer_mot_de_passe') ?? ''),
      })
      e.currentTarget.reset()
      showSuccess(message)
    } catch (err) {
      showError(formatApiErrors(err))
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="investisseur" activePage="profile">
        <div className="profile-loading">
          <div className="profile-loading-spinner"></div>
          <p>{t('profile.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (failed || !profile) {
    return (
      <DashboardLayout role="investisseur" activePage="profile">
        <div className="profile-error-state">
          <p>{t('profile.error')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
            {t('profile.retry')}
          </button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="investisseur" activePage="profile">
      <div className="profile-page">
        <header className="profile-page-header">
          <h1 className="profile-title">{t('profile.title')}</h1>
          <p className="profile-subtitle">{t('profile.subtitle')}</p>
        </header>

        <div id="profile-success" className="form-alert form-alert--success" hidden={!success}>
          {success}
        </div>
        <div id="profile-error" className="form-alert form-alert--error" hidden={!error}>
          {error}
        </div>

        <form
          id="profile-form"
          className="profile-card"
          noValidate
          key={`${profile.prenom}|${profile.nom}|${profile.email}|${profile.telephone ?? ''}`}
          onSubmit={handleProfileSubmit}
          onInput={handleProfileInput}
        >
          <div className="profile-card-header">
            <span className="profile-card-icon profile-card-icon--blue">{icons.user}</span>
            <div>
              <h2 className="profile-card-title">{t('profile.general_title')}</h2>
              <p className="profile-card-desc">{t('profile.general_desc')}</p>
            </div>
          </div>

          <div className="profile-avatar-row">
            <div className="profile-avatar">{getInitials(profile)}</div>
            <div className="profile-avatar-info">
              <p className="profile-avatar-name">{profile.prenom} {profile.nom}</p>
              <p className="profile-avatar-role">{getRoleLabel(profile.role)}</p>
              <div className="profile-avatar-actions"></div>
            </div>
          </div>

          <div className="form-row">
            <FormField
              id="prenom"
              label={t('auth.register.prenom')}
              placeholder="Jean"
              icon="user"
              autocomplete="given-name"
              half
              defaultValue={profile.prenom}
            />
            <FormField
              id="nom"
              label={t('auth.register.nom')}
              placeholder="Dupont"
              icon="user"
              autocomplete="family-name"
              half
              defaultValue={profile.nom}
            />
          </div>
          <FormField
            id="email"
            label={t('auth.register.email')}
            type="email"
            placeholder="nom@exemple.com"
            icon="mail"
            autocomplete="email"
            defaultValue={profile.email}
            extraLabel={
              <span className="email-verified">{icons.check} {t('profile.email_verified')}</span>
            }
          />
          <FormField
            id="telephone"
            label={t('auth.register.telephone')}
            type="tel"
            placeholder="+212 6XX XX XX XX"
            icon="phone"
            autocomplete="tel"
            required={false}
            defaultValue={profile.telephone ?? ''}
          />

          <div className="profile-save-bar" hidden={!dirty}>
            <div className="profile-save-actions">
              <button type="button" className="btn btn-text" onClick={handleCancel}>{t('profile.cancel')}</button>
              <button type="submit" className={saving ? 'btn btn-primary btn-sm btn--loading' : 'btn btn-primary btn-sm'} disabled={saving}>
                {icons.save} {t('profile.save')}
              </button>
            </div>
          </div>
        </form>

        <form id="password-form" className="profile-card profile-card--password" noValidate onSubmit={handlePasswordSubmit}>
          <div className="profile-card-header">
            <span className="profile-card-icon profile-card-icon--red">{icons.lock}</span>
            <div>
              <h2 className="profile-card-title">{t('profile.password_title')}</h2>
              <p className="profile-card-desc">{t('profile.password_desc')}</p>
            </div>
          </div>

          <FormField
            id="mot_de_passe_actuel"
            label={t('profile.current_password')}
            placeholder="••••••••"
            icon="lock"
            togglePassword
            autocomplete="current-password"
          />
          <div className="form-row">
            <FormField
              id="nouveau_mot_de_passe"
              label={t('profile.new_password')}
              placeholder="••••••••"
              icon="lock"
              togglePassword
              autocomplete="new-password"
              half
            />
            <FormField
              id="confirmer_mot_de_passe"
              label={t('profile.confirm_password')}
              placeholder="••••••••"
              icon="lock"
              togglePassword
              autocomplete="new-password"
              half
            />
          </div>

          <div className="password-rules">
            <p className="password-rules-title">{t('profile.security_rules')}</p>
            <ul>
              <li>{t('profile.rule_1')}</li>
              <li>{t('profile.rule_2')}</li>
              <li>{t('profile.rule_3')}</li>
              <li>{t('profile.rule_4')}</li>
            </ul>
          </div>

          <div className="profile-form-actions">
            <button
              type="submit"
              className={pwSaving ? 'btn btn-primary btn-action btn-action--password btn--loading' : 'btn btn-primary btn-action btn-action--password'}
              disabled={pwSaving}
            >
              {icons.save} {t('profile.update_password')}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}

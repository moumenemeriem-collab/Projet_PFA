import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { icons } from '../../components/icons'
import { DashboardLayout } from '../../components/DashboardLayout'
import { FormField } from '../../components/FormField'
import { formatApiErrors, type Utilisateur } from '../../api/auth'
import {
  changePassword,
  fetchProfile,
  getInitials,
  getRoleLabel,
  updateProfile,
} from '../../api/profile'
import { t } from '../../i18n/index'

interface ProfileFormState {
  prenom: string
  nom: string
  email: string
  telephone: string
}

export function AdminProfilePage(): React.JSX.Element {
  const [profile, setProfile] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
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
  }, [])

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
      showSuccess(t('admin_profile.success'))
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
      <DashboardLayout role="admin" activePage="profile">
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>{t('admin_profile.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (failed || !profile) {
    return (
      <DashboardLayout role="admin" activePage="profile">
        <div className="admin-error-state">
          <p>{t('admin_profile.error')}</p>
          <Link to="/login" className="btn btn-primary">{t('admin_profile.retry')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="admin" activePage="profile">
      <div className="admin-profile-page">
        <header className="admin-profile-header">
          <div>
            <h2 className="admin-profile-title">{t('admin_profile.title')}</h2>
            <p className="admin-profile-desc">{t('admin_profile.subtitle')}</p>
          </div>
        </header>

        <div id="profile-success" className="form-alert form-alert--success" hidden={!success}>
          {success}
        </div>
        <div id="profile-error" className="form-alert form-alert--error" hidden={!error}>
          {error}
        </div>

        <form
          id="profile-form"
          className="admin-profile-card"
          noValidate
          key={`${profile.prenom}|${profile.nom}|${profile.email}|${profile.telephone ?? ''}`}
          onSubmit={(e) => { void handleProfileSubmit(e) }}
          onInput={handleProfileInput}
        >
          <div className="admin-profile-card-header">
            <span className="admin-profile-card-icon admin-profile-card-icon--blue">{icons.user}</span>
            <div>
              <h3 className="admin-profile-card-title">{t('admin_profile.general_title')}</h3>
              <p className="admin-profile-card-desc">{t('admin_profile.general_desc')}</p>
            </div>
          </div>

          <div className="admin-profile-avatar-row">
            <div className="admin-profile-avatar" id="admin-profile-avatar">{getInitials(profile)}</div>
            <div className="admin-profile-avatar-info">
              <p className="admin-profile-avatar-name" id="admin-profile-display-name">{profile.prenom} {profile.nom}</p>
              <p className="admin-profile-avatar-role">{getRoleLabel(profile.role)}</p>
            </div>
          </div>

          <div className="form-row">
            <FormField
              id="prenom"
              label={t('admin_profile.field_prenom')}
              placeholder="Jean"
              icon="user"
              autocomplete="given-name"
              half
              defaultValue={profile.prenom}
            />
            <FormField
              id="nom"
              label={t('admin_profile.field_nom')}
              placeholder="Dupont"
              icon="user"
              autocomplete="family-name"
              half
              defaultValue={profile.nom}
            />
          </div>
          <FormField
            id="email"
            label={t('admin_profile.field_email')}
            type="email"
            placeholder="nom@exemple.com"
            icon="mail"
            autocomplete="email"
            defaultValue={profile.email}
            extraLabel={
              <span className="email-verified">{icons.check} {t('admin_profile.email_verified')}</span>
            }
          />
          <FormField
            id="telephone"
            label={t('admin_profile.field_telephone')}
            type="tel"
            placeholder="+212 6XX XX XX XX"
            icon="phone"
            autocomplete="tel"
            required={false}
            defaultValue={profile.telephone ?? ''}
          />

          <div className="admin-profile-save-bar" hidden={!dirty}>
            <div className="admin-profile-save-actions">
              <button type="button" className="btn btn-text" onClick={handleCancel}>{t('admin_profile.cancel')}</button>
              <button type="submit" className={saving ? 'btn btn-primary btn-sm btn--loading' : 'btn btn-primary btn-sm'} disabled={saving}>
                {icons.save} {t('admin_profile.save')}
              </button>
            </div>
          </div>
        </form>

        <form id="password-form" className="admin-profile-card admin-profile-card--password" noValidate onSubmit={(e) => { void handlePasswordSubmit(e) }}>
          <div className="admin-profile-card-header">
            <span className="admin-profile-card-icon admin-profile-card-icon--red">{icons.lock}</span>
            <div>
              <h3 className="admin-profile-card-title">{t('admin_profile.password_title')}</h3>
              <p className="admin-profile-card-desc">{t('admin_profile.password_desc')}</p>
            </div>
          </div>

          <FormField
            id="mot_de_passe_actuel"
            label={t('admin_profile.current_password')}
            placeholder="••••••••"
            icon="lock"
            togglePassword
            autocomplete="current-password"
          />
          <div className="form-row">
            <FormField
              id="nouveau_mot_de_passe"
              label={t('admin_profile.new_password')}
              placeholder="••••••••"
              icon="lock"
              togglePassword
              autocomplete="new-password"
              half
            />
            <FormField
              id="confirmer_mot_de_passe"
              label={t('admin_profile.confirm_password')}
              placeholder="••••••••"
              icon="lock"
              togglePassword
              autocomplete="new-password"
              half
            />
          </div>

          <div className="password-rules">
            <p className="password-rules-title">{t('admin_profile.security_rules')}</p>
            <ul>
              <li>{t('admin_profile.rule_1')}</li>
              <li>{t('admin_profile.rule_2')}</li>
              <li>{t('admin_profile.rule_3')}</li>
              <li>{t('admin_profile.rule_4')}</li>
            </ul>
          </div>

          <div className="admin-profile-form-actions">
            <button
              type="submit"
              className={pwSaving ? 'btn btn-primary btn-action btn-action--password btn--loading' : 'btn btn-primary btn-action btn-action--password'}
              disabled={pwSaving}
            >
              {icons.save} {t('admin_profile.update_password')}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}

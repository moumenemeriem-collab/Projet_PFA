import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { icons } from '../components/icons'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { formatApiErrors, getPostAuthRedirect, register, saveSession } from '../api/auth'
import { t } from '../i18n/index'

export function RegisterPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const benefits = [
    t('auth.register.benefit_1'),
    t('auth.register.benefit_2'),
    t('auth.register.benefit_3'),
  ]

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)

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
      navigate(getPostAuthRedirect(response.utilisateur.role))
    } catch (err) {
      setError(formatApiErrors(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      activePage="register"
      wide
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.has_account')}{' '}
          <Link to="/login" className="form-link form-link--strong">
            {t('auth.register.login_link')}
          </Link>
        </>
      }
      pageFooter={
        <div className="register-footer-status">
          <span>{t('auth.register.instance_label')}</span>
          <span className="status-dot">
            <span></span> {t('auth.register.servers_status')}
          </span>
        </div>
      }
    >
      <form id="register-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        <div id="register-error" className="form-alert form-alert--error" hidden={!error}>
          {error}
        </div>
        <div className="form-row">
          <FormField
            id="prenom"
            label={t('auth.register.prenom')}
            placeholder="Jean"
            icon="user"
            autocomplete="given-name"
            half
          />
          <FormField
            id="nom"
            label={t('auth.register.nom')}
            placeholder="Dupont"
            icon="user"
            autocomplete="family-name"
            half
          />
        </div>
        <div className="form-row">
          <FormField
            id="email"
            label={t('auth.register.email')}
            type="email"
            placeholder="nom@exemple.com"
            icon="mail"
            autocomplete="email"
            half
          />
          <FormField
            id="telephone"
            label={t('auth.register.telephone')}
            type="tel"
            placeholder="+212 6XX XX XX XX"
            icon="phone"
            autocomplete="tel"
            required={false}
            half
          />
        </div>
        <div className="form-row">
          <FormField
            id="mot_de_passe"
            label={t('auth.register.password')}
            placeholder="••••••••"
            icon="lock"
            togglePassword
            autocomplete="new-password"
            half
          />
          <FormField
            id="confirmer_mot_de_passe"
            label={t('auth.register.confirm_password')}
            placeholder="••••••••"
            icon="lock"
            togglePassword
            autocomplete="new-password"
            half
          />
        </div>
        <label className="checkbox-field">
          <input type="checkbox" name="cgu" required />
          <span>
            {t('auth.register.cgu')}
            <a href="#" className="form-link">
              {t('auth.register.cgu_link')}
            </a>
            {t('auth.register.cgu_and')}
            <a href="#" className="form-link">
              {t('auth.register.privacy_link')}
            </a>.
          </span>
        </label>
        <button
          type="submit"
          className={loading ? 'btn btn-primary btn-block btn--loading' : 'btn btn-primary btn-block'}
          id="register-submit"
          disabled={loading}
        >
          {t('auth.register.submit')} {icons.chevron}
        </button>
        <div className="benefits">
          <h3 className="benefits-title">{t('auth.register.why_join')}</h3>
          <ul className="benefits-list">
            {benefits.map((item) => (
              <li key={item}>
                <span className="benefits-check">{icons.check}</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </form>
    </AuthLayout>
  )
}

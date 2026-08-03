import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { icons } from '../components/icons'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { formatApiErrors, getPostAuthRedirect, login, saveSession } from '../api/auth'
import { t } from '../i18n/index'

export function LoginPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const response = await login({
        email: String(formData.get('email') ?? ''),
        mot_de_passe: String(formData.get('mot_de_passe') ?? ''),
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
      activePage="login"
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.no_account')}{' '}
          <Link to="/register" className="form-link form-link--strong">
            {t('auth.login.create_account')}
          </Link>
        </>
      }
    >
      <form id="login-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        <div id="login-error" className="form-alert form-alert--error" hidden={!error}>
          {error}
        </div>
        <FormField
          id="email"
          label={t('auth.login.email_label')}
          type="email"
          placeholder="nom@exemple.com"
          icon="mail"
          autocomplete="email"
        />
        <FormField
          id="mot_de_passe"
          label={t('auth.login.password_label')}
          placeholder="••••••••"
          icon="lock"
          togglePassword
          autocomplete="current-password"
          extraLabel={
            <a href="#" className="form-link">
              {t('auth.login.forgot_password')}
            </a>
          }
        />
        <button
          type="submit"
          className={loading ? 'btn btn-primary btn-block btn--loading' : 'btn btn-primary btn-block'}
          id="login-submit"
          disabled={loading}
        >
          {t('auth.login.submit')} {icons.chevron}
        </button>
      </form>
    </AuthLayout>
  )
}

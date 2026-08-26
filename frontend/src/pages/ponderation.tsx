import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DashboardLayout } from '../components/DashboardLayout'
import { PonderationWizard } from '../components/ponderation/PonderationWizard'
import { fetchProjet, type Projet } from '../api/projets'
import { formatApiErrors } from '../api/auth'
import { t } from '../i18n/index'

export function PonderationPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const projetId = Number(id)
  const [projet, setProjet] = useState<Projet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !Number.isInteger(projetId) || projetId <= 0) {
      navigate('/projets', { replace: true })
    }
  }, [id, projetId, navigate])

  useEffect(() => {
    if (!projetId) return
    let cancelled = false
    setLoading(true)
    fetchProjet(projetId)
      .then((p) => {
        if (cancelled) return
        setProjet(p)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(formatApiErrors(err))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [projetId])

  if (loading && !error) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" projectContext={null}>
        <div className="admin-loading">
          <div className="admin-loading-spinner" />
          <p>{t('ranking.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !projet) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" projectContext={null}>
        <div className="admin-error-state">
          <p>{error ?? t('ranking.loading')}</p>
          <Link to="/projets" className="btn btn-primary">{t('projects.error_login')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout role="investisseur" activePage="ranking" projectContext={{ id: projet.id, name: projet.nom }}>
      <PonderationWizard projetId={projetId} />
    </DashboardLayout>
  )
}

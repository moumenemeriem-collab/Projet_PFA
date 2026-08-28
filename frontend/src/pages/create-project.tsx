import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { createProjet, fetchTypesProjet, type ProjetPayload, type TypeProjet } from '../api/projets'
import { formatApiErrors } from '../api/auth'
import { t } from '../i18n/index'
import gisBg from '../assets/features/create_project.jpg'

export function CreateProjectPage(): React.JSX.Element {
  const navigate = useNavigate()

  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [types, setTypes] = useState<TypeProjet[]>([])
  const [typeId, setTypeId] = useState<number | null>(null)

  const [alert, setAlert] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchTypesProjet().then(setTypes).catch(() => setTypes([]))
  }, [])

  const handleSubmit = async (): Promise<void> => {
    const nomVal = nom.trim()
    if (!nomVal || !typeId) {
      setAlert(t('projects.validation_required'))
      return
    }
    setAlert(null)
    setSubmitting(true)
    try {
      const payload: ProjetPayload = {
        nom: nomVal,
        description: description.trim(),
        id_type: typeId,
        surface_souhaitee: 0,
        budget_total: 0,
      }
      const projet = await createProjet(payload)
      navigate(`/projets/${projet.id}/classement`)
    } catch (err) {
      setAlert(formatApiErrors(err))
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout role="investisseur" activePage="projects">
      <div className="cp-page">
        <div className="cp-header">
          <div>
            <div className="cp-breadcrumb">{t('projects.title').toUpperCase()} / {t('projects.new')}</div>
            <h1 className="cp-title">{t('projects.create_title')}</h1>
            <p className="cp-subtitle">{t('projects.create_subtitle')}</p>
          </div>
          <div className="cp-header-actions">
            <Link to="/projets" className="btn btn-outline">{t('projects.btn_cancel')}</Link>
          </div>
        </div>

        <div className="cp-divider"></div>

        {alert && <div className="cp-alert cp-alert--error">{alert}</div>}

        <div className="cp-grid">
          <div className="cp-left-col">

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="document" className="cp-card-icon" />
                {t('projects.section_basics')}
              </h2>
              <div className="cp-field">
                <label className="cp-label">{t('projects.field_name_label')} <span className="cp-required">*</span></label>
                <input type="text" className="cp-input" placeholder={t('projects.field_name_placeholder')} value={nom} onChange={e => setNom(e.target.value)} />
              </div>
              <div className="cp-field" style={{ marginTop: 12 }}>
                <label className="cp-label">{t('projects.field_type_label')} <span className="cp-required">*</span></label>
                <select className="cp-input" value={typeId === null ? '' : typeId} onChange={e => setTypeId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">{t('projects.field_type_placeholder')}</option>
                  {types.map((tp) => <option key={tp.id} value={tp.id}>{tp.nom}</option>)}
                </select>
              </div>
              <div className="cp-field" style={{ marginTop: 12 }}>
                <label className="cp-label">{t('projects.field_description_label')}</label>
                <textarea className="cp-input cp-textarea" rows={3} placeholder={t('projects.field_description_placeholder')} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </section>

          </div>

          <div className="cp-right-col">
            <div className="cp-gis-card" style={{ backgroundImage: `linear-gradient(to top, rgba(13,27,72,.88), rgba(13,27,72,.15)), url('${gisBg}')` }}>
              <div className="cp-gis-content">
                <span className="cp-gis-eyebrow">{t('projects.gis_badge')}</span>
                <h3 className="cp-gis-title">{t('projects.gis_title')}</h3>
                <p className="cp-gis-text">{t('projects.gis_description')}</p>
              </div>
            </div>

            <div className="cp-tips-card">
              <div className="cp-tips-title">
                <div className="cp-tips-icon">&#10003;</div>
                <span>{t('projects.tips_title')}</span>
              </div>
              <ol className="cp-tips-list">
                <li>
                  <span className="cp-tips-num">1</span>
                  <p>{t('projects.tip1')}</p>
                </li>
                <li>
                  <span className="cp-tips-num">2</span>
                  <p>{t('projects.tip2')}</p>
                </li>
                <li>
                  <span className="cp-tips-num">3</span>
                  <p>{t('projects.tip3')}</p>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="cp-footer">
          <span className="cp-footer-note">{t('common.required_fields')}</span>
          <div className="cp-footer-actions">
            <button type="button" className="btn btn-outline" disabled={submitting} onClick={() => { setNom(''); setDescription(''); setTypeId(null); setAlert(null) }}>
              {t('common.reset')}
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => { void handleSubmit() }}>
              {submitting ? <><span className="cp-spinner"></span> {t('projects.btn_creating')}</> : <>{icons.plus} {t('projects.btn_create_project')}</>}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

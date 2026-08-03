import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { createProjet, fetchTypesProjet, type ProjetPayload, type TypeProjet } from '../api/projets'
import { formatApiErrors } from '../api/auth'
import { t } from '../i18n/index'
import gisBg from '../assets/features/create_project.jpg'

interface CreateFormValues {
  nom: string
  id_type: string
  description: string
  surface_souhaitee: string
  budget_total: string
  nombre_unites: string
  prix_terrain: string
  cout_construction: string
  surface_construite: string
  autres_charges: string
  prix_vente_unitaire: string
  revenu_estime: string
  image: string
}

const EMPTY_FORM: CreateFormValues = {
  nom: '',
  id_type: '',
  description: '',
  surface_souhaitee: '',
  budget_total: '',
  nombre_unites: '',
  prix_terrain: '',
  cout_construction: '',
  surface_construite: '',
  autres_charges: '',
  prix_vente_unitaire: '',
  revenu_estime: '',
  image: '',
}

export function CreateProjectPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [allTypes, setAllTypes] = useState<TypeProjet[]>([])
  const [form, setForm] = useState<CreateFormValues>(EMPTY_FORM)
  const [alert, setAlert] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchTypesProjet().then(setAllTypes).catch(() => setAllTypes([]))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const buildPayload = (): ProjetPayload | null => {
    const nom = form.nom.trim()
    const id_type = Number(form.id_type)
    const surface_souhaitee = Number(form.surface_souhaitee)
    const budget_total = Number(form.budget_total)
    const description = form.description.trim()
    if (!nom || !id_type || !surface_souhaitee || !budget_total) return null
    const val = (v: string): number | null => (v ? Number(v) : null)
    return {
      nom,
      id_type,
      surface_souhaitee,
      budget_total,
      description,
      nombre_unites: val(form.nombre_unites),
      surface_construite: val(form.surface_construite),
      prix_terrain: val(form.prix_terrain),
      cout_construction: val(form.cout_construction),
      autres_charges: val(form.autres_charges),
      prix_vente_unitaire: val(form.prix_vente_unitaire),
      revenu_estime: val(form.revenu_estime),
      image: form.image.trim(),
    }
  }

  const handleSubmit = async (): Promise<void> => {
    const payload = buildPayload()
    if (!payload) {
      setAlert(t('projects.validation_required'))
      return
    }
    setAlert(null)
    setSubmitting(true)
    try {
      const projet = await createProjet(payload)
      navigate(`/projets/${projet.id}/classement`)
    } catch (err) {
      setAlert(formatApiErrors(err))
      setSubmitting(false)
    }
  }

  const resetForm = (): void => {
    setForm(EMPTY_FORM)
    setAlert(null)
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

        <div id="cp-alert" className="cp-alert cp-alert--error" hidden={!alert}>{alert}</div>

        <div className="cp-grid">
          <div className="cp-left-col">
            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="document" className="cp-card-icon" />
                {t('projects.section_basics')}
              </h2>
              <div className="cp-row">
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-nom">
                    {t('projects.field_name_label')} <span className="cp-required">*</span>
                  </label>
                  <input type="text" id="cp-nom" name="nom" className="cp-input" placeholder={t('projects.field_name_placeholder')} value={form.nom} onChange={handleChange} />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-type">
                    {t('projects.field_type_label')} <span className="cp-required">*</span>
                  </label>
                  <select id="cp-type" name="id_type" className="cp-input cp-select" value={form.id_type} onChange={handleChange}>
                    {allTypes.map((tp) => <option key={tp.id} value={tp.id}>{tp.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="cp-field">
                <label className="cp-label" htmlFor="cp-description">{t('projects.field_description_label')}</label>
                <textarea id="cp-description" name="description" className="cp-input cp-textarea" rows={3} placeholder={t('projects.field_description_placeholder')} value={form.description} onChange={handleChange}></textarea>
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="trending" className="cp-card-icon" />
                {t('projects.section_land')}
              </h2>
              <div className="cp-row cp-row-3">
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-surface">
                    {t('projects.field_surface_label')} <span className="cp-required">*</span>
                  </label>
                  <input type="number" step="0.01" id="cp-surface" name="surface_souhaitee" className="cp-input" placeholder="500" value={form.surface_souhaitee} onChange={handleChange} />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-budget">
                    {t('projects.field_budget_label')} <span className="cp-required">*</span>
                  </label>
                  <input type="number" step="0.01" id="cp-budget" name="budget_total" className="cp-input" placeholder="500000" value={form.budget_total} onChange={handleChange} />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-unites">{t('projects.field_units_label')}</label>
                  <input type="number" id="cp-unites" name="nombre_unites" className="cp-input" placeholder="20" value={form.nombre_unites} onChange={handleChange} />
                </div>
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="euro" className="cp-card-icon" />
                {t('projects.section_financial')}
              </h2>
              <div className="cp-row">
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-prix-terrain">{t('projects.field_land_price')}</label>
                  <input type="number" step="0.01" id="cp-prix-terrain" name="prix_terrain" className="cp-input" placeholder="400000" value={form.prix_terrain} onChange={handleChange} />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-cout">{t('projects.field_construction_cost')}</label>
                  <input type="number" step="0.01" id="cp-cout" name="cout_construction" className="cp-input" placeholder="300000" value={form.cout_construction} onChange={handleChange} />
                </div>
              </div>
              <div className="cp-row">
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-surface-construite">{t('projects.field_built_area')}</label>
                  <input type="number" step="0.01" id="cp-surface-construite" name="surface_construite" className="cp-input" placeholder="0" value={form.surface_construite} onChange={handleChange} />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-charges">{t('projects.field_other_charges')}</label>
                  <input type="number" step="0.01" id="cp-charges" name="autres_charges" className="cp-input" placeholder="50000" value={form.autres_charges} onChange={handleChange} />
                </div>
              </div>
              <div className="cp-row">
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-prix-vente">{t('projects.field_unit_price')}</label>
                  <input type="number" step="0.01" id="cp-prix-vente" name="prix_vente_unitaire" className="cp-input" placeholder="800000" value={form.prix_vente_unitaire} onChange={handleChange} />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="cp-revenu">{t('projects.field_estimated_revenue')}</label>
                  <input type="number" step="0.01" id="cp-revenu" name="revenu_estime" className="cp-input" placeholder="1500000" value={form.revenu_estime} onChange={handleChange} />
                </div>
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="search" className="cp-card-icon" />
                {t('projects.section_image')}
              </h2>
              <div className="cp-field">
                <label className="cp-label" htmlFor="cp-image">{t('projects.field_image_url')}</label>
                <input type="url" id="cp-image" name="image" className="cp-input" placeholder="https://exemple.com/image.jpg" value={form.image} onChange={handleChange} />
              </div>
            </section>
          </div>

          <div className="cp-right-col">
            <div className="cp-gis-card" style={{ backgroundImage: `linear-gradient(to top, rgba(13,27,72,.88), rgba(13,27,72,.15)), url('${gisBg}')` }}>
              <div className="cp-gis-content">
                <span className="cp-gis-eyebrow">{t('projects.gis_badge')}</span>
                <h3 className="cp-gis-title">{t('projects.gis_title')}</h3>
                <p className="cp-gis-text">
                  {t('projects.gis_description')}
                </p>
              </div>
            </div>

            <div className="cp-tips-card">
              <div className="cp-tips-title">
                <div className="cp-tips-icon">✓</div>
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
            <button type="button" className="btn btn-outline" id="cp-reset" onClick={resetForm} disabled={submitting}>{t('common.reset')}</button>
            <button type="button" className="btn btn-primary" id="cp-submit" onClick={() => { void handleSubmit() }} disabled={submitting}>
              {submitting ? <><span className="cp-spinner"></span> {t('projects.loading_creation')}</> : <>{icons.plus} {t('projects.btn_create')}</>}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

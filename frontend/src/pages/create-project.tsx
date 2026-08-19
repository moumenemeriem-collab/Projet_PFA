import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import {
  createProjet,
  previewRentabilite,
  type ProjetPayload,
  type Rentabilite,
} from '../api/projets'
import { formatApiErrors } from '../api/auth'
import { t } from '../i18n/index'
import gisBg from '../assets/features/create_project.jpg'

function num(v: string): number | undefined {
  return v ? Number(v) : undefined
}

export function CreateProjectPage(): React.JSX.Element {
  const navigate = useNavigate()

  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')

  const [surface, setSurface] = useState('')

  const [prixFoncierM2, setPrixFoncierM2] = useState('')
  const [fraisAcquisition, setFraisAcquisition] = useState('7')
  const [tauxChute, setTauxChute] = useState('30')

  const [cos, setCos] = useState('')
  const [cus, setCus] = useState('')

  const [hasAppartement, setHasAppartement] = useState(true)
  const [hasCommerce, setHasCommerce] = useState(false)
  const [hasBureau, setHasBureau] = useState(false)

  const [quotePartApp, setQuotePartApp] = useState('100')
  const [quotePartCommerce, setQuotePartCommerce] = useState('0')
  const [quotePartBureau, setQuotePartBureau] = useState('0')

  const [prixVenteApp, setPrixVenteApp] = useState('')
  const [prixVenteCommerce, setPrixVenteCommerce] = useState('')
  const [prixVenteBureau, setPrixVenteBureau] = useState('')

  const [coutConstrApp, setCoutConstrApp] = useState('')
  const [coutConstrCommerce, setCoutConstrCommerce] = useState('')
  const [coutConstrBureau, setCoutConstrBureau] = useState('')

  const [tauxEtudes, setTauxEtudes] = useState('10')
  const [tauxImprevus, setTauxImprevus] = useState('5')
  const [tauxCommercialisation, setTauxCommercialisation] = useState('3')

  const [dureeConstruction, setDureeConstruction] = useState('2')
  const [dureeCommercialisation, setDureeCommercialisation] = useState('3')
  const [tauxActualisation, setTauxActualisation] = useState('8')

  const [alert, setAlert] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [result, setResult] = useState<Rentabilite | null>(null)

  const buildPayload = useCallback((): ProjetPayload | null => {
    const nomVal = nom.trim()
    const surfaceVal = num(surface)
    if (!nomVal || !surfaceVal) return null
    return {
      nom: nomVal,
      description: description.trim(),
      id_type: 1,
      surface_souhaitee: num(surface) || 0,
      budget_total: 0,

      prix_foncier_m2: num(prixFoncierM2),
      frais_acquisition: num(fraisAcquisition),
      taux_chute: num(tauxChute),
      cos: num(cos),
      cus: num(cus),

      has_appartement: hasAppartement,
      has_commerce: hasCommerce,
      has_bureau: hasBureau,

      quote_part_appartement: num(quotePartApp),
      quote_part_commerce: num(quotePartCommerce),
      quote_part_bureau: num(quotePartBureau),

      prix_vente_appartement: num(prixVenteApp),
      prix_vente_commerce: num(prixVenteCommerce),
      prix_vente_bureau: num(prixVenteBureau),

      cout_construction_appartement: num(coutConstrApp),
      cout_construction_commerce: num(coutConstrCommerce),
      cout_construction_bureau: num(coutConstrBureau),

      taux_etudes_honoraires: num(tauxEtudes),
      taux_imprevus: num(tauxImprevus),
      taux_commercialisation: num(tauxCommercialisation),

      duree_construction: num(dureeConstruction),
      duree_commercialisation: num(dureeCommercialisation),
      taux_actualisation: num(tauxActualisation),
    }
  }, [nom, description, surface,
    prixFoncierM2, fraisAcquisition, tauxChute, cos, cus,
    hasAppartement, hasCommerce, hasBureau,
    quotePartApp, quotePartCommerce, quotePartBureau,
    prixVenteApp, prixVenteCommerce, prixVenteBureau,
    coutConstrApp, coutConstrCommerce, coutConstrBureau,
    tauxEtudes, tauxImprevus, tauxCommercialisation,
    dureeConstruction, dureeCommercialisation, tauxActualisation,
  ])

  const handleCalculate = async (): Promise<void> => {
    const payload = buildPayload()
    if (!payload) {
      setAlert(t('projects.validation_required'))
      return
    }
    setAlert(null)
    setCalculating(true)
    setResult(null)
    try {
      const res = await previewRentabilite(payload)
      setResult(res)
      if (!res.ok) {
        setAlert(res.error || 'Erreur de calcul')
      }
    } catch (err) {
      setAlert(formatApiErrors(err))
    } finally {
      setCalculating(false)
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

  const fmt = (v: number | null | undefined): string => {
    if (v == null) return '—'
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
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
                <label className="cp-label">{t('projects.field_description_label')}</label>
                <textarea className="cp-input cp-textarea" rows={3} placeholder={t('projects.field_description_placeholder')} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="euro" className="cp-card-icon" />
                {t('projects.section_land_data')}
              </h2>
              <div className="cp-row cp-row-3">
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_surface_label')}</label>
                  <input type="number" step="0.01" className="cp-input" placeholder="500" value={surface} onChange={e => setSurface(e.target.value)} />
                </div>
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_prix_foncier_m2')}</label>
                  <input type="number" step="0.01" className="cp-input" placeholder="4000" value={prixFoncierM2} onChange={e => setPrixFoncierM2(e.target.value)} />
                </div>
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_frais_acquisition')}</label>
                  <input type="number" step="0.01" className="cp-input" value={fraisAcquisition} onChange={e => setFraisAcquisition(e.target.value)} />
                </div>
              </div>
              <div className="cp-row">
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_taux_chute')}</label>
                  <input type="number" step="0.01" className="cp-input" value={tauxChute} onChange={e => setTauxChute(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="building" className="cp-card-icon" />
                {t('projects.section_cos_cus')}
              </h2>
              <div className="cp-row">
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_cos')}</label>
                  <input type="number" step="0.01" className="cp-input" placeholder="Ex: 1.5" value={cos} onChange={e => setCos(e.target.value)} />
                </div>
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_cus')}</label>
                  <input type="number" step="0.01" className="cp-input" placeholder="Ex: 1.2" value={cus} onChange={e => setCus(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="building" className="cp-card-icon" />
                {t('projects.section_destinations')}
              </h2>
              <div className="cp-dest-toggles">
                <label className={`cp-dest-toggle ${hasAppartement ? 'active' : ''}`}>
                  <input type="checkbox" checked={hasAppartement} onChange={e => setHasAppartement(e.target.checked)} />
                  {t('projects.dest_appartement')}
                </label>
                <label className={`cp-dest-toggle ${hasCommerce ? 'active' : ''}`}>
                  <input type="checkbox" checked={hasCommerce} onChange={e => setHasCommerce(e.target.checked)} />
                  {t('projects.dest_commerce')}
                </label>
                <label className={`cp-dest-toggle ${hasBureau ? 'active' : ''}`}>
                  <input type="checkbox" checked={hasBureau} onChange={e => setHasBureau(e.target.checked)} />
                  {t('projects.dest_bureau')}
                </label>
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="euro" className="cp-card-icon" />
                {t('projects.section_quote_parts')}
              </h2>
              <div className="cp-row cp-row-3">
                {hasAppartement && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_quote_part_app')}</label>
                    <input type="number" step="0.01" className="cp-input" value={quotePartApp} onChange={e => setQuotePartApp(e.target.value)} />
                  </div>
                )}
                {hasCommerce && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_quote_part_commerce')}</label>
                    <input type="number" step="0.01" className="cp-input" value={quotePartCommerce} onChange={e => setQuotePartCommerce(e.target.value)} />
                  </div>
                )}
                {hasBureau && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_quote_part_bureau')}</label>
                    <input type="number" step="0.01" className="cp-input" value={quotePartBureau} onChange={e => setQuotePartBureau(e.target.value)} />
                  </div>
                )}
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="euro" className="cp-card-icon" />
                {t('projects.section_dest_prices')}
              </h2>
              <div className="cp-row cp-row-3">
                {hasAppartement && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_prix_vente_app')}</label>
                    <input type="number" step="0.01" className="cp-input" placeholder="8000" value={prixVenteApp} onChange={e => setPrixVenteApp(e.target.value)} />
                  </div>
                )}
                {hasCommerce && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_prix_vente_commerce')}</label>
                    <input type="number" step="0.01" className="cp-input" placeholder="12000" value={prixVenteCommerce} onChange={e => setPrixVenteCommerce(e.target.value)} />
                  </div>
                )}
                {hasBureau && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_prix_vente_bureau')}</label>
                    <input type="number" step="0.01" className="cp-input" placeholder="10000" value={prixVenteBureau} onChange={e => setPrixVenteBureau(e.target.value)} />
                  </div>
                )}
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="euro" className="cp-card-icon" />
                {t('projects.section_dest_costs')}
              </h2>
              <div className="cp-row cp-row-3">
                {hasAppartement && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_cout_constr_app')}</label>
                    <input type="number" step="0.01" className="cp-input" placeholder="4500" value={coutConstrApp} onChange={e => setCoutConstrApp(e.target.value)} />
                  </div>
                )}
                {hasCommerce && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_cout_constr_commerce')}</label>
                    <input type="number" step="0.01" className="cp-input" placeholder="5500" value={coutConstrCommerce} onChange={e => setCoutConstrCommerce(e.target.value)} />
                  </div>
                )}
                {hasBureau && (
                  <div className="cp-field">
                    <label className="cp-label">{t('projects.field_cout_constr_bureau')}</label>
                    <input type="number" step="0.01" className="cp-input" placeholder="5000" value={coutConstrBureau} onChange={e => setCoutConstrBureau(e.target.value)} />
                  </div>
                )}
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="euro" className="cp-card-icon" />
                {t('projects.section_charges')}
              </h2>
              <div className="cp-row cp-row-3">
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_taux_etudes')}</label>
                  <input type="number" step="0.01" className="cp-input" value={tauxEtudes} onChange={e => setTauxEtudes(e.target.value)} />
                </div>
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_taux_imprevus')}</label>
                  <input type="number" step="0.01" className="cp-input" value={tauxImprevus} onChange={e => setTauxImprevus(e.target.value)} />
                </div>
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_taux_commercialisation')}</label>
                  <input type="number" step="0.01" className="cp-input" value={tauxCommercialisation} onChange={e => setTauxCommercialisation(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="cp-card">
              <h2 className="cp-card-title">
                <Icon name="search" className="cp-card-icon" />
                {t('projects.section_scheduling')}
              </h2>
              <div className="cp-row cp-row-3">
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_duree_construction')}</label>
                  <input type="number" className="cp-input" value={dureeConstruction} onChange={e => setDureeConstruction(e.target.value)} />
                </div>
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_duree_commercialisation')}</label>
                  <input type="number" className="cp-input" value={dureeCommercialisation} onChange={e => setDureeCommercialisation(e.target.value)} />
                </div>
                <div className="cp-field">
                  <label className="cp-label">{t('projects.field_taux_actualisation')}</label>
                  <input type="number" step="0.01" className="cp-input" value={tauxActualisation} onChange={e => setTauxActualisation(e.target.value)} />
                </div>
              </div>
            </section>

            {result && result.ok && (
              <section className="cp-card cp-results-card">
                <h2 className="cp-card-title">
                  <Icon name="trending" className="cp-card-icon" />
                  {t('projects.section_results')}
                </h2>
                <div className="cp-results-grid">
                  <div className="cp-result-item">
                    <span className="cp-result-label">{t('projects.res_surface')}</span>
                    <span className="cp-result-value">{fmt(result.surfaces?.surface_vendable)} m²</span>
                  </div>
                  <div className="cp-result-item">
                    <span className="cp-result-label">{t('projects.res_ca')}</span>
                    <span className="cp-result-value">{fmt(result.ca?.ca_total)} DH</span>
                  </div>
                  <div className="cp-result-item">
                    <span className="cp-result-label">{t('projects.res_cout_total')}</span>
                    <span className="cp-result-value">{fmt(result.cout_total_projet)} DH</span>
                  </div>
                  <div className="cp-result-item">
                    <span className="cp-result-label">{t('projects.res_tri')}</span>
                    <span className="cp-result-value">{result.tri != null ? `${result.tri}%` : '—'}</span>
                  </div>
                  <div className="cp-result-item">
                    <span className="cp-result-label">{t('projects.res_benefice')}</span>
                    <span className={`cp-result-value ${(result.benefice_net ?? 0) >= 0 ? 'cp-result-positive' : 'cp-result-negative'}`}>
                      {fmt(result.benefice_net)} DH
                    </span>
                  </div>
                </div>
              </section>
            )}
            {result && !result.ok && (
              <div className="cp-alert cp-alert--error">{result.error || 'Erreur de calcul'}</div>
            )}
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
            <button type="button" className="btn btn-outline" disabled={submitting || calculating} onClick={() => { setNom(''); setDescription(''); setSurface(''); setResult(null); setAlert(null) }}>
              {t('common.reset')}
            </button>
            <button type="button" className="btn btn-calc" disabled={submitting || calculating} onClick={() => { void handleCalculate() }}>
              {calculating ? <><span className="cp-spinner"></span> Calcul...</> : <>{t('projects.btn_calculate')}</>}
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting || calculating} onClick={() => { void handleSubmit() }}>
              {submitting ? <><span className="cp-spinner"></span> {t('projects.btn_creating')}</> : <>{icons.plus} {t('projects.btn_create_project')}</>}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

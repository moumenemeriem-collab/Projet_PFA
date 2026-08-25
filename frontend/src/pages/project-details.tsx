import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DashboardLayout } from '../components/DashboardLayout'
import { icons } from '../components/icons'
import { formatApiErrors } from '../api/auth'
import { fetchProjet, type Projet, type Rentabilite } from '../api/projets'
import { t } from '../i18n/index'

function formatBudget(value: string): string {
  const num = parseFloat(value)
  if (Number.isNaN(num)) return '—'
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M MAD`
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(0)}k MAD`
  return `${num} MAD`
}

function projectImage(projet: Projet): string {
  return projet.image || projet.type_image_defaut || `https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=500&fit=crop`
}

function Item({ label, value, className }: { label: string; value: string; className?: string }): React.JSX.Element {
  return (
    <div className="project-detail-item">
      <span className="project-detail-label">{label}</span>
      <span className={`project-detail-value${className ? ` ${className}` : ''}`}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="pd-section">
      <h4 className="pd-section-title">{title}</h4>
      <div className="pd-section-body project-detail-grid">{children}</div>
    </div>
  )
}

export function ProjectDetailsPage(): React.JSX.Element | null {
  const navigate = useNavigate()
  const { id } = useParams()
  const projetId = Number(id)
  const [projet, setProjet] = useState<Projet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id || !Number.isInteger(projetId) || projetId <= 0) {
      navigate('/projets', { replace: true })
    }
  }, [id, projetId, navigate])

  useEffect(() => {
    if (!projetId) return
    let cancelled = false
    setLoading(true)
    setError(null)
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
    return () => {
      cancelled = true
    }
  }, [projetId, reloadKey])

  const rentabilite: Rentabilite | null = useMemo(() => projet?.rentabilite ?? null, [projet])
  const dateCreation = useMemo(
    () => (projet ? new Date(projet.date_creation).toLocaleDateString(undefined, { dateStyle: 'long' }) : ''),
    [projet],
  )

  if (!id || !Number.isInteger(projetId) || projetId <= 0) return null

  return (
    <DashboardLayout role="investisseur" activePage="project_details" projectContext={{ id: projetId, name: projet?.nom ?? '...' }}>
      <div className="pd-page">
        {loading ? (
          <>
            <div className="pd-skeleton pd-skeleton--hero" />
            <div className="pd-kpis">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="pd-skeleton pd-skeleton--card" />
              ))}
            </div>
            <div className="pd-skeleton pd-skeleton--section" />
          </>
        ) : error || !projet ? (
          <div className="admin-error-state">
            <p>{error ?? t('projects.error_login')}</p>
            <button type="button" className="btn btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
              {t('pdetails.retry')}
            </button>
          </div>
        ) : (
          <>
            <div className="pd-hero">
              <img src={projectImage(projet)} alt={projet.nom} className="pd-hero-img" />
              <div className="pd-hero-overlay">
                <span className="project-type-tag project-type-tag--overlay">{icons.building} {projet.type_nom}</span>
                <h2 className="pd-hero-title">{projet.nom}</h2>
                {projet.description ? <p className="pd-hero-desc">{projet.description}</p> : null}
                <span className="pd-hero-date">{t('pdetails.created')} {dateCreation}</span>
              </div>
            </div>

            <div className="pd-kpis">
              <div className="pd-kpi">
                <span className="pd-kpi-icon">{icons.euro}</span>
                <div className="pd-kpi-body">
                  <span className="pd-kpi-value">{formatBudget(projet.budget_total)}</span>
                  <span className="pd-kpi-label">{t('projects.field_budget')}</span>
                </div>
              </div>
              <div className="pd-kpi">
                <span className="pd-kpi-icon">{icons.layers}</span>
                <div className="pd-kpi-body">
                  <span className="pd-kpi-value">{Number(projet.surface_souhaitee).toLocaleString()} m²</span>
                  <span className="pd-kpi-label">{t('projects.field_surface')}</span>
                </div>
              </div>
              {projet.nombre_unites != null ? (
                <div className="pd-kpi">
                  <span className="pd-kpi-icon">{icons.building}</span>
                  <div className="pd-kpi-body">
                    <span className="pd-kpi-value">{projet.nombre_unites}</span>
                    <span className="pd-kpi-label">{t('projects.field_unites')}</span>
                  </div>
                </div>
              ) : null}
              {projet.surface_construite ? (
                <div className="pd-kpi">
                  <span className="pd-kpi-icon">{icons.folder}</span>
                  <div className="pd-kpi-body">
                    <span className="pd-kpi-value">{Number(projet.surface_construite).toLocaleString()} m²</span>
                    <span className="pd-kpi-label">{t('projects.field_surface_construite')}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <Section title={t('projects.detail_section_land')}>
              {projet.prix_foncier_m2 ? <Item label={t('projects.field_prix_foncier_m2')} value={`${projet.prix_foncier_m2} MAD/m²`} /> : null}
              {projet.frais_acquisition ? <Item label={t('projects.field_frais_acquisition')} value={`${projet.frais_acquisition} %`} /> : null}
              {projet.taux_chute ? <Item label={t('projects.field_taux_chute')} value={`${projet.taux_chute} %`} /> : null}
              {projet.cos ? <Item label={t('projects.field_cos')} value={String(projet.cos)} /> : null}
              {projet.cus ? <Item label={t('projects.field_cus')} value={String(projet.cus)} /> : null}
            </Section>

            {(projet.has_appartement || projet.has_commerce || projet.has_bureau) ? (
              <Section title={t('projects.detail_section_destinations')}>
                {projet.has_appartement ? (
                  <>
                    <Item label={t('projects.dest_appartement')} value={`${projet.quote_part_appartement ?? 0} %`} />
                    {projet.prix_vente_appartement ? <Item label={t('projects.field_prix_vente_app')} value={`${projet.prix_vente_appartement} MAD/m²`} /> : null}
                    {projet.cout_construction_appartement ? <Item label={t('projects.field_cout_constr_app')} value={`${projet.cout_construction_appartement} MAD/m²`} /> : null}
                  </>
                ) : null}
                {projet.has_commerce ? (
                  <>
                    <Item label={t('projects.dest_commerce')} value={`${projet.quote_part_commerce ?? 0} %`} />
                    {projet.prix_vente_commerce ? <Item label={t('projects.field_prix_vente_commerce')} value={`${projet.prix_vente_commerce} MAD/m²`} /> : null}
                    {projet.cout_construction_commerce ? <Item label={t('projects.field_cout_constr_commerce')} value={`${projet.cout_construction_commerce} MAD/m²`} /> : null}
                  </>
                ) : null}
                {projet.has_bureau ? (
                  <>
                    <Item label={t('projects.dest_bureau')} value={`${projet.quote_part_bureau ?? 0} %`} />
                    {projet.prix_vente_bureau ? <Item label={t('projects.field_prix_vente_bureau')} value={`${projet.prix_vente_bureau} MAD/m²`} /> : null}
                    {projet.cout_construction_bureau ? <Item label={t('projects.field_cout_constr_bureau')} value={`${projet.cout_construction_bureau} MAD/m²`} /> : null}
                  </>
                ) : null}
              </Section>
            ) : null}

            <Section title={t('projects.detail_section_charges')}>
              {projet.taux_etudes_honoraires ? <Item label={t('projects.field_taux_etudes')} value={`${projet.taux_etudes_honoraires} %`} /> : null}
              {projet.taux_imprevus ? <Item label={t('projects.field_taux_imprevus')} value={`${projet.taux_imprevus} %`} /> : null}
              {projet.taux_commercialisation ? <Item label={t('projects.field_taux_commercialisation')} value={`${projet.taux_commercialisation} %`} /> : null}
              {projet.duree_construction ? <Item label={t('projects.field_duree_construction')} value={`${projet.duree_construction}`} /> : null}
              {projet.duree_commercialisation ? <Item label={t('projects.field_duree_commercialisation')} value={`${projet.duree_commercialisation}`} /> : null}
              {projet.taux_actualisation ? <Item label={t('projects.field_taux_actualisation')} value={`${projet.taux_actualisation} %`} /> : null}
            </Section>

            {rentabilite && rentabilite.ok ? (
              <Section title={t('projects.detail_rentabilite')}>
                {rentabilite.surfaces?.surface_vendable != null ? (
                  <Item label={t('projects.res_surface')} value={`${Number(rentabilite.surfaces.surface_vendable).toLocaleString()} m²`} />
                ) : null}
                {rentabilite.ca?.ca_total != null ? <Item label={t('projects.res_ca')} value={formatBudget(String(rentabilite.ca.ca_total))} /> : null}
                {rentabilite.cout_total_projet != null ? <Item label={t('projects.res_cout_total')} value={formatBudget(String(rentabilite.cout_total_projet))} /> : null}
                {rentabilite.tri != null ? (
                  <Item
                    label={t('projects.res_tri')}
                    value={`${rentabilite.tri} %`}
                    className={rentabilite.tri >= 0 ? 'text-success' : 'text-error'}
                  />
                ) : null}
                {rentabilite.roi != null ? (
                  <Item
                    label="ROI"
                    value={`${Number(rentabilite.roi).toFixed(1)} %`}
                    className={rentabilite.roi >= 0 ? 'text-success' : 'text-error'}
                  />
                ) : null}
                {rentabilite.benefice_net != null ? (
                  <Item
                    label={t('projects.res_benefice')}
                    value={formatBudget(String(rentabilite.benefice_net))}
                    className={rentabilite.benefice_net >= 0 ? 'text-success' : 'text-error'}
                  />
                ) : null}
              </Section>
            ) : (
              <div className="pd-renta-empty">{t('pdetails.renta_empty')}</div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

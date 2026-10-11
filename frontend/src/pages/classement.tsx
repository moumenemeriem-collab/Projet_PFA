import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { icons } from '../components/icons'
import { DashboardLayout } from '../components/DashboardLayout'
import { formatApiErrors } from '../api/auth'
import { fetchProjet, type Projet, type Rentabilite } from '../api/projets'
import { deleteTerrain, fetchSurfaceConstructible, fetchTerrains, type SurfaceConstructibleResponse, type Terrain } from '../api/terrains'
import {
  fetchAnalyseDetail,
  fetchAnalyses,
  type Analyse,
  type AnalyseDetail,
  type ResultatAnalyse,
} from '../api/analyses'
import { fetchCouches, fetchCoucheGeoJSON } from '../api/couches'
import { attributeLabel, CADASTRE_ATTRIBUTE_LABELS, formatParcelleRef, formatParcelleTitle } from '../utils/attributeLabels'
import { t } from '../i18n/index'

const PAGE_SIZE = 10

interface AlertState {
  type: 'success' | 'error'
  message: string
}


function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function formatSurface(s: number | null | undefined): string {
  return s != null ? `${Number(s).toLocaleString()} m²` : '—'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    complete: 'ranking.status_complete',
    en_cours: 'ranking.status_en_cours',
    erreur: 'ranking.status_erreur',
  }
  return t(map[status] ?? 'ranking.status_complete')
}


function confBadge(r: ResultatAnalyse): React.JSX.Element {
  const ok = r.nombre_criteres_satisfaits
  const total = r.total_criteres
  const cls = total > 0 && ok >= total ? 'classement-conf--ok' : 'classement-conf--warn'
  return <span className={`classement-conf ${cls}`}>{ok}/{total}</span>
}

function renderTerrainRow(t_: Terrain, onDelete: (id: number) => void): React.JSX.Element {
  const hasCoords = t_.lat != null && t_.lng != null
  const displayTitle = formatParcelleTitle({ nom: t_.nom, num: t_.num_parcelle || t_.num_titre_foncier, indice: t_.indice })
  return (
    <tr data-terrain-id={t_.id}>
      <td><strong>{displayTitle}</strong></td>
      <td>{Number(t_.superficie).toLocaleString()} m²</td>
      <td>{t_.indice || '—'}</td>
      <td>{t_.consistance || '—'}</td>
      <td>{hasCoords ? `${Number(t_.lat).toFixed(4)}, ${Number(t_.lng).toFixed(4)}` : t('ranking.no_coords')}</td>
      <td>
        <div className="classement-table-actions">
          <Link
            to={`/projets/${t_.projet}/classement/ajouter?parcelle=${encodeURIComponent(t_.num_titre_foncier || t_.num_parcelle || t_.nom)}&hideCard=1`}
            className="table-action-btn"
            title={t('ranking.view_map')}
          >
            {icons.mapPin}
          </Link>
          <button type="button" className="table-action-btn table-action-btn--danger" data-action="delete" data-terrain-id={t_.id} title={t('common.delete')} onClick={() => onDelete(t_.id)}>{icons.trash}</button>
        </div>
      </td>
    </tr>
  )
}

function DetailModal({ resultat, cadastre, onClose }: { resultat: ResultatAnalyse; cadastre?: Record<string, unknown> | null; onClose: () => void }): React.JSX.Element {
  const displayTitle = formatParcelleTitle({ nom: resultat.nom, id_parcelle: resultat.id_parcelle, reference_cadastrale: resultat.reference_cadastrale, indice: resultat.indice })
  const displayRef = formatParcelleRef(resultat.reference_cadastrale || resultat.id_parcelle, resultat.indice)
  const fmtScore = (v: number | null | undefined): string => (v == null ? '—' : Number(v).toFixed(1))
  const fmtPct = (v: unknown): string => (v == null || v === '' ? '—' : `${Number(v).toFixed(2)} %`)
  const fmtVal = (v: unknown): string => {
    if (v == null || v === '') return '—'
    if (Array.isArray(v)) return v.map((x) => String(x)).join(', ')
    if (typeof v === 'number') return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
    return String(v)
  }
  const fmtPoids = (v: unknown): string => {
    if (v == null || v === '') return '—'
    const n = Number(v)
    if (!Number.isFinite(n)) return '—'
    if (Math.abs(n) <= 1) return `${(n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
    return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
  }
  const confCm = resultat.criteres_conformite ?? []
  const CRIT_LABELS_MAP: Record<string, string> = {
    enseignement: 'Enseignement',
    sante: 'Santé',
    administration: 'Administration',
    routes: 'Routes',
    localisation: 'Localisation',
    altitude: 'Altitude',
  }
  return (
    <div className="admin-modal-overlay classement-modal-overlay--detail" onClick={onClose}>
      <div className="admin-modal admin-modal--wide classement-modal--detail" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{t('ranking.details_title')} — {displayTitle}</h3>
          <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={onClose}>{icons.close}</button>
        </div>
        <div className="classement-modal-body classement-modal-body--detail">
          <div className="classement-detail-grid">
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_parcelle')}</span>
              <span className="classement-detail-value">{displayRef || '—'}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_rang')}</span>
              <span className="classement-detail-value">#{resultat.rang}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_surface')}</span>
              <span className="classement-detail-value">{formatSurface(resultat.superficie)}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.col_conformite')}</span>
              <span className="classement-detail-value">{confBadge(resultat)}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.score_final')}</span>
              <span className="classement-detail-value">{fmtScore(resultat.score_final)} / 100</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">{t('ranking.score_amc')}</span>
              <span className="classement-detail-value">{fmtScore(resultat.score_amc)} / 100</span>
            </div>
          </div>

          <div className="classement-detail-section">
            <h4 className="classement-detail-section-title">{t('ranking.scores_title')}</h4>
            <div className="classement-detail-grid">
              <DetailItem label={t('ranking.score_accessibilite')} value={fmtScore(resultat.score_accessibilite)} />
              <DetailItem label={t('ranking.score_positionnement')} value={fmtScore(resultat.score_positionnement)} />
              <DetailItem label={t('ranking.score_topographie')} value={fmtScore(resultat.score_topographie)} />
              <DetailItem label={t('ranking.score_superficie')} value={fmtScore(resultat.score_superficie)} />
              <DetailItem label={t('ranking.score_rentabilite')} value={fmtScore(resultat.score_rentabilite)} />
              <DetailItem label={t('ranking.score_final')} value={fmtScore(resultat.score_final)} />
            </div>
          </div>

          {resultat.prix_terrain != null || resultat.benefice_net != null || resultat.roi != null || resultat.marge != null ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.rentabilite')}</h4>
              <div className="classement-detail-grid">
                {resultat.prix_terrain != null ? <DetailItem label={t('ranking.prix_terrain')} value={fmtMAD(resultat.prix_terrain)} /> : null}
                {resultat.benefice_net != null ? (
                  <DetailItem
                    label={t('ranking.res_benefice')}
                    value={fmtMAD(resultat.benefice_net)}
                    tone={resultat.benefice_net >= 0 ? 'success' : 'error'}
                  />
                ) : null}
                {resultat.roi != null ? <DetailItem label={t('ranking.roi')} value={fmtPct(resultat.roi)} /> : null}
                {resultat.marge != null ? <DetailItem label={t('ranking.marge')} value={fmtMAD(resultat.marge)} /> : null}
              </div>
            </div>
          ) : null}

          {confCm.length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.resultats_criteres')}</h4>
              <table className="classement-detail-table">
                <thead>
                  <tr>
                    <th>{t('ranking.amc_critere')}</th>
                    <th>{t('ranking.amc_poids')}</th>
                    <th>{t('ranking.amc_valeur')}</th>
                    <th>{t('ranking.amc_cible')}</th>
                    <th>{t('ranking.amc_score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {confCm.map((c: any, i: number) => {
                    const pctv =
                      c.pct != null && c.pct !== ''
                        ? Number(c.pct)
                        : c.score != null && c.score !== ''
                        ? Number(Number(c.score) <= 1 ? Number(c.score) * 100 : Number(c.score))
                        : c.contribution != null && c.contribution !== '' && typeof c.poids === 'number' && Number(c.poids) > 0
                        ? Number((Number(c.contribution) / Number(c.poids)) * 100)
                        : null
                    const labelv =
                      c.label ||
                      c.critere ||
                      c.cle ||
                      CRIT_LABELS_MAP[c.critere] ||
                      CRIT_LABELS_MAP[c.cle] ||
                      CRIT_LABELS_MAP[String(c.critere || '').toLowerCase()] ||
                      '—'
                    const valv = c.valeur ?? c.valeur_mesuree ?? c.value ?? (pctv != null ? Number(pctv.toFixed(2)) : null)
                    const ciblev = c.cible ?? (pctv != null ? 100 : null)
                    return (
                      <tr key={`${c.cle || c.critere || i}-${i}`}>
                        <td>{labelv}</td>
                        <td>{fmtPoids(c.poids)}</td>
                        <td>
                          {fmtVal(valv)}
                          {valv != null && valv !== '' ? (c.unite ? ` ${c.unite}` : pctv != null ? ' %' : '') : ''}
                        </td>
                        <td>
                          {fmtVal(ciblev)}
                          {ciblev != null && ciblev !== '' ? (c.unite ? ` ${c.unite}` : pctv != null ? ' %' : '') : ''}
                        </td>
                        <td>{pctv != null ? `${Number(pctv).toFixed(1)} %` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : resultat.criteres && resultat.criteres.length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.resultats_criteres')}</h4>
              <div className="classement-criteria-list">
                {resultat.criteres.map((c) => (
                  <div key={c.id} className="classement-criteria-row">
                    <div className="classement-criteria-main">
                      <span className="classement-criteria-name">{c.critere}</span>
                      <span className="classement-criteria-value">{c.valeur_mesuree} <small>({c.point_interet})</small></span>
                    </div>
                    <span className={`classement-criteria-status ${c.conforme ? 'classement-criteria-status--ok' : 'classement-criteria-status--ko'}`}>
                      {c.conforme ? t('ranking.conforme') : t('ranking.non_conforme')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {resultat.points_forts && resultat.points_forts.length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.points_forts')}</h4>
              <ul className="classement-detail-list classement-detail-list--forts">
                {resultat.points_forts.map((pf) => <li key={pf}>{pf}</li>)}
              </ul>
            </div>
          ) : null}

          {resultat.points_faibles && resultat.points_faibles.length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.points_faibles')}</h4>
              <ul className="classement-detail-list classement-detail-list--faibles">
                {resultat.points_faibles.map((pf) => <li key={pf}>{pf}</li>)}
              </ul>
            </div>
          ) : null}

          {cadastre && Object.keys(cadastre).length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.carte_cadastrale')}</h4>
              <div className="classement-detail-grid">
                {Object.entries(cadastre)
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .map(([k, v]) => (
                    <div className="classement-detail-item" key={k}>
                      <span className="classement-detail-label">{attributeLabel(k, CADASTRE_ATTRIBUTE_LABELS)}</span>
                      <span className="classement-detail-value">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function fmtMAD(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MAD`
}

function DetailItem({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'error' }): React.JSX.Element {
  return (
    <div className="classement-detail-item">
      <span className="classement-detail-label">{label}</span>
      <span className={tone ? `classement-detail-value text-${tone}` : 'classement-detail-value'}>{value}</span>
    </div>
  )
}

function TerrainDetailModal({ terrain, projetId, cadastre, onClose }: { terrain: Terrain; projetId: number; cadastre?: Record<string, unknown> | null; onClose: () => void }): React.JSX.Element {
  const r = (terrain.rentabilite_json ?? null) as unknown as Rentabilite | null
  const [constr, setConstr] = useState<SurfaceConstructibleResponse | null>(null)
  const [constrLoading, setConstrLoading] = useState(true)
  const [constrError, setConstrError] = useState(false)

  useEffect(() => {
    let active = true
    setConstrLoading(true)
    setConstrError(false)
    fetchSurfaceConstructible(projetId, terrain.id)
      .then((res) => { if (active) setConstr(res) })
      .catch(() => { if (active) setConstrError(true) })
      .finally(() => { if (active) setConstrLoading(false) })
    return () => { active = false }
  }, [projetId, terrain.id])

  const fmtPct = (v: unknown): string => {
    if (v == null || v === '') return '—'
    const n = Number(v)
    return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—'
  }
  const fmtM2 = (v: unknown): string => {
    if (v == null || v === '') return '—'
    const n = Number(v)
    return Number.isFinite(n) ? `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m²` : '—'
  }
  const fmtNum = (v: unknown): string => {
    if (v == null || v === '') return '—'
    const n = Number(v)
    return Number.isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'
  }
  const affectationTypeLabel = (type: string): string => (
    type === 'constructible'
      ? t('ranking.constr_type_constructible')
      : type === 'parent'
        ? t('ranking.constr_type_parent')
        : t('ranking.constr_type_non_constructible')
  )
  const flux = r?.flux ?? []

  return (
    <div className="admin-modal-overlay classement-modal-overlay--detail" onClick={onClose}>
      <div className="admin-modal admin-modal--wide classement-modal--detail" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{t('ranking.details_title')} — {terrain.nom}</h3>
          <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={onClose}>{icons.close}</button>
        </div>
        <div className="classement-modal-body classement-modal-body--detail">
          <div className="classement-detail-grid">
            <div className="classement-detail-item">
              <span className="classement-detail-label">Titre / Réf. foncière</span>
              <span className="classement-detail-value">{terrain.num_titre_foncier || terrain.num_parcelle || terrain.nom}</span>
            </div>
            <div className="classement-detail-item">
              <span className="classement-detail-label">Superficie</span>
              <span className="classement-detail-value">{Number(terrain.superficie).toLocaleString('fr-FR')} m²</span>
            </div>
            {r?.benefice_net != null && (
              <div className="classement-detail-item">
                <span className="classement-detail-label">{t('ranking.res_benefice')}</span>
                <span className="classement-detail-value" style={{ color: Number(r.benefice_net) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {fmtMAD(Number(r.benefice_net))}
                </span>
              </div>
            )}
            {r?.tri != null && (
              <div className="classement-detail-item">
                <span className="classement-detail-label">{t('ranking.res_tri')}</span>
                <span className="classement-detail-value" style={{ color: Number(r.tri) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {fmtPct(r.tri)}
                </span>
              </div>
            )}
          </div>

          <div className="classement-detail-section">
            <h4 className="classement-detail-section-title">{t('ranking.constr_section')}</h4>
            {constrLoading ? (
              <p className="classement-detail-note">{t('ranking.constr_loading')}</p>
            ) : constrError ? (
              <p className="classement-detail-note">{t('ranking.constr_error')}</p>
            ) : constr == null || constr.superficie <= 0 ? (
              <p className="classement-detail-note">{t('ranking.constr_unavailable')}</p>
            ) : (
              <>
                <div className="classement-detail-grid">
                  <DetailItem label={t('ranking.constr_superficie')} value={fmtM2(constr.superficie)} />
                  <DetailItem label={t('ranking.constr_surface')} value={fmtM2(constr.surface_constructible)} />
                  <DetailItem label={t('ranking.constr_taux')} value={`${constr.taux}%`} />
                  <DetailItem label={t('ranking.constr_non_construable')} value={fmtM2(constr.non_construable)} />
                  {constr.designation_dominante ? <DetailItem label={t('ranking.constr_designation')} value={constr.designation_dominante} /> : null}
                  {constr.cos != null ? <DetailItem label={t('ranking.field_cos')} value={fmtNum(constr.cos)} /> : null}
                  {constr.cus != null ? <DetailItem label={t('ranking.field_cus')} value={fmtNum(constr.cus)} /> : null}
                </div>
                {constr.affectations.length > 0 ? (
                  <>
                    <h5 className="classement-detail-subtitle">{t('ranking.constr_affectations')}</h5>
                    <table className="classement-detail-table">
                      <thead>
                        <tr>
                          <th>{t('ranking.constr_col_designation')}</th>
                          <th>{t('ranking.constr_col_type')}</th>
                          <th>{t('ranking.constr_col_surface')}</th>
                          <th>{t('ranking.field_cos')}</th>
                          <th>{t('ranking.field_cus')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {constr.affectations.map((a, i) => (
                          <tr key={`${a.designation}-${i}`}>
                            <td>{a.designation || '—'}</td>
                            <td>{affectationTypeLabel(a.type)}</td>
                            <td>{fmtM2(a.surface_m2)}</td>
                            <td>{fmtNum(a.cos)}</td>
                            <td>{fmtNum(a.cus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : null}
              </>
            )}
          </div>

          {r && r.ok !== false ? (
            <>
              {r.surfaces ? (
                <div className="classement-detail-section">
                  <h4 className="classement-detail-section-title">{t('ranking.renta_section_surfaces')}</h4>
                  <div className="classement-detail-grid">
                    <DetailItem label={t('ranking.renta_surface_brute')} value={fmtM2(r.surfaces.surface_brute)} />
                    <DetailItem label={t('ranking.renta_surface_constructible')} value={fmtM2(r.surfaces.surface_constructible)} />
                    <DetailItem label={t('ranking.renta_shon')} value={fmtM2(r.surfaces.shon)} />
                    <DetailItem label={t('ranking.renta_shob')} value={fmtM2(r.surfaces.shob)} />
                    <DetailItem label={t('ranking.renta_surface_vendable')} value={fmtM2(r.surfaces.surface_vendable)} />
                    <DetailItem label={t('ranking.renta_surf_appartements')} value={fmtM2(r.surfaces.surface_appartements)} />
                    <DetailItem label={t('ranking.renta_surf_commerces')} value={fmtM2(r.surfaces.surface_commerces)} />
                    <DetailItem label={t('ranking.renta_surf_bureaux')} value={fmtM2(r.surfaces.surface_bureaux)} />
                    <DetailItem label={t('ranking.renta_surf_equipements')} value={fmtM2(r.surfaces.surface_equipements)} />
                    <DetailItem label={t('ranking.renta_surf_equipements_prives')} value={fmtM2(r.surfaces.surface_equipements_prives)} />
                    <DetailItem label={t('ranking.renta_surface_voie')} value={fmtM2(r.surfaces.surface_voie)} />
                    <DetailItem label={t('ranking.renta_surface_espace_vert')} value={fmtM2(r.surfaces.surface_espace_vert)} />
                    <DetailItem label={t('ranking.renta_surface_a_amenager')} value={fmtM2(r.surfaces.surface_a_amenager)} />
                  </div>
                </div>
              ) : null}

              {r.ca ? (
                <div className="classement-detail-section">
                  <h4 className="classement-detail-section-title">{t('ranking.renta_section_ca')}</h4>
                  <div className="classement-detail-grid">
                    <DetailItem label={t('ranking.renta_ca_appartements')} value={fmtMAD(r.ca.ca_appartements)} />
                    <DetailItem label={t('ranking.renta_ca_commerces')} value={fmtMAD(r.ca.ca_commerces)} />
                    <DetailItem label={t('ranking.renta_ca_bureaux')} value={fmtMAD(r.ca.ca_bureaux)} />
                    <DetailItem label={t('ranking.renta_ca_equipements')} value={fmtMAD(r.ca.ca_equipements)} />
                    <DetailItem label={t('ranking.renta_ca_total')} value={fmtMAD(r.ca.ca_total)} />
                  </div>
                </div>
              ) : null}

              {r.construction ? (
                <div className="classement-detail-section">
                  <h4 className="classement-detail-section-title">{t('ranking.renta_section_construction')}</h4>
                  <div className="classement-detail-grid">
                    <DetailItem label={t('ranking.renta_cout_appartements')} value={fmtMAD(r.construction.cout_appartements)} />
                    <DetailItem label={t('ranking.renta_cout_commerces')} value={fmtMAD(r.construction.cout_commerces)} />
                    <DetailItem label={t('ranking.renta_cout_bureaux')} value={fmtMAD(r.construction.cout_bureaux)} />
                    <DetailItem label={t('ranking.renta_cout_total')} value={fmtMAD(r.construction.cout_total)} />
                  </div>
                </div>
              ) : null}

              {r.charges ? (
                <div className="classement-detail-section">
                  <h4 className="classement-detail-section-title">{t('ranking.renta_section_charges')}</h4>
                  <div className="classement-detail-grid">
                    <DetailItem label={t('ranking.renta_frais_etudes')} value={fmtMAD(r.charges.frais_etudes)} />
                    <DetailItem label={t('ranking.renta_imprevus')} value={fmtMAD(r.charges.imprevus)} />
                    <DetailItem label={t('ranking.renta_frais_commercialisation')} value={fmtMAD(r.charges.frais_commercialisation)} />
                    <DetailItem label={t('ranking.renta_amenagement')} value={fmtMAD(r.charges.amenagement)} />
                    {r.charges.cout_acquisition_foncier != null ? (
                      <DetailItem label={t('ranking.renta_cout_acquisition_total')} value={fmtMAD(r.charges.cout_acquisition_foncier)} />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {r.acquisition ? (
                <div className="classement-detail-section">
                  <h4 className="classement-detail-section-title">{t('ranking.renta_section_acquisition')}</h4>
                  <div className="classement-detail-grid">
                    <DetailItem label={t('ranking.renta_prix_foncier')} value={fmtMAD(r.acquisition.prix_foncier)} />
                    <DetailItem label={t('ranking.renta_frais_acquisition')} value={fmtMAD(r.acquisition.frais_acquisition)} />
                    <DetailItem label={t('ranking.renta_cout_acquisition_total')} value={fmtMAD(r.acquisition.cout_total)} />
                  </div>
                </div>
              ) : null}

              <div className="classement-detail-section">
                <h4 className="classement-detail-section-title">{t('ranking.renta_section_resultats')}</h4>
                <div className="classement-detail-grid">
                  <DetailItem label={t('ranking.renta_cout_total_projet')} value={fmtMAD(r.cout_total_projet)} />
                  <DetailItem
                    label={t('ranking.renta_benefice_net')}
                    value={fmtMAD(r.benefice_net)}
                    tone={r.benefice_net != null ? (r.benefice_net >= 0 ? 'success' : 'error') : undefined}
                  />
                  <DetailItem label={t('ranking.renta_roi')} value={fmtPct(r.roi)} />
                  <DetailItem
                    label={t('ranking.renta_van')}
                    value={fmtMAD(r.van)}
                    tone={r.van != null ? (r.van >= 0 ? 'success' : 'error') : undefined}
                  />
                  <DetailItem
                    label={t('ranking.renta_tri')}
                    value={fmtPct(r.tri)}
                    tone={r.tri != null ? (r.tri >= 0 ? 'success' : 'error') : undefined}
                  />
                </div>
              </div>

              {flux.length > 0 ? (
                <div className="classement-detail-section">
                  <h4 className="classement-detail-section-title">{t('ranking.renta_section_flux')}</h4>
                  <table className="classement-detail-table">
                    <thead>
                      <tr>
                        <th>{t('ranking.renta_flux_annee')}</th>
                        <th>{t('ranking.renta_flux_recettes')}</th>
                        <th>{t('ranking.renta_flux_charges')}</th>
                        <th>{t('ranking.renta_flux_net')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flux.map((f) => (
                        <tr key={f.annee}>
                          <td>{f.annee}</td>
                          <td>{fmtMAD(f.ca)}</td>
                          <td>{fmtMAD(f.total_charges ?? (f.acquisition + f.construction + f.etudes_honoraires + f.imprevus + f.amenagement))}</td>
                          <td>{fmtMAD(f.flux_net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.renta_section_resultats')}</h4>
              <p className="classement-detail-note">{t('pdetails.renta_empty')}</p>
            </div>
          )}

          {cadastre && Object.keys(cadastre).length > 0 ? (
            <div className="classement-detail-section">
              <h4 className="classement-detail-section-title">{t('ranking.carte_cadastrale')}</h4>
              <div className="classement-detail-grid">
                {Object.entries(cadastre)
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .map(([k, v]) => (
                    <div className="classement-detail-item" key={k}>
                      <span className="classement-detail-label">{attributeLabel(k, CADASTRE_ATTRIBUTE_LABELS)}</span>
                      <span className="classement-detail-value">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function ClassementPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams()
  const projetId = Number(id)
  const [tab, setTab] = useState<'parcelles' | 'terrains' | 'rentabilite'>('parcelles')
  const [parcellesPage, setParcellesPage] = useState(1)
  const [savedPage, setSavedPage] = useState(1)
  const [projet, setProjet] = useState<Projet | null>(null)
  const [analyses, setAnalyses] = useState<Analyse[]>([])
  const [analyse, setAnalyse] = useState<AnalyseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [detail, setDetail] = useState<ResultatAnalyse | null>(null)
  const [selectedTerrainDetail, setSelectedTerrainDetail] = useState<Terrain | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [savedTerrains, setSavedTerrains] = useState<Terrain[]>([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [savedSearchInput, setSavedSearchInput] = useState('')
  const [amcSearchInput, setAmcSearchInput] = useState('')

  const [terrains, setTerrains] = useState<Terrain[]>([])
  const [cadastreAttrs, setCadastreAttrs] = useState<Record<string, Record<string, unknown>>>({})
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [terrainsLoading, setTerrainsLoading] = useState(false)

  useEffect(() => {
    if (!id || !Number.isInteger(projetId) || projetId <= 0) {
      navigate('/projets', { replace: true })
    }
  }, [id, projetId, navigate])

  const loadSavedTerrains = useCallback(() => {
    if (!projetId) return
    setSavedLoading(true)
    fetchTerrains(projetId, { page_size: 200 })
      .then((data) => {
        const sorted = [...data.results].sort((a, b) => {
          const aBen = (a.rentabilite_json as Record<string, unknown>)?.benefice_net as number ?? -Infinity
          const bBen = (b.rentabilite_json as Record<string, unknown>)?.benefice_net as number ?? -Infinity
          if (aBen !== bBen) return bBen - aBen
          return new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime()
        })
        setSavedTerrains(sorted)
        setSavedLoading(false)
      })
      .catch(() => setSavedLoading(false))
  }, [projetId])

  useEffect(() => {
    if (!projetId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    loadSavedTerrains()
    Promise.all([fetchProjet(projetId), fetchAnalyses(projetId)])
      .then(async ([p, list]) => {
        if (cancelled) return
        setProjet(p)
        setAnalyses(list)
        if (list.length > 0) {
          const latest = await fetchAnalyseDetail(projetId, list[0].id)
          if (cancelled) return
          setAnalyse(latest)
        }
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
  }, [projetId, loadSavedTerrains])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput)
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, search])

  useEffect(() => {
    if (!projetId || tab !== 'terrains') return
    let cancelled = false
    setTerrainsLoading(true)
    fetchTerrains(projetId, { search, page })
      .then((data) => {
        if (cancelled) return
        setTerrains(data.results)
        setTotalCount(data.count)
        setTerrainsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setAlert({ type: 'error', message: formatApiErrors(err) })
        setTerrainsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projetId, tab, search, page])

  useEffect(() => {
    if (!alert) return
    const timer = setTimeout(() => setAlert(null), 5000)
    return () => clearTimeout(timer)
  }, [alert])

  useEffect(() => {
    if (!projetId) return
    const onFocus = (): void => {
      const key = `terrain_created_${projetId}`
      if (!localStorage.getItem(key)) return
      localStorage.removeItem(key)
      loadSavedTerrains()
      if (tab === 'terrains') {
        void fetchTerrains(projetId, { search, page })
          .then((data) => {
            setTerrains(data.results)
            setTotalCount(data.count)
          })
          .catch(() => { /* ignore */ })
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [projetId, tab, search, page, loadSavedTerrains])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchCouches()
        const cad = list.find((c) => c.nom === 'cadastre')
        if (!cad) return
        const fc = await fetchCoucheGeoJSON(cad.id)
        if (cancelled) return
        const map: Record<string, Record<string, unknown>> = {}
        fc.features.forEach((f) => {
          const id = f.properties?.num
          if (id != null) map[String(id)] = f.properties as Record<string, unknown>
        })
        setCadastreAttrs(map)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setParcellesPage(1)
  }, [analyse])

  const handleDelete = async (terrainId: number): Promise<void> => {
    if (!projetId || !window.confirm(t('ranking.confirm_delete'))) return
    try {
      await deleteTerrain(projetId, terrainId)
      setSavedTerrains((prev) => prev.filter((t_) => t_.id !== terrainId))
      setTerrains((prev) => prev.filter((t_) => t_.id !== terrainId))
      setTotalCount((c) => Math.max(0, c - 1))
      setAlert({ type: 'success', message: t('ranking.deleted') })
    } catch (err) {
      setAlert({ type: 'error', message: formatApiErrors(err) })
    }
  }

  const openHistoryAnalyse = async (analyseId: number): Promise<void> => {
    if (!projetId) return
    setHistoryLoading(true)
    try {
      const detail = await fetchAnalyseDetail(projetId, analyseId)
      setAnalyse(detail)
      setTab('rentabilite')
      setParcellesPage(1)
      setAmcSearchInput('')
      setHistoryOpen(false)
      setAlert({ type: 'success', message: 'Analyse chargée dans la liste Résultats AMC.' })
      setTimeout(() => setAlert(null), 3000)
    } catch (err) {
      setAlert({ type: 'error', message: formatApiErrors(err) })
    } finally {
      setHistoryLoading(false)
    }
  }

  if (loading && !error) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" projectContext={{ id: projetId, name: projet?.nom ?? '...' }}>
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>{t('ranking.loading')}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !projet) {
    return (
      <DashboardLayout role="investisseur" activePage="ranking" projectContext={{ id: projetId, name: '...' }}>
        <div className="admin-error-state">
          <p>{error ?? t('ranking.loading')}</p>
          <Link to="/projets" className="btn btn-primary">{t('projects.error_login')}</Link>
        </div>
      </DashboardLayout>
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const start = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, totalCount)

  const filteredSavedTerrains = savedTerrains.filter((t_) => {
    if (!savedSearchInput.trim()) return true
    const q = savedSearchInput.toLowerCase().trim()
    const title = formatParcelleTitle({ nom: t_.nom, num: t_.num_titre_foncier || t_.num_parcelle, indice: t_.indice }).toLowerCase()
    const ref = formatParcelleRef(t_.num_titre_foncier || t_.num_parcelle || t_.nom, t_.indice).toLowerCase()
    const rawNom = (t_.nom || '').toLowerCase()
    const rawRef = (t_.num_titre_foncier || t_.num_parcelle || '').toLowerCase()
    return title.includes(q) || ref.includes(q) || rawNom.includes(q) || rawRef.includes(q)
  })
  const savedTotal = filteredSavedTerrains.length
  const savedTotalPages = Math.max(1, Math.ceil(savedTotal / PAGE_SIZE))
  const savedStart = savedTotal === 0 ? 0 : (savedPage - 1) * PAGE_SIZE + 1
  const savedEnd = Math.min(savedPage * PAGE_SIZE, savedTotal)
  const savedPagines = filteredSavedTerrains.slice(savedStart - 1, savedEnd)

  const resultats = analyse?.resultats ?? []
  const filteredResultats = resultats.filter((r) => {
    if (!amcSearchInput.trim()) return true
    const q = amcSearchInput.toLowerCase().trim()
    const nom = (r.nom || '').toLowerCase()
    const ref = (r.reference_cadastrale || r.id_parcelle || '').toLowerCase()
    return nom.includes(q) || ref.includes(q)
  })
  const parcellesTotal = filteredResultats.length
  const parcellesTotalPages = Math.max(1, Math.ceil(parcellesTotal / PAGE_SIZE))
  const parcellesStart = parcellesTotal === 0 ? 0 : (parcellesPage - 1) * PAGE_SIZE + 1
  const parcellesEnd = Math.min(parcellesPage * PAGE_SIZE, parcellesTotal)
  const resultatsPagines = filteredResultats.slice(parcellesStart - 1, parcellesEnd)

  return (
    <DashboardLayout role="investisseur" activePage="ranking" projectContext={{ id: projet.id, name: projet.nom }}>
      <div className="classement-page">
        <div className="classement-header">
          <div>
            <h2 className="classement-title">{t('ranking.title')} : {projet.nom}</h2>
            <p className="classement-desc">{t('ranking.desc')}</p>
          </div>
        </div>

        <div className="classement-tabs">
          <button type="button" className={`classement-tab${tab === 'parcelles' ? ' classement-tab--active' : ''}`} onClick={() => setTab('parcelles')}>
            {t('ranking.tab_parcelles')}
          </button>
          <button type="button" className={`classement-tab${tab === 'terrains' ? ' classement-tab--active' : ''}`} onClick={() => setTab('terrains')}>
            {t('ranking.tab_terrains')}
          </button>
          <button type="button" className={`classement-tab${tab === 'rentabilite' ? ' classement-tab--active' : ''}`} onClick={() => setTab('rentabilite')}>
            {t('ranking.tab_rentabilite')}
          </button>
        </div>

        <div id="page-alert" className="form-alert form-alert--success" hidden={!(alert?.type === 'success')}>{alert?.type === 'success' ? alert.message : ''}</div>
        <div id="page-error" className="form-alert form-alert--error" hidden={!(alert?.type === 'error')}>{alert?.type === 'error' ? alert.message : ''}</div>

        {tab === 'parcelles' ? (
          <>
            <div className="classement-toolbar">
              <div className="classement-search">
                {icons.search}
                <input
                  type="search"
                  id="classement-saved-search"
                  className="classement-search-input"
                  placeholder={t('ranking.search_placeholder')}
                  value={savedSearchInput}
                  onChange={(e) => {
                    setSavedSearchInput(e.target.value)
                    setSavedPage(1)
                  }}
                />
              </div>
              <span className="classement-count">{savedTotal} {t('ranking.total_terrains')}</span>
            </div>

            <div className="classement-table-wrapper">
              <table className="classement-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('ranking.col_parcelle')}</th>
                    <th>{t('ranking.col_surface')}</th>
                    <th>{t('ranking.res_ca')}</th>
                    <th>{t('ranking.res_cout_total')}</th>
                    <th>{t('ranking.res_benefice')}</th>
                    <th>{t('ranking.res_tri')}</th>
                    <th>{t('ranking.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {savedLoading ? (
                    <tr><td colSpan={8} className="classement-table-empty">{t('ranking.loading')}</td></tr>
                  ) : savedTerrains.length > 0 ? (
                    savedPagines.map((t_, idx) => {
                      const r = t_.rentabilite_json as Record<string, unknown> | null
                      const ca = ((r?.ca as Record<string, unknown> | undefined)?.ca_total as number) ?? (r?.ca_total as number) ?? null
                      const cout = r?.cout_total_projet as number ?? null
                      const benefice = r?.benefice_net as number ?? null
                      const tri = r?.tri as number ?? null
                      const rank = (savedPage - 1) * PAGE_SIZE + idx + 1
                      return (
                        <tr key={t_.id}>
                          <td><span className="classement-rank">#{rank}</span></td>
                          <td>
                            <div className="classement-parcelle">
                              <strong>{formatParcelleTitle({ nom: t_.nom, num: t_.num_titre_foncier || t_.num_parcelle, indice: t_.indice })}</strong>
                              <span className="classement-ref">{formatParcelleRef(t_.num_titre_foncier || t_.num_parcelle || t_.nom, t_.indice) || '—'}</span>
                            </div>
                          </td>
                          <td>{Number(t_.superficie).toLocaleString('fr-FR')} m²</td>
                          <td>{fmtMAD(ca)}</td>
                          <td>{fmtMAD(cout)}</td>
                          <td>
                            {benefice != null ? (
                              <span className={benefice >= 0 ? 'text-success' : 'text-error'} style={{ fontWeight: 600 }}>
                                {fmtMAD(benefice)}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td>{tri != null ? `${tri.toFixed(1)}%` : '—'}</td>
                          <td>
                            <div className="classement-table-actions">
                              <button
                                type="button"
                                className="table-action-btn"
                                title={t('ranking.view_details')}
                                onClick={() => setSelectedTerrainDetail(t_)}
                              >
                                {icons.eye}
                              </button>
                              <Link
                                to={`/projets/${projet.id}/classement/ajouter?parcelle=${encodeURIComponent(t_.num_titre_foncier || t_.num_parcelle || t_.nom)}&hideCard=1`}
                                className="table-action-btn"
                                title={t('ranking.view_map')}
                              >
                                {icons.mapPin}
                              </Link>
                              <button
                                type="button"
                                className="table-action-btn table-action-btn--danger"
                                title={t('common.delete')}
                                onClick={() => { void handleDelete(t_.id) }}
                              >
                                {icons.trash}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr><td colSpan={8} className="classement-table-empty">{t('ranking.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {savedTotalPages > 1 && (
              <div className="users-pagination">
                <span className="pagination-info">
                  {t('messages.pagination_showing')} {savedStart}-{savedEnd} {t('messages.pagination_on')} {savedTotal}{' '}
                  {t('messages.pagination_results')}
                </span>
                <div className="users-pagination-controls">
                  <button type="button" className="pagination-btn" disabled={savedPage <= 1} onClick={() => setSavedPage((p) => Math.max(1, p - 1))}>
                    {icons.chevronLeft} {t('messages.pagination_prev')}
                  </button>
                  {Array.from({ length: savedTotalPages }, (_, i) => {
                    const p = i + 1
                    return (
                      <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === savedPage ? ' pagination-btn--active' : ''}`} onClick={() => setSavedPage(p)}>{p}</button>
                    )
                  })}
                  <button type="button" className="pagination-btn" disabled={savedPage >= savedTotalPages} onClick={() => setSavedPage((p) => Math.min(savedTotalPages, p + 1))}>
                    {t('messages.pagination_next')} {icons.chevron}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : tab === 'terrains' ? (
          <>
            <div className="classement-toolbar">
              <div className="classement-search">
                {icons.search}
                <input type="search" id="classement-search" className="classement-search-input" placeholder={t('ranking.search_placeholder')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
              </div>
              <span className="classement-count">{totalCount} {t('ranking.total_terrains')}</span>
              <button type="button" className="btn btn-primary btn-action" onClick={() => navigate(`/projets/${projetId}/classement/ajouter?add=1`)}>
                {icons.plus} {t('ranking.add_terrain')}
              </button>
            </div>

            <div className="classement-table-wrapper">
              <table className="classement-table">
                <thead>
                  <tr>
                    <th>{t('ranking.col_name')}</th>
                    <th>{t('ranking.col_surface')}</th>
                    <th>{t('ranking.col_indice')}</th>
                    <th>{t('ranking.col_consistance')}</th>
                    <th>{t('ranking.col_coords')}</th>
                    <th>{t('ranking.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {terrainsLoading ? (
                    <tr><td colSpan={6} className="classement-table-empty">{t('ranking.loading')}</td></tr>
                  ) : terrains.length > 0 ? (
                    terrains.map((t_) => renderTerrainRow(t_, (terrainId) => { void handleDelete(terrainId) }))
                  ) : (
                    <tr><td colSpan={6} className="classement-table-empty">{t('ranking.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalCount > 0 ? (
              <div className="users-pagination">
                <span className="pagination-info">
                  {t('messages.pagination_showing')} {start}-{end} {t('messages.pagination_on')} {totalCount}{' '}
                  {t('messages.pagination_results')}
                </span>
                <div className="users-pagination-controls">
                  <button type="button" className="pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {icons.chevronLeft} {t('messages.pagination_prev')}
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => {
                    const p = i + 1
                    if (totalPages > 7) {
                      if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                        return (
                          <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === page ? ' pagination-btn--active' : ''}`} data-page={p} onClick={() => setPage(p)}>{p}</button>
                        )
                      }
                      if (p === page - 2 || p === page + 2) {
                        return <span className="pagination-ellipsis" key={i}>...</span>
                      }
                      return null
                    }
                    return (
                      <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === page ? ' pagination-btn--active' : ''}`} data-page={p} onClick={() => setPage(p)}>{p}</button>
                    )
                  })}
                  <button type="button" className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    {t('messages.pagination_next')} {icons.chevron}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : tab === 'rentabilite' ? (
          <>
            <div className="classement-toolbar">
              <div className="classement-search">
                {icons.search}
                <input
                  type="search"
                  id="classement-amc-search"
                  className="classement-search-input"
                  placeholder={t('ranking.search_placeholder')}
                  value={amcSearchInput}
                  onChange={(e) => {
                    setAmcSearchInput(e.target.value)
                    setParcellesPage(1)
                  }}
                />
              </div>
              <span className="classement-count">{parcellesTotal} {t('ranking.total_terrains')}</span>
              <button
                type="button"
                className="btn btn-secondary btn-action"
                disabled={analyses.length === 0}
                onClick={() => setHistoryOpen(true)}
              >
                {icons.database} {t('ranking.analysis_history')}
              </button>
            </div>

            {analyse && (
              <div className="classement-summary-bar">
                <span className="classement-summary-item">
                  {t('ranking.last_analysis')} : <strong>{formatDate(analyse.date_creation)}</strong>
                </span>
                <span className="classement-summary-item">
                  {analyse.nombre_parcelles} {t('ranking.analyses_count')}
                </span>
                <span className="classement-summary-item">
                  {t('ranking.col_conformite')} : <strong>{statusLabel(analyse.statut)}</strong>
                </span>
              </div>
            )}

            <div className="classement-table-wrapper">
              <table className="classement-table">
                <thead>
                  <tr>
                    <th>{t('ranking.col_rang')}</th>
                    <th>{t('ranking.col_parcelle')}</th>
                    <th>{t('ranking.col_surface')}</th>
                    <th>{t('ranking.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultatsPagines.length > 0 ? (
                    resultatsPagines.map((r) => (
                      <tr key={r.id}>
                        <td><span className="classement-rank">#{r.rang}</span></td>
                        <td>
                          <div className="classement-parcelle">
                            <strong>{r.nom}</strong>
                            <span className="classement-ref">{r.reference_cadastrale || r.id_parcelle}</span>
                          </div>
                        </td>
                        <td>{formatSurface(r.superficie)}</td>
                        <td>
                          <div className="classement-table-actions">
                            <button type="button" className="table-action-btn" title={t('ranking.view_details')} onClick={() => setDetail(r)}>{icons.eye}</button>
                            <Link
                              to={`/projets/${projet.id}/classement/ajouter?analyse=${analyse?.id ?? ''}&parcelle=${encodeURIComponent(r.reference_cadastrale || r.id_parcelle)}`}
                              className="table-action-btn"
                              title={t('ranking.view_map')}
                            >{icons.mapPin}</Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="classement-table-empty">{t('ranking.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {parcellesTotalPages > 1 && (
              <div className="users-pagination">
                <span className="pagination-info">
                  {t('messages.pagination_showing')} {parcellesStart}-{parcellesEnd} {t('messages.pagination_on')} {parcellesTotal}{' '}
                  {t('messages.pagination_results')}
                </span>
                <div className="users-pagination-controls">
                  <button type="button" className="pagination-btn" disabled={parcellesPage <= 1} onClick={() => setParcellesPage((p) => Math.max(1, p - 1))}>
                    {icons.chevronLeft} {t('messages.pagination_prev')}
                  </button>
                  {Array.from({ length: parcellesTotalPages }, (_, i) => {
                    const p = i + 1
                    if (parcellesTotalPages > 7) {
                      if (p === 1 || p === parcellesTotalPages || (p >= parcellesPage - 1 && p <= parcellesPage + 1)) {
                        return (
                          <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === parcellesPage ? ' pagination-btn--active' : ''}`} onClick={() => setParcellesPage(p)}>{p}</button>
                        )
                      }
                      if (p === parcellesPage - 2 || p === parcellesPage + 2) {
                        return <span className="pagination-ellipsis" key={i}>...</span>
                      }
                      return null
                    }
                    return (
                      <button key={i} type="button" className={`pagination-btn pagination-btn--page${p === parcellesPage ? ' pagination-btn--active' : ''}`} onClick={() => setParcellesPage(p)}>{p}</button>
                    )
                  })}
                  <button type="button" className="pagination-btn" disabled={parcellesPage >= parcellesTotalPages} onClick={() => setParcellesPage((p) => Math.min(parcellesTotalPages, p + 1))}>
                    {t('messages.pagination_next')} {icons.chevron}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {detail ? <DetailModal resultat={detail} cadastre={cadastreAttrs[String(detail.reference_cadastrale || detail.id_parcelle)] || null} onClose={() => setDetail(null)} /> : null}

      {selectedTerrainDetail ? <TerrainDetailModal terrain={selectedTerrainDetail} projetId={projetId} cadastre={cadastreAttrs[String(selectedTerrainDetail.num_titre_foncier || selectedTerrainDetail.num_parcelle || '')] || null} onClose={() => setSelectedTerrainDetail(null)} /> : null}

      {historyOpen ? (
        <div className="admin-modal-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="admin-modal classement-modal--history" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{t('ranking.history_title')}</h3>
              <button type="button" className="admin-modal-close" aria-label={t('common.close')} onClick={() => setHistoryOpen(false)}>{icons.close}</button>
            </div>
            <div className="classement-modal-body">
              {analyses.length === 0 ? (
                <div className="classement-empty">
                  <p className="classement-empty-desc">{t('ranking.no_classement_desc')}</p>
                </div>
              ) : (
                <div className="classement-history-list">
                  {analyses.map((a) => (
                    <div key={a.id} className={`classement-history-item${analyse?.id === a.id ? ' classement-history-item--active' : ''}`}>
                      <div className="classement-history-info">
                        <span className="classement-history-date">{formatDate(a.date_creation)}</span>
                        <span className="classement-history-meta">
                          {a.nombre_parcelles} {t('ranking.analyses_count')} · {statusLabel(a.statut)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-action"
                        style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        disabled={historyLoading}
                        onClick={() => { void openHistoryAnalyse(a.id) }}
                        title="Afficher les résultats dans la liste de classement"
                      >
                        {icons.eye} Voir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

    </DashboardLayout>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { t } from '../../i18n/index'
import type { TerrainPondere } from '../../api/analyses'
import { previewRentabilite, type Rentabilite, type ProjetPayload } from '../../api/projets'
import { saveTerrainRentabilite, createTerrain } from '../../api/terrains'
import { formatApiErrors } from '../../api/auth'

interface ResultatsStepProps {
  resultats: TerrainPondere[]
  poidsGlobaux: Record<string, number>
  poidsAhp?: Record<string, number>
  projetId: number
  onRestart: () => void
  /** Quand fourni, remplace la navigation vers la carte SIG */
  onViewOnMap?: (terrain: TerrainPondere) => void
  /** Quand fourni, remplace le modal interne de rentabilité */
  onOpenRentabilite?: (terrain: TerrainPondere) => void
  /** Masquer les liens de navigation du bas (utile dans le geoportal) */
  hideNavLinks?: boolean
}

const CRITERE_LABELS: Record<string, string> = {
  enseignement: 'Enseignement',
  sante: 'Santé',
  administration: 'Administration',
  routes: 'Routes',
  localisation: 'Localisation',
  situation_administrative: 'Situation administrative',
  pente: 'Pente',
}

function scoreColor(score: number): string {
  if (score >= 0.7) return '#22c55e'
  if (score >= 0.4) return '#f59e0b'
  return '#ef4444'
}

function formatMAD(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M MAD`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} k MAD`
  return `${value.toLocaleString('fr-FR')} MAD`
}

export function ResultatsStep({
  resultats,
  poidsGlobaux,
  projetId,
  onRestart,
  onViewOnMap,
  onOpenRentabilite,
  hideNavLinks,
}: ResultatsStepProps): React.JSX.Element {
  const navigate = useNavigate()
  const [seuil, setSeuil] = useState(0.0)
  const [expandedId, setExpandedId] = useState<number | null>(resultats.length > 0 ? resultats[0].id : null)

  // Modal Rentabilité Rapide
  const [selectedRentaTerrain, setSelectedRentaTerrain] = useState<TerrainPondere | null>(null)
  const [rentaCalculating, setRentaCalculating] = useState(false)
  const [rentaResult, setRentaResult] = useState<Rentabilite | null>(null)
  const [rentaError, setRentaError] = useState<string | null>(null)
  const [rentaSaving, setRentaSaving] = useState(false)
  const [rentaSuccess, setRentaSuccess] = useState<string | null>(null)

  // Paramètres financiers rentabilité
  const [prixVenteM2, setPrixVenteM2] = useState('8500')
  const [coutConstrM2, setCoutConstrM2] = useState('3500')
  const [tauxImprevus, setTauxImprevus] = useState('5')

  const filtered = resultats.filter((r) => r.score_final >= seuil)

  const handleOpenRentabilite = (terrain: TerrainPondere): void => {
    setSelectedRentaTerrain(terrain)
    setRentaResult(null)
    setRentaError(null)
    setRentaSuccess(null)
  }

  const handleCalculateRentabilite = async (): Promise<void> => {
    if (!selectedRentaTerrain) return
    setRentaCalculating(true)
    setRentaError(null)
    setRentaSuccess(null)

    const surf = Math.round(selectedRentaTerrain.superficie) || 1000
    const surfConstruite = Math.round(surf * 0.8)

    const payload: ProjetPayload = {
      nom: `Projet - ${selectedRentaTerrain.nom}`,
      id_type: 1,
      budget_total: Math.round(surfConstruite * (Number(coutConstrM2) || 3500) * 1.15),
      surface_souhaitee: surf,
      surface_construite: surfConstruite,
      prix_vente_unitaire: Number(prixVenteM2) || 8500,
      cout_construction: Number(coutConstrM2) || 3500,
      taux_imprevus: Number(tauxImprevus) || 5,
    }

    try {
      const res = await previewRentabilite(payload)
      setRentaResult(res)
      if (!res.ok) setRentaError(res.error || 'Erreur lors du calcul')
    } catch (err) {
      setRentaError(formatApiErrors(err))
    } finally {
      setRentaCalculating(false)
    }
  }

  const handleSaveRentabilite = async (): Promise<void> => {
    if (!selectedRentaTerrain || !rentaResult?.ok) return
    setRentaSaving(true)
    setRentaError(null)
    try {
      let terrainId = selectedRentaTerrain.id
      // Si terrain non encore persisté en table terrain
      try {
        await saveTerrainRentabilite(projetId, terrainId, rentaResult as unknown as Record<string, unknown>)
      } catch {
        const created = await createTerrain(projetId, {
          num_titre_foncier: selectedRentaTerrain.reference_cadastrale || selectedRentaTerrain.nom,
          superficie: Math.round(selectedRentaTerrain.superficie),
          lat: selectedRentaTerrain.lat,
          lng: selectedRentaTerrain.lng,
          statut_juridique: 'titre',
          zonage: 'residentiel',
          prix_demande: null,
          cos: null,
          cus: null,
          hauteur_maximale: null,
          geometry: '',
          equipements: [],
        })
        terrainId = created.id
        await saveTerrainRentabilite(projetId, terrainId, rentaResult as unknown as Record<string, unknown>)
      }
      setRentaSuccess('Calcul de rentabilité enregistré avec succès pour ce terrain !')
    } catch (err) {
      setRentaError(formatApiErrors(err))
    } finally {
      setRentaSaving(false)
    }
  }

  return (
    <div className="resultats-step">
      <div className="resultats-header-block">
        <h3 className="resultats-step-title">{t('ponderation.resultats_title')}</h3>
        <p className="resultats-step-desc">
          Les terrains candidats ont été évalués et classés selon vos préférences multicritères.
        </p>
      </div>

      {/* Synthèse des poids */}
      {(() => {
        const sortedPoids = Object.entries(poidsGlobaux)
          .sort(([, a], [, b]) => b - a)
          .map(([key, val]) => ({ key, label: CRITERE_LABELS[key] || key, pct: Math.round(val * 100) }))
        const mainCriteria = sortedPoids[0]
        const synthesisText = sortedPoids.length > 0
          ? `D'après vos réponses, le critère « ${mainCriteria.label} » pèse le plus (${mainCriteria.pct}%), suivi de « ${sortedPoids[1]?.label ?? ''} » (${sortedPoids[1]?.pct ?? 0}%).`
          : ''
        return (
          <div className="resultats-synthesis">
            <span className="resultats-synthesis-icon">💡</span>
            <p className="resultats-synthesis-text">{synthesisText}</p>
          </div>
        )
      })()}

      {/* Filtre Score Minimum */}
      <div className="resultats-filter-bar">
        <div className="resultats-filter-left">
          <label htmlFor="score-slider" className="resultats-filter-label">
            Score minimum requis : <strong>{(seuil * 100).toFixed(0)}%</strong>
          </label>
          <input
            id="score-slider"
            type="range"
            min={0}
            max={0.9}
            step={0.05}
            value={seuil}
            onChange={(e) => setSeuil(Number(e.target.value))}
            className="resultats-seuil-slider"
          />
        </div>
        <div className="resultats-filter-stats">
          <span className="resultats-count-badge">
            <strong>{filtered.length}</strong> / {resultats.length} terrains retenus
          </span>
        </div>
      </div>

      {/* Liste des Terrains Classés */}
      <div className="resultats-list">
        {filtered.length === 0 ? (
          <div className="resultats-empty">
            <div className="resultats-empty-icon">🔍</div>
            <p>{t('ponderation.no_results')}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setSeuil(0)}>
              Réinitialiser le filtre à 0%
            </button>
          </div>
        ) : (
          filtered.map((terrain) => {
            const isExpanded = expandedId === terrain.id
            const pct = Math.round(terrain.score_final * 100)
            const color = scoreColor(terrain.score_final)

            return (
              <div key={terrain.id} className={`ponderation-terrain-card ${isExpanded ? 'ponderation-terrain-card--expanded' : ''}`}>
                <div
                  className="ponderation-card-header"
                  onClick={() => setExpandedId(isExpanded ? null : terrain.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="ponderation-rank-box">
                    <span className={`ponderation-rank-badge ${terrain.rang <= 3 ? `ponderation-rank-badge--top${terrain.rang}` : ''}`}>
                      #{terrain.rang}
                    </span>
                  </div>

                  <div className="ponderation-main-info">
                    <div className="ponderation-title-row">
                      <h4 className="ponderation-terrain-name">{terrain.nom}</h4>
                      {terrain.reference_cadastrale && (
                        <span className="ponderation-cadastre-ref">Réf : {terrain.reference_cadastrale}</span>
                      )}
                    </div>
                    <div className="ponderation-meta-row">
                      <span className="ponderation-meta-item">
                        📏 {Number(terrain.superficie).toLocaleString('fr-FR')} m²
                      </span>
                      <span className="ponderation-meta-item">
                        📍 {terrain.zone_localisation === 'centre_ville' ? 'Centre-ville' : terrain.zone_localisation === 'periurbaine' ? 'Périphérie' : 'Zone rurale'}
                      </span>
                      {terrain.pente != null && (
                        <span className="ponderation-meta-item">
                          ⛰️ Pente : {terrain.pente.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ponderation-score-box">
                    <div className="ponderation-score-pill" style={{ borderColor: color, color }}>
                      <span className="ponderation-score-num">{pct}%</span>
                    </div>
                    <div className="ponderation-progress-bar">
                      <div
                        className="ponderation-progress-fill"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="ponderation-toggle-btn"
                    aria-label={isExpanded ? 'Masquer le détail' : 'Voir le détail'}
                  >
                    {isExpanded ? '▲ Masquer' : '▼ Voir le détail'}
                  </button>
                </div>

                {/* Section Détail Accordéon */}
                {isExpanded && (
                  <div className="ponderation-detail-panel">
                    <div className="ponderation-detail-header">
                      <h5>Détail des performances par critère — Score global : {pct}%</h5>
                    </div>

                    <div className="resultats-contrib-icons">
                      {[...terrain.contributions]
                        .sort((a, b) => b.contribution - a.contribution)
                        .map((c) => (
                          <div key={c.critere} className="resultats-contrib-row">
                            <span className="resultats-contrib-icon">
                              {c.score >= 0.8 ? '✅' : c.score >= 0.5 ? '🟡' : '❌'}
                            </span>
                            <span className="resultats-contrib-name">{CRITERE_LABELS[c.critere] || c.critere}</span>
                            <div className="resultats-contrib-bar">
                              <div
                                className="resultats-contrib-fill"
                                style={{ width: `${c.score * 100}%`, backgroundColor: scoreColor(c.score) }}
                              />
                            </div>
                            <span className="resultats-contrib-pct">{Math.round(c.score * 100)}%</span>
                          </div>
                        ))}
                    </div>

                    {/* Actions sur le terrain sélectionné */}
                    <div className="ponderation-terrain-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-action"
                        onClick={() =>
                          onViewOnMap
                            ? onViewOnMap(terrain)
                            : navigate(
                                `/projets/${projetId}/classement/ajouter?parcelle=${encodeURIComponent(
                                  terrain.reference_cadastrale || terrain.nom,
                                )}&lat=${terrain.lat}&lng=${terrain.lng}`,
                              )
                        }
                      >
                        🗺️ Voir sur la carte SIG
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-action"
                        onClick={() =>
                          onOpenRentabilite
                            ? onOpenRentabilite(terrain)
                            : handleOpenRentabilite(terrain)
                        }
                      >
                        💰 Calculer la rentabilité de ce terrain
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Navigation de bas de page */}
      {!hideNavLinks && (
        <div className="step-actions">
          <button type="button" className="btn btn-secondary" onClick={onRestart}>
            🔄 {t('ponderation.restart')}
          </button>
          <Link to={`/projets/${projetId}/classement`} className="btn btn-primary">
            📊 Accéder au tableau de classement
          </Link>
        </div>
      )}

      {/* Modal de calcul de rentabilité pour le terrain sélectionné */}
      {selectedRentaTerrain && (
        <div className="admin-modal-overlay" onClick={() => setSelectedRentaTerrain(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Calcul de rentabilité — {selectedRentaTerrain.nom}</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedRentaTerrain(null)}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="renta-terrain-info-card">
                <div>
                  <strong>Terrain :</strong> {selectedRentaTerrain.nom} ({Number(selectedRentaTerrain.superficie).toLocaleString('fr-FR')} m²)
                </div>
                <div>
                  <strong>Score multicritère :</strong> {(selectedRentaTerrain.score_final * 100).toFixed(0)}% (Rang #{selectedRentaTerrain.rang})
                </div>
              </div>

              <div className="renta-form-grid">
                <div className="form-group">
                  <label>Prix de vente moyen estimé (MAD/m²)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={prixVenteM2}
                    onChange={(e) => setPrixVenteM2(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Coût de construction estimé (MAD/m²)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={coutConstrM2}
                    onChange={(e) => setCoutConstrM2(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Taux imprévus & honoraires (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={tauxImprevus}
                    onChange={(e) => setTauxImprevus(e.target.value)}
                  />
                </div>
              </div>

              {rentaError && <div className="form-alert form-alert--error">{rentaError}</div>}
              {rentaSuccess && <div className="form-alert form-alert--success">{rentaSuccess}</div>}

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={rentaCalculating}
                  onClick={handleCalculateRentabilite}
                >
                  {rentaCalculating ? 'Calcul en cours...' : '⚡ Lancer la simulation financière'}
                </button>
              </div>

              {rentaResult && rentaResult.ok && (
                <div className="renta-results-box" style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', color: 'var(--color-navy)' }}>Indicateurs financiers prévisionnels</h4>
                  <div className="renta-metrics-grid">
                    <div className="renta-metric-card">
                      <span className="renta-metric-label">Chiffre d'Affaires Total</span>
                      <strong className="renta-metric-val">{formatMAD(rentaResult.ca?.ca_total)}</strong>
                    </div>
                    <div className="renta-metric-card">
                      <span className="renta-metric-label">Coût Total du Projet</span>
                      <strong className="renta-metric-val">{formatMAD(rentaResult.cout_total_projet)}</strong>
                    </div>
                    <div className="renta-metric-card">
                      <span className="renta-metric-label">Bénéfice Net Prévisionnel</span>
                      <strong className={`renta-metric-val ${(rentaResult.benefice_net || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {formatMAD(rentaResult.benefice_net)}
                      </strong>
                    </div>
                    <div className="renta-metric-card">
                      <span className="renta-metric-label">Taux de Rentabilité Interne (TRI)</span>
                      <strong className={`renta-metric-val ${(rentaResult.tri || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {rentaResult.tri != null ? `${rentaResult.tri.toFixed(1)} %` : '—'}
                      </strong>
                    </div>
                    <div className="renta-metric-card">
                      <span className="renta-metric-label">Retour sur Investissement (ROI)</span>
                      <strong className={`renta-metric-val ${(rentaResult.roi || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {rentaResult.roi != null ? `${rentaResult.roi.toFixed(1)} %` : '—'}
                      </strong>
                    </div>
                    <div className="renta-metric-card">
                      <span className="renta-metric-label">Valeur Actuelle Nette (VAN)</span>
                      <strong className={`renta-metric-val ${(rentaResult.van || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {formatMAD(rentaResult.van)}
                      </strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={rentaSaving}
                      onClick={handleSaveRentabilite}
                    >
                      {rentaSaving ? 'Enregistrement...' : '💾 Enregistrer pour ce terrain'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

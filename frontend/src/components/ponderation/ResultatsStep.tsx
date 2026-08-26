import { useState } from 'react'
import { t } from '../../i18n/index'
import type { TerrainPondere } from '../../api/analyses'

interface ResultatsStepProps {
  resultats: TerrainPondere[]
  poidsGlobaux: Record<string, number>
  projetId: number
  onRestart: () => void
  onViewOnMap?: (terrain: TerrainPondere) => void
  onOpenRentabilite?: (terrain: TerrainPondere) => void
  hideNavLinks?: boolean
  onTerrainSelect?: (terrain: TerrainPondere) => void
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

export function ResultatsStep({
  resultats,
  poidsGlobaux,
  onRestart,
  onTerrainSelect,
}: ResultatsStepProps): React.JSX.Element {
  const [seuil, setSeuil] = useState(0.0)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [insightVisible, setInsightVisible] = useState(true)

  const filtered = resultats.filter((r) => r.score_final >= seuil)

  const sortedPoids = Object.entries(poidsGlobaux)
    .sort(([, a], [, b]) => b - a)
    .map(([key, val]) => ({ key, label: CRITERE_LABELS[key] || key, pct: Math.round(val * 100) }))
  const mainCriteria = sortedPoids[0]
  const secondaryCriteria = sortedPoids[1]

  return (
    <div className="resultats-step">
      <div className="resultats-header-block">
        <h3 className="resultats-step-title">{t('ponderation.resultats_title')}</h3>
        <p className="resultats-step-desc">
          Les terrains candidats ont été évalués et classés selon vos préférences multicritères.
        </p>
      </div>

      {/* Insight synthèse — repliable */}
      {mainCriteria && (
        <div className={`resultats-synthesis ${insightVisible ? '' : 'resultats-synthesis--hidden'}`}>
          <p className="resultats-synthesis-text">
            D'après vos réponses, le critère{' '}
            <strong className="resultats-synthesis-highlight">{mainCriteria.label}</strong>
            {' '}pèse le plus (
            <strong className="resultats-synthesis-highlight">{mainCriteria.pct}%</strong>
            ), suivi de{' '}
            <strong className="resultats-synthesis-highlight">{secondaryCriteria?.label ?? ''}</strong>
            {' '}(
            <strong className="resultats-synthesis-highlight">{secondaryCriteria?.pct ?? 0}%</strong>
            ).
          </p>
          <button
            type="button"
            className="resultats-synthesis-close"
            onClick={() => setInsightVisible(false)}
            title="Masquer"
            aria-label="Masquer l'analyse"
          >
            ✕
          </button>
        </div>
      )}

      {!insightVisible && (
        <button
          type="button"
          className="resultats-synthesis-show"
          onClick={() => setInsightVisible(true)}
        >
          Afficher l'analyse
        </button>
      )}

      {/* Filtre Score Minimum */}
      <div className="resultats-filter-section">
        <div className="resultats-filter-header">
          <span className="resultats-filter-label">
            Filtrer par score minimum
            <span className="resultats-filter-label-value">
              {' '}{(seuil * 100).toFixed(0)}%
            </span>
          </span>
          <span className="resultats-count-badge">
            <strong>{filtered.length}</strong> / {resultats.length} retenus
          </span>
        </div>
        <p className="resultats-filter-desc">
          Ce curseur permet d'exclure les terrains dont le score global est inférieur au seuil choisi.
        </p>
        <div className="resultats-filter-slider-row">
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
      </div>

      {/* Liste simplifiée des terrains */}
      <div className="resultats-simple-list">
        {filtered.length === 0 ? (
          <div className="resultats-empty">
            <p>{t('ponderation.no_results')}</p>
            <button
              type="button"
              className="wz-btn wz-btn--secondary"
              onClick={() => setSeuil(0)}
            >
              Réinitialiser le filtre
            </button>
          </div>
        ) : (
          filtered.map((terrain) => {
            const pct = Math.round(terrain.score_final * 100)
            const color = scoreColor(terrain.score_final)
            const isActive = expandedId === terrain.id

            return (
              <button
                key={terrain.id}
                type="button"
                className={`resultats-simple-row ${isActive ? 'resultats-simple-row--active' : ''}`}
                onClick={() => {
                  setExpandedId(terrain.id)
                  onTerrainSelect?.(terrain)
                }}
              >
                <span className="resultats-simple-rank">
                  #{terrain.rang}
                </span>
                <div className="resultats-simple-info">
                  <span className="resultats-simple-name">{terrain.nom}</span>
                  <span className="resultats-simple-meta">
                    {terrain.reference_cadastrale && <span>{terrain.reference_cadastrale}</span>}
                    <span>{Number(terrain.superficie).toLocaleString('fr-FR')} m²</span>
                    <span>{terrain.zone_localisation === 'centre_ville' ? 'Centre-ville' : 'Périphérie'}</span>
                  </span>
                </div>
                <span className="resultats-simple-score" style={{ color }}>
                  {pct}%
                </span>
              </button>
            )
          })
        )}
      </div>

      {filtered.length > 0 && (
        <div className="step-actions">
          <button
            type="button"
            className="wz-btn wz-btn--secondary"
            onClick={onRestart}
          >
            Recommencer l'analyse
          </button>
        </div>
      )}
    </div>
  )
}

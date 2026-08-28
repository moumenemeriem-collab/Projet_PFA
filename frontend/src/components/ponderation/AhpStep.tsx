import { useState, useRef, useCallback } from 'react'
import { t } from '../../i18n/index'
import { calculerPoidsAHP, type AhpResult } from '../../utils/ahp'
import { WizardNextButton } from './WizardNextButton'

interface AhpStepProps {
  /** [a12, a23] intensités consécutives sauvegardées */
  initial?: [number, number]
  /** Ordre des catégories sauvegardé [rang1, rang2, rang3] */
  initialOrder?: string[]
  onComplete: (intensites: [number, number], ordre: string[], resultat: AhpResult) => void
  onBack?: () => void
}

const CATEGORIES = [
  { key: 'positionnement', label: 'Positionnement' },
  { key: 'accessibilite', label: 'Accessibilité' },
  { key: 'topographie', label: 'Topographie' },
]

const INTENSITY_POSITIONS = [
  { value: -3, label: 'Beaucoup plus importante' },
  { value: -2, label: 'Nettement plus importante' },
  { value: -1, label: 'Un peu plus importante' },
  { value: 0,  label: 'Approximativement égales' },
  { value: 1,  label: 'Un peu moins importante' },
  { value: 2,  label: 'Nettement moins importante' },
  { value: 3,  label: 'Beaucoup moins importante' },
]

function intensityToSaaty(v: number): number {
  if (v === 0) return 1
  if (v === -3) return 9
  if (v === -2) return 5
  if (v === -1) return 3
  if (v === 1) return 1 / 3
  if (v === 2) return 1 / 5
  if (v === 3) return 1 / 9
  return 1
}

function saatyToIntensity(r: number): number {
  if (!r || r === 1) return 0
  if (r >= 9) return -3
  if (r >= 5) return -2
  if (r >= 3) return -1
  if (r > 1) return -1
  if (r <= 1 / 9) return 3
  if (r <= 1 / 5) return 2
  if (r <= 1 / 3) return 1
  return 0
}

function getCatLabel(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.label ?? key
}

type AhpSubStep = 'ranking' | 'intensity'

export function AhpStep({ initial, initialOrder, onComplete, onBack }: AhpStepProps): React.JSX.Element {
  const defaultOrder = CATEGORIES.map(c => c.key)

  const [subStep, setSubStep] = useState<AhpSubStep>(() => {
    if (initial && initialOrder) return 'intensity'
    return 'ranking'
  })

  const [ranking, setRanking] = useState<string[]>(() => {
    if (initialOrder && initialOrder.length === 3) return initialOrder
    return defaultOrder
  })

  const [intensities, setIntensities] = useState<[number, number]>(() => {
    if (initial) return [saatyToIntensity(initial[0]), saatyToIntensity(initial[1])]
    return [0, 0]
  })

  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const handleDragStart = useCallback((index: number): void => {
    dragItem.current = index
  }, [])

  const handleDragEnter = useCallback((index: number): void => {
    dragOverItem.current = index
  }, [])

  const handleDragEnd = useCallback((): void => {
    if (dragItem.current === null || dragOverItem.current === null) return
    const newRanking = [...ranking]
    const dragged = newRanking[dragItem.current]
    newRanking.splice(dragItem.current, 1)
    newRanking.splice(dragOverItem.current, 0, dragged)
    dragItem.current = null
    dragOverItem.current = null
    setRanking(newRanking)
  }, [ranking])

  const moveUp = (index: number): void => {
    if (index <= 0) return
    const next = [...ranking]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setRanking(next)
  }

  const moveDown = (index: number): void => {
    if (index >= ranking.length - 1) return
    const next = [...ranking]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setRanking(next)
  }

  const handleIntensityChange = (pairIndex: number, value: number): void => {
    const next: [number, number] = [...intensities]
    next[pairIndex] = value
    setIntensities(next)
  }

  const saatyValues: [number, number] = [
    intensityToSaaty(intensities[0]),
    intensityToSaaty(intensities[1]),
  ]

  const resultat = calculerPoidsAHP(saatyValues, ranking as [string, string, string])

  const handleValidateRanking = (): void => {
    setSubStep('intensity')
  }

  const handleBackToRanking = (): void => {
    setSubStep('ranking')
  }

  const handleComplete = (): void => {
    onComplete(saatyValues, ranking, resultat)
  }

  return (
    <div className="ahp-step">
      <h3 className="ahp-step-title">{t('ponderation.ahp_title')}</h3>
      <p className="ahp-step-desc">{t('ponderation.ahp_desc')}</p>

      {/* Sub-step indicator */}
      <div className="ahp-substep-indicator">
        <span className={`ahp-substep-dot ${subStep === 'ranking' ? 'ahp-substep-dot--active' : 'ahp-substep-dot--done'}`}>
          {subStep === 'ranking' ? '1' : '✓'}
        </span>
        <span className="ahp-substep-line" />
        <span className={`ahp-substep-dot ${subStep === 'intensity' ? 'ahp-substep-dot--active' : ''}`}>
          2
        </span>
      </div>

      {/* ═══ Sub-step A: Ranking ═══ */}
      {subStep === 'ranking' && (
        <div className="ahp-ranking">
          <p className="ahp-ranking-question">
            Classez les 3 catégories du plus important au moins important pour votre recherche de terrain.
          </p>
          <p className="ahp-ranking-hint">
            Plus une catégorie est placée en haut, plus elle influencera le classement final.
          </p>

          <div className="ahp-ranking-container">
            <div className="ahp-ranking-top-label">▲ Plus important</div>

            <div className="ahp-ranking-list">
              {ranking.map((catKey, i) => (
                <div
                  key={catKey}
                  className="ahp-ranking-item"
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragEnter={() => handleDragEnter(i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <span className="ahp-ranking-rank">#{i + 1}</span>
                  <span className="ahp-ranking-drag-handle" title="Glisser pour réordonner">⋮⋮</span>
                  <span className="ahp-ranking-cat-name">{getCatLabel(catKey)}</span>
                  <div className="ahp-ranking-reorder-btns">
                    <button type="button" className="ahp-ranking-reorder-btn" onClick={() => moveUp(i)} disabled={i === 0} title="Monter">▲</button>
                    <button type="button" className="ahp-ranking-reorder-btn" onClick={() => moveDown(i)} disabled={i === ranking.length - 1} title="Descendre">▼</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="ahp-ranking-bottom-label">▼ Moins important</div>
          </div>

          <div className="step-actions">
            {onBack && (
              <WizardNextButton variant="secondary" onClick={onBack}>
                {t('ponderation.previous')}
              </WizardNextButton>
            )}
            <WizardNextButton onClick={handleValidateRanking}>
              Définir l'intensité
            </WizardNextButton>
          </div>
        </div>
      )}

      {/* ═══ Sub-step B: Intensity ═══ */}
      {subStep === 'intensity' && (
        <div className="ahp-intensity">
          <p className="ahp-intensity-intro">
            Pour chaque paire de catégories consécutives, indiquez l'importance relative de la première par rapport à la seconde.
          </p>

          {/* Pair 1: rang1 vs rang2 */}
          <div className="ahp-intensity-card">
            <div className="ahp-intensity-header">
              <span className="ahp-intensity-cat ahp-intensity-cat--left">{getCatLabel(ranking[0])}</span>
              <span className="ahp-intensity-vs">vs</span>
              <span className="ahp-intensity-cat ahp-intensity-cat--right">{getCatLabel(ranking[1])}</span>
            </div>

            <div className="ahp-intensity-select-row">
              <label className="ahp-intensity-label">
                <span className="ahp-intensity-label-cat">{getCatLabel(ranking[0])}</span>
                {' '}est pour vous…
              </label>
              <select
                className="ahp-intensity-select"
                value={intensities[0]}
                onChange={(e) => handleIntensityChange(0, Number(e.target.value))}
              >
                {INTENSITY_POSITIONS.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pair 2: rang2 vs rang3 */}
          <div className="ahp-intensity-card">
            <div className="ahp-intensity-header">
              <span className="ahp-intensity-cat ahp-intensity-cat--left">{getCatLabel(ranking[1])}</span>
              <span className="ahp-intensity-vs">vs</span>
              <span className="ahp-intensity-cat ahp-intensity-cat--right">{getCatLabel(ranking[2])}</span>
            </div>

            <div className="ahp-intensity-select-row">
              <label className="ahp-intensity-label">
                <span className="ahp-intensity-label-cat">{getCatLabel(ranking[1])}</span>
                {' '}est pour vous…
              </label>
              <select
                className="ahp-intensity-select"
                value={intensities[1]}
                onChange={(e) => handleIntensityChange(1, Number(e.target.value))}
              >
                {INTENSITY_POSITIONS.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="step-actions">
            <WizardNextButton variant="secondary" onClick={handleBackToRanking}>
              ← Modifier le classement
            </WizardNextButton>
            <WizardNextButton onClick={handleComplete}>
              {t('ponderation.next')}
            </WizardNextButton>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useCallback } from 'react'
import { t } from '../../i18n/index'

interface RocStepProps {
  categorie: string
  categorieLabel: string
  criteresInitiaux: string[]
  critereLabels?: Record<string, string>
  onComplete: (categorie: string, ordre: string[]) => void
}

export function RocStep({
  categorie,
  categorieLabel,
  criteresInitiaux,
  critereLabels = {},
  onComplete,
}: RocStepProps): React.JSX.Element {
  const [ordre, setOrdre] = useState<string[]>(criteresInitiaux)
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

    const newOrdre = [...ordre]
    const draggedItem = newOrdre[dragItem.current]
    newOrdre.splice(dragItem.current, 1)
    newOrdre.splice(dragOverItem.current, 0, draggedItem)

    dragItem.current = null
    dragOverItem.current = null
    setOrdre(newOrdre)
  }, [ordre])

  const moveUp = (index: number): void => {
    if (index <= 0) return
    const newOrdre = [...ordre]
    ;[newOrdre[index - 1], newOrdre[index]] = [newOrdre[index], newOrdre[index - 1]]
    setOrdre(newOrdre)
  }

  const moveDown = (index: number): void => {
    if (index >= ordre.length - 1) return
    const newOrdre = [...ordre]
    ;[newOrdre[index], newOrdre[index + 1]] = [newOrdre[index + 1], newOrdre[index]]
    setOrdre(newOrdre)
  }

  const getLabel = (key: string): string => critereLabels[key] || key

  return (
    <div className="roc-step">
      <h3 className="roc-step-title">
        {t('ponderation.roc_title')} — {categorieLabel}
      </h3>
      <p className="roc-step-desc">
        Pour chaque catégorie, classez les critères du plus important au moins important. Glissez-les ou utilisez les flèches.
      </p>
      <p className="roc-step-hint">
        Plus un critère est placé en haut, plus il sera déterminant dans le classement final.
      </p>

      <div className="roc-order-container">
        <div className="roc-direction-indicator roc-direction-indicator--top">
          <span>▲ Plus important</span>
        </div>

        <div className="roc-list">
          {ordre.map((critere, i) => (
            <div
              key={critere}
              className="roc-item"
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <span className="roc-rank">#{i + 1}</span>
              <span className="roc-drag-handle" title="Glisser pour réordonner">⋮⋮</span>
              <span className="roc-critere-name">{getLabel(critere)}</span>
              <div className="roc-reorder-btns">
                <button
                  type="button"
                  className="roc-reorder-btn"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  aria-label="Monter"
                  title="Monter"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="roc-reorder-btn"
                  onClick={() => moveDown(i)}
                  disabled={i === ordre.length - 1}
                  aria-label="Descendre"
                  title="Descendre"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="roc-direction-indicator roc-direction-indicator--bottom">
          <span>▼ Moins important</span>
        </div>
      </div>

      <div className="step-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onComplete(categorie, ordre)}
        >
          {t('ponderation.next')}
        </button>
      </div>
    </div>
  )
}

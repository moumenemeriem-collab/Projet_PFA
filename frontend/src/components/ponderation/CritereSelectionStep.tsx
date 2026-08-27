import { useState } from 'react'
import { t } from '../../i18n/index'
import { WizardNextButton } from './WizardNextButton'

interface SelectionsInitiales {
  accessibilite: string[]
  route_type: string
  localisation: string
  altitude: string[]
}

interface CritereSelectionStepProps {
  initial?: SelectionsInitiales
  onComplete: (selections: SelectionsInitiales) => void
}

const EQUIPEMENTS_ACCESSibilite = [
  { key: 'enseignement', label: 'Enseignement' },
  { key: 'sante', label: 'Santé' },
  { key: 'administration', label: 'Administration' },
  { key: 'routes', label: 'Routes' },
]

const ROUTE_TYPES = [
  { key: 'peu_importe', label: 'Peu importe' },
  { key: 'route_nationale', label: 'Route nationale' },
  { key: 'route_regionale', label: 'Route régionale' },
  { key: 'route_provinciale', label: 'Route provinciale' },
  { key: 'route_locale', label: 'Route locale' },
]

const LOCALISATIONS = [
  { key: 'centre_ville', label: 'Centre-ville' },
  { key: 'periurbaine', label: 'Périphérie' },
]

const ALTITUDES = [
  { key: 'lt100', label: '< 100 m' },
  { key: '100_300', label: '100 – 300 m' },
  { key: 'gt300', label: '> 300 m' },
]

const DEFAULTS: SelectionsInitiales = {
  accessibilite: [],
  route_type: 'peu_importe',
  localisation: '',
  altitude: [],
}

export function CritereSelectionStep({ initial, onComplete }: CritereSelectionStepProps): React.JSX.Element {
  const [selections, setSelections] = useState<SelectionsInitiales>(initial ?? DEFAULTS)

  const toggleAccessibilite = (key: string): void => {
    setSelections((prev) => {
      const list = prev.accessibilite.includes(key)
        ? prev.accessibilite.filter((k) => k !== key)
        : [...prev.accessibilite, key]
      return { ...prev, accessibilite: list }
    })
  }

  // Sélection unique (radio) : une seule plage d'altitude à la fois.
  const toggleAltitude = (key: string): void => {
    setSelections((prev) => ({
      ...prev,
      altitude: prev.altitude.includes(key) ? [] : [key],
    }))
  }

  const isValid = selections.localisation && selections.altitude.length > 0

  return (
    <div className="critere-step">
      <h3 className="critere-step-title">{t('ponderation.critere_title')}</h3>
      <p className="critere-step-desc">{t('ponderation.critere_desc')}</p>

      {/* Accessibilité */}
      <div className="critere-section">
        <h4 className="critere-section-title">{t('ponderation.cat_accessibilite')}</h4>
        <p className="critere-section-desc">{t('ponderation.critere_access_desc')}</p>
        <div className="critere-chips">
          {EQUIPEMENTS_ACCESSibilite.map((eq) => (
            <button
              key={eq.key}
              type="button"
              className={`critere-chip ${selections.accessibilite.includes(eq.key) ? 'critere-chip--active' : ''}`}
              onClick={() => toggleAccessibilite(eq.key)}
            >
              {eq.label}
            </button>
          ))}
        </div>
        {selections.accessibilite.includes('routes') && (
          <div className="critere-sub">
            <label className="critere-sub-label">{t('ponderation.route_type')}</label>
            <select
              className="critere-select"
              value={selections.route_type}
              onChange={(e) => setSelections((prev) => ({ ...prev, route_type: e.target.value }))}
            >
              {ROUTE_TYPES.map((rt) => (
                <option key={rt.key} value={rt.key}>{rt.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Positionnement — Localisation */}
      <div className="critere-section">
        <h4 className="critere-section-title">{t('ponderation.localisation')}</h4>
        <div className="critere-radios">
          {LOCALISATIONS.map((loc) => (
            <label key={loc.key} className="critere-radio">
              <input
                type="radio"
                name="localisation"
                value={loc.key}
                checked={selections.localisation === loc.key}
                onChange={() => setSelections((prev) => ({ ...prev, localisation: loc.key }))}
              />
              <span>{loc.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Topographie — Altitude */}
      <div className="critere-section">
        <h4 className="critere-section-title">{t('ponderation.altitude')}</h4>
        <p className="critere-section-desc">{t('ponderation.altitude_desc')}</p>
        <div className="critere-chips">
          {ALTITUDES.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`critere-chip ${selections.altitude.includes(p.key) ? 'critere-chip--active' : ''}`}
              onClick={() => toggleAltitude(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="step-actions">
        <WizardNextButton
          disabled={!isValid}
          onClick={() => onComplete(selections)}
        >
          {t('ponderation.next')}
        </WizardNextButton>
      </div>
    </div>
  )
}

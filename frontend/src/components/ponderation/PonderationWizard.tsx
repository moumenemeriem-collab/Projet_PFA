import { useEffect, useState, useCallback } from 'react'
import { t } from '../../i18n/index'
import { CritereSelectionStep } from './CritereSelectionStep'
import { AhpStep } from './AhpStep'
import { RocStep } from './RocStep'
import { ResultatsStep } from './ResultatsStep'
import {
  createAnalysePondere,
  fetchPonderationPreferences,
  type PonderationResponse,
} from '../../api/analyses'
import { calculerPoidsAHP, type AhpResult } from '../../utils/ahp'

interface PonderationWizardProps {
  projetId: number
}

interface SelectionsInitiales {
  accessibilite: string[]
  route_type: string
  localisation: string
  altitude: string[]
}

type Step = 'selection' | 'ahp' | 'roc' | 'resultats'

export const CRITERE_LABELS: Record<string, string> = {
  enseignement: 'Enseignement',
  sante: 'Santé',
  administration: 'Administration',
  routes: 'Routes',
  localisation: 'Localisation',
  altitude: 'Altitude',
}

const CATEGORIE_LABELS: Record<string, string> = {
  accessibilite: 'ponderation.cat_accessibilite',
  positionnement: 'ponderation.cat_positionnement',
  topographie: 'ponderation.cat_topographie',
}

export function PonderationWizard({ projetId }: PonderationWizardProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('selection')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selections, setSelections] = useState<SelectionsInitiales | null>(null)
  const [matriceAhp, setMatriceAhp] = useState<[number, number] | null>(null)
  const [ordreCategoriesAhp, setOrdreCategoriesAhp] = useState<string[]>([])
  const [_ahpResult, setAhpResult] = useState<AhpResult | null>(null)
  const [ordresRoc, setOrdresRoc] = useState<Record<string, string[]>>({})
  const [rocStepsDone, setRocStepsDone] = useState<string[]>([])
  const [resultats, setResultats] = useState<PonderationResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPonderationPreferences(projetId).then((prefs) => {
      if (cancelled || !prefs) return
      const sel = prefs.selections_criteres as Record<string, unknown>
      setSelections({
        accessibilite: Array.isArray(sel.accessibilite) ? sel.accessibilite as string[] : [],
        route_type: typeof sel.route_type === 'string' ? sel.route_type : 'peu_importe',
        localisation: prefs.preferences_localisation?.localisation ?? '',
        altitude: prefs.preferences_altitude ?? [],
      })
      const rawMatrix = prefs.matrice_ahp
      if (Array.isArray(rawMatrix) && rawMatrix.length >= 2) {
        setMatriceAhp([rawMatrix[0], rawMatrix[1]])
      }
      if (Array.isArray(prefs.ordre_categories) && prefs.ordre_categories.length === 3) {
        setOrdreCategoriesAhp(prefs.ordre_categories)
      }
      setOrdresRoc(prefs.ordres_roc)
      const ordre = (Array.isArray(prefs.ordre_categories) && prefs.ordre_categories.length === 3
        ? prefs.ordre_categories
        : ['accessibilite', 'positionnement', 'topographie']) as [string, string, string]
      setAhpResult(calculerPoidsAHP(
        [rawMatrix[0], rawMatrix[1]],
        ordre,
      ))
    }).catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [projetId])

  const handleSelectionComplete = useCallback((sel: SelectionsInitiales): void => {
    setSelections(sel)
    setStep('ahp')
  }, [])

  const handleAhpComplete = useCallback((intensites: [number, number], ordre: string[], resultat: AhpResult): void => {
    setMatriceAhp(intensites)
    setOrdreCategoriesAhp(ordre)
    setAhpResult(resultat)

    const newOrdres: Record<string, string[]> = {}

    if (selections!.accessibilite.length > 0) {
      newOrdres.accessibilite = [...selections!.accessibilite]
    }

    newOrdres.positionnement = ['localisation']

    if (selections!.altitude.length > 0) {
      newOrdres.topographie = ['altitude']
    }

    setOrdresRoc(newOrdres)
    setRocStepsDone([])
    setStep('roc')
  }, [selections])

  const handleRocComplete = useCallback((categorie: string, ordre: string[]): void => {
    setOrdresRoc((prev) => ({ ...prev, [categorie]: ordre }))
    setRocStepsDone((prev) => [...prev, categorie])
  }, [])

  const rocCatsAll = Object.keys(ordresRoc)
  const rocCatsNeedRanking = rocCatsAll.filter((c) => (ordresRoc[c]?.length ?? 0) > 1)
  const nextRocCat = rocCatsNeedRanking.find((c) => !rocStepsDone.includes(c))

  // Auto-valider les catégories avec un seul sous-critère (poids ROC = 1)
  useEffect(() => {
    if (step !== 'roc') return
    const singleCritCats = rocCatsAll.filter(
      (c) => (ordresRoc[c]?.length ?? 0) === 1 && !rocStepsDone.includes(c),
    )
    if (singleCritCats.length > 0) {
      setRocStepsDone((prev) => [...prev, ...singleCritCats])
    }
  }, [step, rocCatsAll, ordresRoc, rocStepsDone])

  const allRocDone = rocCatsAll.length > 0 && rocCatsAll.every((c) => rocStepsDone.includes(c))

  useEffect(() => {
    if (!allRocDone || step !== 'roc') return

    const run = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const response = await createAnalysePondere(projetId, {
          matrice_ahp: matriceAhp!,
          ordre_categories: ordreCategoriesAhp,
          ordres_roc: ordresRoc,
          selections_criteres: {
            accessibilite: selections?.accessibilite ?? [],
            route_type: selections?.route_type ?? 'peu_importe',
          },
          preferences_localisation: {
            localisation: selections?.localisation ?? '',
          },
          preferences_altitude: Array.isArray(selections?.altitude) ? selections!.altitude : [],
          seuil: 0,
        })
        setResultats(response)
        setStep('resultats')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [allRocDone, step, matriceAhp, ordreCategoriesAhp, ordresRoc, selections, projetId])

  const handleRestart = (): void => {
    setStep('selection')
    setSelections(null)
    setMatriceAhp(null)
    setOrdreCategoriesAhp([])
    setAhpResult(null)
    setOrdresRoc({})
    setRocStepsDone([])
    setResultats(null)
    setError(null)
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'selection', label: t('ponderation.step_selection') },
    { key: 'ahp', label: t('ponderation.step_priorites') },
    { key: 'roc', label: t('ponderation.step_classement') },
    { key: 'resultats', label: t('ponderation.step_resultats') },
  ]

  const activeIdx = steps.findIndex((s) => s.key === step)

  return (
    <div className="ponderation-wizard">
      <div className="ponderation-header">
        <div className="ponderation-header-badge">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </div>
        <h2 className="ponderation-title">{t('ponderation.title')}</h2>
        <p className="ponderation-desc">{t('ponderation.desc')}</p>
      </div>

      <div className="ponderation-stepper" role="navigation" aria-label="Étapes du wizard">
        {steps.map((s, i) => {
          const isDone = i < activeIdx
          const isActive = i === activeIdx

          return (
            <div key={s.key} className="ponderation-stepper-group">
              <div
                className={`ponderation-stepper-step ${
                  isActive ? 'ponderation-stepper-step--active' : ''
                } ${isDone ? 'ponderation-stepper-step--done' : ''}`}
              >
                <span className="ponderation-stepper-num">
                  {isDone ? (
                    <svg
                      className="ponderation-stepper-check"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3.5 8.5L6.5 11.5L12.5 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="ponderation-stepper-label">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="ponderation-stepper-connector">
                  <div
                    className={`ponderation-stepper-connector-fill ${
                      i < activeIdx ? 'ponderation-stepper-connector-fill--done' : ''
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="form-alert form-alert--error">{error}</div>
      )}

      {loading && (
        <div className="ponderation-loading">
          <div className="admin-loading-spinner" />
          <p>{t('ponderation.loading')}</p>
        </div>
      )}

      {!loading && step === 'selection' && (
        <CritereSelectionStep initial={selections ?? undefined} onComplete={handleSelectionComplete} />
      )}

      {!loading && step === 'ahp' && (
        <AhpStep
          initial={matriceAhp ?? undefined}
          initialOrder={ordreCategoriesAhp.length === 3 ? ordreCategoriesAhp : undefined}
          onComplete={handleAhpComplete}
        />
      )}

      {!loading && step === 'roc' && nextRocCat && (
        <RocStep
          key={nextRocCat}
          categorie={nextRocCat}
          categorieLabel={t(CATEGORIE_LABELS[nextRocCat] ?? nextRocCat)}
          criteresInitiaux={ordresRoc[nextRocCat]}
          critereLabels={CRITERE_LABELS}
          onComplete={handleRocComplete}
        />
      )}

      {!loading && step === 'resultats' && resultats && (
        <ResultatsStep
          resultats={resultats.resultats}
          poidsGlobaux={resultats.poids_globaux}
          projetId={projetId}
          onRestart={handleRestart}
        />
      )}
    </div>
  )
}

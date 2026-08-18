import { useEffect, useRef, useState } from 'react'
import { icons } from '../../components/icons'
import { DashboardLayout } from '../../components/DashboardLayout'
import { GererLignesModal } from '../../components/GererLignesModal'
import { VisualiserModal } from '../../components/VisualiserModal'
import { formatApiErrors } from '../../api/auth'
import {
  type AttributDefinition,
  type Couche,
  fetchCouche,
  fetchCouches,
  importerCouche,
  telechargerCouche,
} from '../../api/couches'

const CATEGORIE_LABELS: Record<string, string> = {
  foncier: 'Foncier',
  urbanisme: 'Urbanisme',
  administratif: 'Administratif',
  equipements: 'Équipements',
  infrastructure: 'Infrastructure',
  topographie: 'Topographie',
}

const ATTR_BADGE_CLASS: Record<string, string> = {
  geometry: 'is-geometry',
  string: 'is-string',
  varchar: 'is-string',
  text: 'is-string',
  character: 'is-string',
  integer: 'is-number',
  int: 'is-number',
  int4: 'is-number',
  bigint: 'is-number',
  int8: 'is-number',
  smallint: 'is-number',
  int2: 'is-number',
  double: 'is-number',
  float: 'is-number',
  float8: 'is-number',
  numeric: 'is-number',
  decimal: 'is-number',
  boolean: 'is-bool',
  bool: 'is-bool',
  date: 'is-date',
  timestamp: 'is-date',
  time: 'is-date',
}

interface AlertState {
  message: string
  isError: boolean
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AdminDataPage(): React.JSX.Element {
  const [couches, setCouches] = useState<Couche[]>([])
  const [importLoading, setImportLoading] = useState<number | null>(null)
  const [detailCouche, setDetailCouche] = useState<Couche | null>(null)
  const [gererCouche, setGererCouche] = useState<Couche | null>(null)
  const [visualiserOpen, setVisualiserOpen] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [initialError, setInitialError] = useState('')
  const [alerts, setAlerts] = useState<Record<string, AlertState>>({})
  const alertTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const showAlert = (id: string, message: string, isError = false): void => {
    setAlerts((prev) => ({ ...prev, [id]: { message, isError } }))
    if (alertTimers.current[id]) clearTimeout(alertTimers.current[id])
    alertTimers.current[id] = setTimeout(() => {
      setAlerts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      delete alertTimers.current[id]
    }, 5000)
  }

  useEffect(() => {
    let cancelled = false
    const doFetch = async (): Promise<void> => {
      try {
        const data = await fetchCouches()
        if (cancelled) return
        setCouches(data)
        setInitialLoading(false)
        setInitialError('')
      } catch (error) {
        if (cancelled) return
        setInitialLoading(false)
        setInitialError(formatApiErrors(error))
      }
    }
    void doFetch()
    return () => {
      cancelled = true
    }
  }, [])

  const loadCouches = async (): Promise<void> => {
    try {
      const data = await fetchCouches()
      setCouches(data)
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    }
  }

  const handleImportClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.currentTarget.closest('form')?.querySelector<HTMLInputElement>('.import-file-input')?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const fileInput = e.currentTarget
    const file = fileInput.files?.[0]
    if (!file) return
    const tr = fileInput.closest('tr') as HTMLElement | null
    const id = Number(tr?.dataset.coucheId)
    if (!id) return
    setImportLoading(id)
    try {
      await importerCouche(id, file)
      showAlert('page-alert', `Import réussi pour ${file.name}`)
      await loadCouches()
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    } finally {
      setImportLoading(null)
      fileInput.value = ''
    }
  }

  const handleDownload = (id: number): void => {
    telechargerCouche(id)
  }

  const handleGerer = async (id: number): Promise<void> => {
    try {
      const couche = await fetchCouche(id)
      setGererCouche(couche)
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    }
  }

  const handleDetail = async (id: number): Promise<void> => {
    try {
      const couche = await fetchCouche(id)
      setDetailCouche(couche)
    } catch (error) {
      showAlert('page-error', formatApiErrors(error), true)
    }
  }

  const closeDetail = (): void => {
    setDetailCouche(null)
  }

  const renderAttributs = (attributs: AttributDefinition[]): React.ReactNode => {
    if (!attributs.length) return <span className="couche-detail-value">-</span>
    return (
      <div className="couche-attr-list">
        {attributs.map((a) => (
          <div className="couche-attr-item" key={a.nom}>
            <span className="couche-attr-name">{a.nom}</span>
            <span className={`couche-attr-type ${ATTR_BADGE_CLASS[a.type.toLowerCase()] || ''}`}>{a.type}</span>
          </div>
        ))}
      </div>
    )
  }

  const detailModal = detailCouche ? (
    <div
      className="admin-modal-overlay couche-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDetail()
      }}
    >
      <div className="admin-modal admin-modal--couche" role="dialog" aria-modal="true">
        <div className="couche-modal-header">
          <h3>{detailCouche.nom_affichage}</h3>
          <button type="button" className="couche-modal-close" aria-label="Fermer" onClick={closeDetail}>
            {icons.close}
          </button>
        </div>
        <div className="couche-modal-body">
          <div className="couche-detail-card">
            <span className="couche-detail-label">Description</span>
            <span className="couche-detail-value">{detailCouche.description || '-'}</span>
          </div>
          <div className="couche-detail-card">
            <span className="couche-detail-label">Type géométrie</span>
            <span className="couche-detail-value">{detailCouche.type_geometrie}</span>
          </div>
          <div className="couche-detail-card">
            <span className="couche-detail-label">Table liée</span>
            <span className="couche-detail-value">{detailCouche.table_liee || '-'}</span>
          </div>
          <div className="couche-detail-card">
            <span className="couche-detail-label">Format</span>
            <span className="couche-detail-value">{detailCouche.format_fichier || 'GeoJSON'}</span>
          </div>
          <div className="couche-detail-card">
            <span className="couche-detail-label">Volume</span>
            <span className="couche-detail-value">{detailCouche.taille_affichage || '-'}</span>
          </div>
          <div className="couche-detail-card">
            <span className="couche-detail-label">État</span>
            <span className="couche-detail-value">{detailCouche.etat}</span>
          </div>
          <div className="couche-detail-card">
            <span className="couche-detail-label">Attributs</span>
            {renderAttributs(detailCouche.attributs)}
          </div>
        </div>
        <div className="couche-modal-actions">
          <button type="button" className="btn btn-outline" onClick={closeDetail}>Fermer</button>
        </div>
      </div>
    </div>
  ) : null

  const alertClass = (id: string): string => {
    const a = alerts[id]
    return `contact-alert${a ? ` contact-alert--${a.isError ? 'error' : 'success'}` : ''}`
  }

  const listContent = (
    <div className="data-page">
      <div id="page-alert" className={alertClass('page-alert')} hidden={!alerts['page-alert']}>
        {alerts['page-alert']?.message ?? ''}
      </div>
      <div id="page-error" className="contact-alert contact-alert--error" hidden={!alerts['page-error']}>
        {alerts['page-error']?.message ?? ''}
      </div>
      <div className="data-toolbar">
        <div>
          <h2 className="data-page-title">Gestion des données</h2>
          <p className="data-page-desc">Gérez les couches géospatiales et leurs attributs</p>
        </div>
        <div className="data-toolbar-actions">
          <button type="button" className="data-btn-visualiser" onClick={() => setVisualiserOpen(true)}>
            {icons.layers} Visualiser
          </button>
          <span className="data-count">{couches.length} couche(s)</span>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Nom de la couche</th>
            <th>Catégorie</th>
            <th>Format</th>
            <th>Volume</th>
            <th>Date MAJ</th>
            <th>Mise à jour</th>
            <th>Télécharger</th>
            <th>Gérer</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          {couches.map((c) => {
            const loading = importLoading === c.id
            const catLabel = CATEGORIE_LABELS[c.categorie] || c.categorie
            return (
              <tr className="data-tr" data-couche-id={c.id} key={c.id}>
                <td className="data-td-name">
                  <span className="data-table-icon">{icons.layers}</span>
                  <span className="data-table-name">{c.nom_affichage}</span>
                </td>
                <td>
                  <span className={`data-cat-badge data-cat--${c.categorie}`}>{catLabel}</span>
                </td>
                <td className="data-td-format">{c.format_fichier || 'GeoJSON'}</td>
                <td className="data-td-volume">{c.taille_affichage || '-'}</td>
                <td className="data-td-date">{formatDate(c.date_mise_a_jour)}</td>
                <td className="data-td-actions">
                  <form className="data-import-row-form" style={{ display: 'inline' }}>
                    <button type="button" className="btn btn-sm btn-outline import-trigger" disabled={loading} onClick={handleImportClick}>
                      {loading ? <span className="spinner-sm"></span> : icons.download} Importer
                    </button>
                    <input
                      type="file"
                      accept=".geojson,.json"
                      className="import-file-input"
                      hidden
                      onChange={(e) => { void handleFileChange(e) }}
                    />
                  </form>
                </td>
                <td className="data-td-download">
                  <button type="button" className="btn btn-sm btn-outline download-trigger" data-couche-id={c.id} onClick={() => handleDownload(c.id)}>
                    {icons.download} Télécharger
                  </button>
                </td>
                <td className="data-td-actions">
                  {c.nom_affichage !== 'MNT' && c.nom !== 'reglement_pa' ? (
                    <button type="button" className="btn btn-sm btn-outline gerer-trigger" onClick={() => { void handleGerer(c.id) }}>
                      {icons.database} Gérer
                    </button>
                  ) : <span className="gerer-null">—</span>}
                </td>
                <td className="data-td-detail">
                  <button type="button" className="btn btn-sm btn-outline detail-trigger" data-couche-id={c.id} onClick={() => { void handleDetail(c.id) }}>
                    {icons.eye} Détails
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  let content: React.ReactNode
  if (initialLoading) {
    content = (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    )
  } else if (initialError) {
    content = (
      <div className="admin-error-state">
        <p>{initialError}</p>
      </div>
    )
  } else {
    content = listContent
  }

  const gererModal = gererCouche ? (
    <GererLignesModal
      coucheId={gererCouche.id}
      coucheName={gererCouche.nom_affichage}
      attributs={gererCouche.attributs}
      onClose={() => setGererCouche(null)}
      onUpdated={() => { void loadCouches() }}
    />
  ) : null

  const visualiserModal = visualiserOpen ? (
    <VisualiserModal onClose={() => setVisualiserOpen(false)} />
  ) : null

  return (
    <DashboardLayout role="admin" activePage="data">
      {content}
      {detailModal}
      {gererModal}
      {visualiserModal}
    </DashboardLayout>
  )
}

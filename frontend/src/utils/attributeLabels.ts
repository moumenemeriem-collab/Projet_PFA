export const ATTRIBUTE_LABELS: Record<string, string> = {
  fid: 'Identifiant',
  indice: 'Indice',
  complement: 'Complément',
  Consistance: 'Consistance',
  num: 'Numéro',
  surface: 'Revêtement',
  full_id: 'Identifiant complet',
  osm_id: 'Identifiant OSM',
  amenity: 'Type d\'équipement',
  highway: 'Type de route',
  name: 'Nom',
  ville: 'Ville / commune',
  designation: 'Désignation',
  definition: 'Définition',
  surface_min: 'Surface minimale',
  largeur_min: 'Largeur minimale',
  hauteur_max: 'Hauteur maximale',
  cos: 'COS',
  cus: 'CUS',
  type_construction: 'Type de construction',
  Surface: 'Superficie (m²)',
}

export const CADASTRE_ATTRIBUTE_LABELS: Record<string, string> = {
  ...ATTRIBUTE_LABELS,
  surface: 'Superficie (m²)',
}

export const PLAN_AMENAGEMENT_ATTRIBUTE_LABELS: Record<string, string> = {
  ...ATTRIBUTE_LABELS,
  Surface: 'Superficie (m²)',
}

export function attributeLabel(key: string, overrides: Record<string, string> = {}): string {
  const known = overrides[key] ?? ATTRIBUTE_LABELS[key]
  if (known) return known
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Formate la référence d'une parcelle cadastrale avec son indice (ex: "T25757/R").
 * Évite les doublons si le numéro contient déjà l'indice ou un slash.
 */
export function formatParcelleRef(num?: unknown, indice?: unknown): string {
  const n = String(num ?? '').trim()
  const ind = String(indice ?? '').trim()
  if (!n) return ind && ind !== '—' && ind !== '-' && ind.toLowerCase() !== 'null' ? `/${ind}` : ''
  if (
    ind &&
    ind !== '—' &&
    ind !== '-' &&
    ind.toLowerCase() !== 'null' &&
    ind.toLowerCase() !== 'undefined' &&
    !n.endsWith(`/${ind}`) &&
    !n.includes('/')
  ) {
    return `${n}/${ind}`
  }
  return n
}

/**
 * Formate le titre complet d'un terrain ou d'une parcelle (ex: "Parcelle T25757/R").
 */
export function formatParcelleTitle(props?: Record<string, unknown> | null, defaultPrefix = 'Parcelle'): string {
  if (!props) return defaultPrefix
  const num = props.num ?? props.num_parcelle ?? props.num_titre_foncier ?? props.ref ?? props.reference_cadastrale ?? props.id_parcelle ?? ''
  const indice = props.indice ?? props.Indice ?? props.INDICE ?? ''
  const ref = formatParcelleRef(num, indice)
  if (!ref) {
    const nom = String(props.nom ?? '').trim()
    if (nom) {
      if (indice && !nom.endsWith(`/${indice}`) && !nom.includes('/')) {
        return `${nom}/${indice}`
      }
      return nom
    }
    return defaultPrefix
  }
  if (ref.toLowerCase().startsWith('parcelle') || ref.toLowerCase().startsWith('terrain')) {
    return ref
  }
  return `${defaultPrefix} ${ref}`
}

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

export const ATTRIBUTE_LABELS: Record<string, string> = {
  id_parcelle: 'Identifiant parcelle',
  num_titre_foncier: 'Titre foncier',
  type_immatriculation: 'Immatriculation',
  nature_juridique: 'Nature juridique',
  superficie_m2: 'Superficie (m²)',
  commune: 'Commune',
  cercle: 'Cercle',
  province: 'Province',
  nature_occupation_code: 'Code occupation',
  nature_occupation_libelle: 'Occupation du sol',
  zone_amenagement: "Zone d'aménagement",
  statut_foncier: 'Statut foncier',
  origine: 'Origine',
  reference_plan: 'Référence plan',
  echelle_leve: 'Échelle du levé',
  date_creation: 'Date de création',
  date_derniere_maj: 'Dernière mise à jour',
  full_id: 'Identifiant complet',
  osm_id: 'Identifiant OSM',
  amenity: 'Type d\'équipement',
  highway: 'Type de route',
  name: 'Nom',
  surface: 'Revêtement',
}

export function attributeLabel(key: string): string {
  const known = ATTRIBUTE_LABELS[key]
  if (known) return known
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

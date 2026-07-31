import residentielImg from '../assets/features/residentiel.jpg'
import commercialImg from '../assets/features/commercial.jpg'
import industrielImg from '../assets/features/industriel.jpg'
import touristiqueImg from '../assets/features/touristique.jpg'
import equipementsImg from '../assets/features/equipements_publics.jpg'
import bureauxImg from '../assets/features/bureaux_services.jpg'

export interface TimelineStep {
  icon: string
  title: string
  description: string
}

export interface Criterion {
  icon: string
  title: string
  description: string
}

export interface ProjectType {
  icon: string
  title: string
  description: string
  details: string
  gradient: string
  image: string
}

export interface DataSource {
  icon: string
  label: string
}

export const timelineSteps: TimelineStep[] = [
  {
    icon: 'mapPin',
    title: 'Sélection du terrain',
    description:
      'Parcourez la carte interactive pour sélectionner les parcelles qui correspondent à votre stratégie d\'investissement.',
  },
  {
    icon: 'document',
    title: 'Vérification urbanistique',
    description:
      'Consultez automatiquement les règles d\'urbanisme, les PLU et les contraintes réglementaires applicables.',
  },
  {
    icon: 'filter',
    title: 'Analyse multicritères',
    description:
      'Croisez les critères d\'analyse : accessibilité, équipements, topographie et positionnement stratégique.',
  },
  {
    icon: 'euro',
    title: 'Estimation du potentiel',
    description:
      'Obtenez une estimation du prix du terrain et de la rentabilité potentielle du projet envisagé.',
  },
  {
    icon: 'ranking',
    title: 'Classement final',
    description:
      'Les terrains sont classés par score de potentiel foncier pour vous guider vers les meilleures opportunités.',
  },
]

export const criteria: Criterion[] = [
  {
    icon: 'building',
    title: 'Constructibilité',
    description: 'Vérifiez si le terrain est constructible selon le zonage urbanistique en vigueur.',
  },
  {
    icon: 'layers',
    title: 'Affectation urbanistique',
    description: 'Identifiez l\'usage autorisé : résidentiel, commercial, industriel ou mixte.',
  },
  {
    icon: 'map',
    title: 'Accessibilité',
    description: 'Évaluez la proximité et la qualité des voiries et transports en commun.',
  },
  {
    icon: 'mapPin',
    title: 'Positionnement',
    description: 'Analysez la position stratégique du terrain dans le tissu urbain et économique.',
  },
  {
    icon: 'store',
    title: 'Proximité des équipements',
    description: 'Mesurez la distance aux services, écoles, commerces et infrastructures publiques.',
  },
  {
    icon: 'layers',
    title: 'Topographie',
    description: 'Consultez le modèle numérique de terrain pour les pentes et l\'altitude.',
  },
  {
    icon: 'euro',
    title: 'Prix du terrain',
    description: 'Consultez les prix fonciers de référence pour la zone géographique sélectionnée.',
  },
  {
    icon: 'ranking',
    title: 'Rentabilité estimée',
    description: 'Estimez le retour sur investissement potentiel du projet de construction.',
  },
  {
    icon: 'chart',
    title: 'Potentiel foncier',
    description: 'Score global synthétisant tous les critères en un indice de valeur foncière.',
  },
]

export const projectTypes: ProjectType[] = [
  {
    icon: 'building',
    title: 'Résidentiel',
    description: 'Projets de logements collectifs, maisons individuelles ou résidences services.',
    details: 'Analyse du marché local, densité autorisée et demande résidentielle.',
    gradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    image: residentielImg,
  },
  {
    icon: 'store',
    title: 'Commercial',
    description: 'Centres commerciaux, boutiques, espaces de vente et commerces de proximité.',
    details: 'Flux piéton, visibilité, attractivité commerciale et zone de chalandise.',
    gradient: 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)',
    image: commercialImg,
  },
  {
    icon: 'building',
    title: 'Industriel',
    description: 'Zones d\'activités, entrepôts, unités de production et logistique.',
    details: 'Accès routier, raccordement réseaux, règles environnementales.',
    gradient: 'linear-gradient(135deg, #4338ca 0%, #818cf8 100%)',
    image: industrielImg,
  },
  {
    icon: 'mapPin',
    title: 'Touristique',
    description: 'Hôtels, résidences de tourisme, infrastructures d\'accueil et loisirs.',
    details: 'Potentiel touristique, cadre paysager, saisonnalité et accessibilité.',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #2dd4bf 100%)',
    image: touristiqueImg,
  },
  {
    icon: 'building',
    title: 'Équipements publics',
    description: 'Écoles, centres de santé, équipements sportifs et culturels.',
    details: 'Planification publique, besoins démographiques et conformité réglementaire.',
    gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)',
    image: equipementsImg,
  },
  {
    icon: 'building',
    title: 'Bureaux et services',
    description: 'Immeubles de bureaux, espaces de coworking et centres d\'affaires.',
    details: 'Densité d\'emploi, connectivité numérique et accessibilité professionnelle.',
    gradient: 'linear-gradient(135deg, #be123c 0%, #fb7185 100%)',
    image: bureauxImg,
  },
]

export const dataSources: DataSource[] = [
  { icon: 'document', label: 'Cadastre' },
  { icon: 'layers', label: 'Plan d\'aménagement' },
  { icon: 'euro', label: 'Référentiel des prix fonciers' },
  { icon: 'map', label: 'Réseau routier' },
  { icon: 'layers', label: 'Modèle Numérique de Terrain' },
  { icon: 'mapPin', label: 'Limites administratives' },
  { icon: 'osm', label: 'OpenStreetMap' },
]

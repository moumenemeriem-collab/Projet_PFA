
import carteInteractiveImg from '../assets/features/carte-interactive.jpg'
import analyseMulticriteresImg from '../assets/features/analyse-multicriteres.jpg'
import estimationPrixImg from '../assets/features/estimation-prix.jpg'
import classementTerrainsImg from '../assets/features/classement-terrains.jpg'
export interface Feature {
  title: string
  description: string
  icon: 'map' | 'filter' | 'document' | 'chart'
  imageGradient: string
  image?: string
}

export interface Benefit {
  title: string
  description: string
  icon: 'shield' | 'trending' | 'search'
}

export const navLinks = [
  { label: 'Accueil', href: '#accueil' },
  { label: 'Services', href: '#services' },
]



export const features: Feature[] = [
  {
    title: 'Carte interactive',
    description:
      'Visualisez les parcelles, les contraintes urbanistiques et les opportunités sur une carte SIG dynamique et intuitive.',
    icon: 'map',
    imageGradient: 'linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #3b82f6 100%)',
    image: carteInteractiveImg,
  },
  {
    title: 'Analyse multicritères',
    description:
      'Croisez accessibilité, équipements  et zonage pour évaluer objectivement le potentiel de chaque terrain.',
    icon: 'filter',
    imageGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0ea5e9 100%)',
    image: analyseMulticriteresImg,
  },
  {
    title: 'Estimation de prix',
    description:
      'Obtenez des estimations fondées sur les données du marché local et les caractéristiques géospatiales des parcelles.',
    icon: 'document',
    imageGradient: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #6366f1 100%)',
    image: estimationPrixImg,
  },
  {
    title: 'Classement des terrains',
    description:
      'Classez automatiquement les opportunités selon vos critères d\'investissement et identifiez les meilleurs profils.',
    icon: 'chart',
    imageGradient: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)',
    image: classementTerrainsImg,
  },
]

export const benefits: Benefit[] = [
  {
    title: 'Sécurité Juridique',
    description:
      'Appuyez vos décisions sur des données cadastrales et réglementaires fiables, actualisées pour la région de .',
    icon: 'shield',
  },
  {
    title: 'Optimisation de Rendement',
    description:
      'Identifiez rapidement les terrains à fort potentiel et maximisez le retour sur investissement grâce à l\'analyse spatiale.',
    icon: 'trending',
  },
  {
    title: 'Recherche Prédictive',
    description:
      'Anticipez les zones en développement et repérez les opportunités avant qu\'elles n\'émergent sur le marché.',
    icon: 'search',
  },
]
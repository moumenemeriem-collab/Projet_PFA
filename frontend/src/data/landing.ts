import { t } from '../i18n/index'
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

export function getNavLinks() {
  return [
    { label: t('nav.accueil'), href: '/' },
    { label: t('nav.services'), href: '/#services' },
    { label: t('nav.about'), href: '/a-propos' },
  ]
}

export const features: Feature[] = [
  {
    title: t('features.carte.title'),
    description: t('features.carte.description'),
    icon: 'map',
    imageGradient: 'linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #3b82f6 100%)',
    image: carteInteractiveImg,
  },
  {
    title: t('features.analyse.title'),
    description: t('features.analyse.description'),
    icon: 'filter',
    imageGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0ea5e9 100%)',
    image: analyseMulticriteresImg,
  },
  {
    title: t('features.estimation.title'),
    description: t('features.estimation.description'),
    icon: 'document',
    imageGradient: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #6366f1 100%)',
    image: estimationPrixImg,
  },
  {
    title: t('features.classement.title'),
    description: t('features.classement.description'),
    icon: 'chart',
    imageGradient: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)',
    image: classementTerrainsImg,
  },
]

export const benefits: Benefit[] = [
  {
    title: t('benefits.securite.title'),
    description: t('benefits.securite.description'),
    icon: 'shield',
  },
  {
    title: t('benefits.optimisation.title'),
    description: t('benefits.optimisation.description'),
    icon: 'trending',
  },
  {
    title: t('benefits.recherche.title'),
    description: t('benefits.recherche.description'),
    icon: 'search',
  },
]

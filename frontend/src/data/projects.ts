import { t } from '../i18n/index'

export type ProjectTypeKey = 'residentiel' | 'commercial' | 'mixte'
export type ProjectType = string

export interface Project {
  id: number
  title: string
  typeKey: ProjectTypeKey
  type: ProjectType
  budget: string
  parcels: number
  image: string
}

export function getProjectStats() {
  return {
    total: { value: 24, subtext: t('projects.total_subtext') },
    investment: { value: '84.2M MAD' },
    classifiedParcels: { value: '1 482', subtext: t('projects.classified_subtext') },
    potentialZones: { value: 12, subtext: t('projects.potential_subtext') },
  }
}

export function getStaticProjects(): Project[] {
  return [
    {
      id: 1,
      title: 'Lotissement Al-Amal II',
      typeKey: 'residentiel',
      type: t('projects.type_residentiel'),
      budget: '4.5M MAD',
      parcels: 124,
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=340&fit=crop',
    },
    {
      id: 2,
      title: 'Centre d\'Affaires Zemmour',
      typeKey: 'commercial',
      type: t('projects.type_commercial'),
      budget: '12.8M MAD',
      parcels: 12,
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=340&fit=crop',
    },
    {
      id: 3,
      title: 'Résidence Les Jardins de l\'Atlas',
      typeKey: 'mixte',
      type: t('projects.type_mixte'),
      budget: '8.2M MAD',
      parcels: 86,
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=340&fit=crop',
    },
    {
      id: 4,
      title: 'Zone Industrielle Khemisset Sud',
      typeKey: 'commercial',
      type: t('projects.type_commercial'),
      budget: '25.0M MAD',
      parcels: 45,
      image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&h=340&fit=crop',
    },
    {
      id: 5,
      title: 'Complexe Touristique Dayet Erroumi',
      typeKey: 'mixte',
      type: t('projects.type_mixte'),
      budget: '32.4M MAD',
      parcels: 28,
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=340&fit=crop',
    },
    {
      id: 6,
      title: 'Villas de Maamora',
      typeKey: 'residentiel',
      type: t('projects.type_residentiel'),
      budget: '15.2M MAD',
      parcels: 42,
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=340&fit=crop',
    },
  ]
}

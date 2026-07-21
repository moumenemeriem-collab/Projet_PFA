export type ProjectType = 'Résidentiel' | 'Commercial' | 'Mixte'

export interface Project {
  id: number
  title: string
  type: ProjectType
  budget: string
  parcels: number
  image: string
}

export const projectStats = {
  total: { value: 24, subtext: '+3 ce mois' },
  investment: { value: '84.2M MAD' },
  classifiedParcels: { value: '1 482', subtext: 'Sur 15k dispos' },
  potentialZones: { value: 12, subtext: 'Identifiées' },
}

export const staticProjects: Project[] = [
  {
    id: 1,
    title: 'Lotissement Al-Amal II',
    type: 'Résidentiel',
    budget: '4.5M MAD',
    parcels: 124,
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=340&fit=crop',
  },
  {
    id: 2,
    title: 'Centre d\'Affaires Zemmour',
    type: 'Commercial',
    budget: '12.8M MAD',
    parcels: 12,
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=340&fit=crop',
  },
  {
    id: 3,
    title: 'Résidence Les Jardins de l\'Atlas',
    type: 'Mixte',
    budget: '8.2M MAD',
    parcels: 86,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=340&fit=crop',
  },
  {
    id: 4,
    title: 'Zone Industrielle Khemisset Sud',
    type: 'Commercial',
    budget: '25.0M MAD',
    parcels: 45,
    image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&h=340&fit=crop',
  },
  {
    id: 5,
    title: 'Complexe Touristique Dayet Erroumi',
    type: 'Mixte',
    budget: '32.4M MAD',
    parcels: 28,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=340&fit=crop',
  },
  {
    id: 6,
    title: 'Villas de Maamora',
    type: 'Résidentiel',
    budget: '15.2M MAD',
    parcels: 42,
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=340&fit=crop',
  },
]

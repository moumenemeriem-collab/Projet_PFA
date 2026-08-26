import { calculerPoidsAHP as _calculerPoidsAHP } from './ahp.ts'
import { calculerPoidsROC as _calculerPoidsROC } from './roc.ts'

export interface PonderationRequest {
  matrice_ahp: [number, number]
  ordre_categories: string[]
  ordres_roc: Record<string, string[]>
  selections_criteres: Record<string, string[]>
  preferences_localisation: Record<string, string>
  preferences_pente: string[]
  seuil: number
}

export interface Contribution {
  critere: string
  poids: number
  score: number
  contribution: number
}

export interface TerrainPondere {
  id: number
  nom: string
  superficie: number
  lat: number
  lng: number
  reference_cadastrale?: string
  indice?: string
  consistance?: string
  score_final: number
  rang: number
  contributions: Contribution[]
  distances: Record<string, number | null>
  zone_localisation: string
  pente: number | null
  altitude: number | null
}

export interface PonderationResponse {
  total: number
  resultats: TerrainPondere[]
  poids_globaux: Record<string, number>
  poids_ahp: Record<string, number>
  CR?: number
  coherent?: boolean
}

export interface PonderationPreference {
  id: number
  projet: number
  matrice_ahp: [number, number]
  ordre_categories: string[]
  ordres_roc: Record<string, string[]>
  selections_criteres: Record<string, string[]>
  preferences_localisation: Record<string, string>
  preferences_pente: string[]
  seuil: number
  date_creation: string
  date_mise_a_jour: string
}

export { _calculerPoidsAHP as calculerPoidsAHP }
export { _calculerPoidsROC as calculerPoidsROC }

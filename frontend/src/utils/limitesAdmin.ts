// Contrainte des polygones « terrain » par la limite administrative de référence
// (couche SIG « limites_admin » : communes, provinces, régions).
//
// Le masque d'intersection est la réunion des polygones de toutes les entités de
// la couche, ce qui évite de coder en dur une commune en particulier. L'intersection
// est calculée avec @turf/intersect (polygon-clipping), et la partie de surface la
// plus grande est conservée : le modèle Terrain n'accepte qu'un polygone simple.

import area from '@turf/area'
import intersect from '@turf/intersect'
import { type CoucheFeatureCollection } from '../api/couches'

export interface LimiteMask {
  // Masque d'intersection au format GeoJSON (Polygon ou MultiPolygon).
  feature: { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }
  // Libellés de la couche pour le message utilisateur (« Témara (commune) »).
  nom: string
  niveau: string
}

export interface LimiteClipResult {
  // « ok »           : le polygone a été découpé (ou pas) avec succès.
  // « hors-limite »  : aucune intersection — le polygone est entièrement à l'extérieur.
  // « indisponible » : pas de limite administrative exploitable, on laisse passer.
  status: 'ok' | 'hors-limite' | 'indisponible'
  ring: number[][]
  // true si la limite administrative a retiré une partie du polygone.
  clipped: boolean
  aireAvant: number
  aireApres: number
  nomLimite: string
}

// En dessous de ce seuil (m²) la différence de surface est considérée comme nulle :
// cela évite d'annoncer un découpage pour un simple arrondi numérique.
const AIRE_TOLERANCE_M2 = 1

// Séries de polygones simples ([[[lng, lat], ...]], avec trou éventuel).
type Polygone = number[][][]

function stripZ(geometry: unknown): { type: string; coordinates: unknown } | null {
  if (!geometry || typeof geometry !== 'object') return null
  const g = geometry as { type?: unknown; coordinates?: unknown }
  if (typeof g.type !== 'string' || !Array.isArray(g.coordinates)) return null
  return { type: g.type, coordinates: g.coordinates }
}

function ringValide(ring: unknown): number[][] | null {
  if (!Array.isArray(ring) || ring.length < 4) return null
  const out: number[][] = []
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2) continue
    const lng = Number(p[0])
    const lat = Number(p[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    out.push([lng, lat])
  }
  if (out.length < 3) return null
  const first = out[0]
  const last = out[out.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]])
  return out
}

function polygoneValide(rings: unknown): Polygone | null {
  if (!Array.isArray(rings)) return null
  const ext = ringValide(rings[0])
  if (!ext) return null
  const trous: number[][][] = []
  for (let i = 1; i < rings.length; i++) {
    const hole = ringValide(rings[i])
    if (hole) trous.push(hole)
  }
  return trous.length > 0 ? [ext, ...trous] : [ext]
}

// Extrait tous les polygones simples d'une géométrie Polygon / MultiPolygon.
function polygonsOf(geometry: unknown): Polygone[] {
  const g = stripZ(geometry)
  if (!g) return []
  if (g.type === 'Polygon') {
    const poly = polygoneValide(g.coordinates)
    return poly ? [poly] : []
  }
  if (g.type === 'MultiPolygon') {
    const coords = g.coordinates as unknown[]
    if (!Array.isArray(coords)) return []
    const out: Polygone[] = []
    for (const rings of coords) {
      const poly = polygoneValide(rings)
      if (poly) out.push(poly)
    }
    return out
  }
  return []
}

function libelle(first: Record<string, unknown> | null | undefined): { nom: string; niveau: string } {
  const nom = first?.nom ?? first?.nom_fr ?? first?.NOM ?? ''
  const niveau = first?.niveau ?? first?.type ?? ''
  return {
    nom: String(nom ?? '').trim(),
    niveau: String(niveau ?? '').trim(),
  }
}

// Construit le masque d'intersection (union des limites de la couche).
// Retourne null si la couche est absente ou ne contient aucun polygone exploitable.
export function buildLimiteMask(fc: CoucheFeatureCollection | null | undefined): LimiteMask | null {
  if (!fc || !Array.isArray(fc.features) || fc.features.length === 0) return null
  const polygons: Polygone[] = []
  let premiere: Record<string, unknown> | null = null
  for (const f of fc.features) {
    if (!f || typeof f !== 'object') continue
    if (premiere === null) premiere = (f.properties ?? null) as Record<string, unknown> | null
    polygons.push(...polygonsOf(f.geometry))
  }
  if (polygons.length === 0) return null
  const { nom, niveau } = libelle(premiere)
  return {
    feature: {
      type: 'Feature',
      properties: { nom, niveau },
      geometry: polygons.length === 1
        ? { type: 'Polygon', coordinates: polygons[0] }
        : { type: 'MultiPolygon', coordinates: polygons },
    },
    nom,
    niveau,
  }
}

export function libelleLimite(mask: LimiteMask): string {
  if (mask.nom && mask.niveau) return `${mask.nom} (${mask.niveau})`
  return mask.nom || mask.niveau || ''
}

// Ring externe le plus grand d'un résultat d'intersection (Polygon ou MultiPolygon).
function largestRing(geometry: unknown): number[][] | null {
  const polys = polygonsOf(geometry)
  let best: number[][] | null = null
  let bestArea = -1
  for (const poly of polys) {
    const feat = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: poly } }
    let a = 0
    try {
      a = area(feat as never)
    } catch {
      a = 0
    }
    if (a > bestArea) {
      bestArea = a
      best = poly[0]
    }
  }
  return best
}

const PAS_DE_LIMITE: Omit<LimiteClipResult, 'aireAvant' | 'aireApres'> = {
  status: 'indisponible',
  ring: [],
  clipped: false,
  nomLimite: '',
}

// Limite un anneau [lng, lat] à la limite administrative.
// - polygone entièrement dedans  → inchangé
// - polygone traversant la limite → découpé sur la limite
// - polygone entièrement dehors  → status « hors-limite »
export function clipRingToLimite(
  ring: number[][],
  mask: LimiteMask | null | undefined
): LimiteClipResult {
  const cleaned = ringValide(ring)
  if (!cleaned || !mask) {
    return { ...PAS_DE_LIMITE, ring: cleaned ?? [], aireAvant: 0, aireApres: 0 }
  }
  const terrainFeat = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon', coordinates: [cleaned] },
  }
  let aireAvant = 0
  try {
    aireAvant = area(terrainFeat as never)
  } catch {
    return { ...PAS_DE_LIMITE, ring: cleaned, aireAvant: 0, aireApres: 0 }
  }
  if (aireAvant <= 0) {
    return { ...PAS_DE_LIMITE, ring: cleaned, aireAvant: 0, aireApres: 0 }
  }

  let inter: { geometry?: unknown } | null = null
  try {
    inter = intersect(
      { type: 'FeatureCollection', features: [terrainFeat as never, mask.feature as never] },
      { properties: {} }
    ) as unknown as { geometry?: unknown } | null
  } catch {
    // Géométrie dégénérée : on ne bloque pas la saisie.
    return { ...PAS_DE_LIMITE, ring: cleaned, aireAvant, aireApres: aireAvant }
  }
  if (!inter || !inter.geometry) {
    return { ...PAS_DE_LIMITE, status: 'hors-limite', ring: cleaned, aireAvant, aireApres: 0, nomLimite: libelleLimite(mask) }
  }

  const ringOut = largestRing(inter.geometry)
  if (!ringOut) {
    return { ...PAS_DE_LIMITE, status: 'hors-limite', ring: cleaned, aireAvant, aireApres: 0, nomLimite: libelleLimite(mask) }
  }

  let aireApres = 0
  try {
    aireApres = area({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ringOut] },
    } as never)
  } catch {
    aireApres = 0
  }
  if (aireApres <= 0) {
    return { ...PAS_DE_LIMITE, status: 'hors-limite', ring: cleaned, aireAvant, aireApres: 0, nomLimite: libelleLimite(mask) }
  }

  return {
    status: 'ok',
    ring: ringOut,
    clipped: aireAvant - aireApres > AIRE_TOLERANCE_M2,
    aireAvant,
    aireApres,
    nomLimite: libelleLimite(mask),
  }
}

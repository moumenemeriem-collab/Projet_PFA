/** GeoJSON geometry utilitaire (formulaires admin / carte). */

import area from '@turf/area'

export function isGeoJsonGeometry(g: unknown): g is { type: string; coordinates: unknown } {
  return !!g && typeof g === 'object' && typeof (g as { type?: unknown }).type === 'string'
}

export function geometryToFeature(g: unknown): { type: 'Feature'; properties: Record<string, never>; geometry: unknown } | null {
  if (!isGeoJsonGeometry(g)) return null
  return { type: 'Feature', properties: {}, geometry: g }
}

const SURFACE_NAME_HINTS = ['surface', 'superficie', 'superficie_m2', 'superficie_m²']

/** Nom de l'attribut couche utilisé pour la superficie (m²), si présent. */
export function findSurfaceAttributeName(attributs: { nom: string }[]): string | null {
  for (const a of attributs) {
    const n = a.nom.toLowerCase()
    if (SURFACE_NAME_HINTS.includes(n)) return a.nom
  }
  for (const a of attributs) {
    const n = a.nom.toLowerCase()
    if (n.includes('superficie') || (n.includes('surface') && !n.includes('surface_min'))) return a.nom
  }
  return null
}

function isArealGeometry(type: string): boolean {
  const t = type.toLowerCase()
  return t === 'polygon' || t === 'multipolygon'
}

/** Superficie du polygone en m² (WGS84, @turf/area). */
export function geometryAreaM2(geometry: unknown): number | null {
  if (!isGeoJsonGeometry(geometry) || !isArealGeometry(geometry.type)) return null
  try {
    const m2 = area({ type: 'Feature', properties: {}, geometry })
    return Number.isFinite(m2) && m2 > 0 ? m2 : null
  } catch {
    return null
  }
}

export function formatAreaM2ForInput(m2: number): string {
  if (m2 >= 100) return String(Math.round(m2))
  return String(Math.round(m2 * 100) / 100)
}
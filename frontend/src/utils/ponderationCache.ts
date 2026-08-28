import type { PonderationResponse } from '../api/analyses'

const CACHE_KEY_PREFIX = 'ws_potentiel_foncier.amc.'

const memory = new Map<number, PonderationResponse>()

function keyFor(projetId: number): string {
  return `${CACHE_KEY_PREFIX}${projetId}`
}

export function getCachedPonderation(projetId: number): PonderationResponse | null {
  if (memory.has(projetId)) return memory.get(projetId) ?? null
  try {
    const raw = sessionStorage.getItem(keyFor(projetId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PonderationResponse
    memory.set(projetId, parsed)
    return parsed
  } catch {
    return null
  }
}

export function setCachedPonderation(projetId: number, response: PonderationResponse): void {
  memory.set(projetId, response)
  try {
    sessionStorage.setItem(keyFor(projetId), JSON.stringify(response))
  } catch {
    /* stockage indisponible : on garde le cache en mémoire */
  }
}

export function clearCachedPonderation(projetId: number): void {
  memory.delete(projetId)
  try {
    sessionStorage.removeItem(keyFor(projetId))
  } catch {
    /* ignore */
  }
}

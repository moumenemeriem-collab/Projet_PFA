// Dimensions d'une parcelle cadastrale (plan topographique) + ouverture Google Maps.

const EARTH_R = 6371008.8

export interface DimsSide {
  d: number
  a: [number, number]
  b: [number, number]
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Distance haversine en mètres entre deux points [lat, lng].
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)))
}

// Longueur de chaque côté d'un anneau (coordonnées [lng, lat], fermé ou non).
export function polygonSides(ring: number[][]): DimsSide[] {
  const sides: DimsSide[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    sides.push({
      d: haversineMeters(a[1], a[0], b[1], b[0]),
      a: [a[0], a[1]],
      b: [b[0], b[1]],
    })
  }
  return sides
}

// Surface en m² par projection équirectangulaire locale (suffisante pour un plan de parcelle).
export function polygonAreaM2(ring: number[][]): number {
  let latSum = 0
  for (const p of ring) latSum += p[1]
  const latC = latSum / ring.length
  const kLat = 111320
  const kLng = 111320 * Math.cos(toRad(latC))
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i]
    const p2 = ring[(i + 1) % ring.length]
    s += p1[0] * kLng * p2[1] * kLat - p2[0] * kLng * p1[1] * kLat
  }
  return Math.abs(s) / 2
}

export function formatMeters(d: number): string {
  if (!Number.isFinite(d)) return '—'
  if (d >= 10000) return `${(d / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
  const v = d >= 100 ? Math.round(d) : Math.round(d * 10) / 10
  return `${v.toLocaleString('fr-FR')} m`
}

function formatArea(m2: number): string {
  if (!Number.isFinite(m2)) return '—'
  if (m2 >= 10000) {
    return `${(m2 / 10000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ha`
  }
  return `${Math.round(m2).toLocaleString('fr-FR')} m²`
}

// Extrait l'anneau externe d'une géométrie GeoJSON (Polygon / MultiPolygon).
export function extractRing(geometry: unknown): number[][] | null {
  if (!geometry || typeof geometry !== 'object') return null
  const g = geometry as { type?: string; coordinates?: unknown }
  const c = g.coordinates as unknown
  const coerce = (raw: unknown): number[][] | null => {
    if (!Array.isArray(raw) || !Array.isArray(raw[0])) return null
    const ring = raw as number[][]
    if (ring.length < 3 || !ring.every((p) => Array.isArray(p) && p.length >= 2)) return null
    return ring.map((p) => [p[0], p[1]] as [number, number])
  }
  if (g.type === 'Polygon') return coerce(Array.isArray(c) ? c[0] : null)
  if (g.type === 'MultiPolygon' && Array.isArray(c) && Array.isArray(c[0])) {
    return coerce(c[0][0])
  }
  return null
}

export function ringCenter(ring: number[][]): { lat: number; lng: number } {
  let lat = 0
  let lng = 0
  for (const p of ring) {
    lng += p[0]
    lat += p[1]
  }
  return { lat: lat / ring.length, lng: lng / ring.length }
}

export function openGoogleMaps(lat: number, lng: number): void {
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`,
    '_blank',
    'noopener,noreferrer'
  )
}

const GRID_LINES =
  '<line x1="0" y1="50" x2="380" y2="50"/><line x1="0" y1="100" x2="380" y2="100"/><line x1="0" y1="150" x2="380" y2="150"/><line x1="0" y1="200" x2="380" y2="200"/>' +
  '<line x1="76" y1="0" x2="76" y2="250"/><line x1="152" y1="0" x2="152" y2="250"/><line x1="228" y1="0" x2="228" y2="250"/><line x1="304" y1="0" x2="304" y2="250"/>'

export function buildDimsSvg(ring: number[][]): string {
  const W = 380
  const H = 250
  const PAD = 42
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const rX = maxX - minX || 1e-9
  const rY = maxY - minY || 1e-9
  const scale = Math.min((W - PAD * 2) / rX, (H - PAD * 2) / rY)
  const offX = (W - rX * scale) / 2
  const offY = (H - rY * scale) / 2
  const px = (x: number): number => offX + (x - minX) * scale
  const py = (y: number): number => H - (offY + (y - minY) * scale)
  const pts = ring.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ')
  const sides = polygonSides(ring)
  const labels = sides
    .map((s) => {
      const mx = (px(s.a[0]) + px(s.b[0])) / 2
      const my = (py(s.a[1]) + py(s.b[1])) / 2
      return `<text x="${mx.toFixed(1)}" y="${(my - 7).toFixed(1)}" text-anchor="middle" class="geo-dims-label">${escapeHtml(formatMeters(s.d))}</text>`
    })
    .join('')
  return (
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plan topographique">` +
    `<rect width="${W}" height="${H}" fill="#fbfdff"/>` +
    `<g class="geo-dims-grid">${GRID_LINES}</g>` +
    `<polygon class="geo-dims-shape" points="${pts}"/>` +
    `<g class="geo-dims-vertex">${sides
      .map((s) => `<circle cx="${px(s.a[0]).toFixed(1)}" cy="${py(s.a[1]).toFixed(1)}" r="3"/>`)
      .join('')}</g>` +
    `<g class="geo-dims-north" transform="translate(${W - 22},16)"><path d="M0 10 L4 4 L-4 4 Z"/><path d="M0 10 V16" stroke-width="1.4"/></g>` +
    labels +
    `</svg>`
  )
}

export function buildDimsModalHtml(ring: number[][], title: string): string {
  const sides = polygonSides(ring)
  const perimeter = sides.reduce((sum, s) => sum + s.d, 0)
  const area = polygonAreaM2(ring)
  const rows = sides
    .map((s, i) => `<div class="geo-dims-row"><span>Côté ${i + 1}</span><strong>${escapeHtml(formatMeters(s.d))}</strong></div>`)
    .join('')
  return (
    `<div class="geo-dims-overlay" data-dims-overlay>` +
    `<div class="geo-dims-modal">` +
    `<div class="geo-dims-header">` +
    `<h3>Dimensions du terrain</h3>` +
    `<button type="button" class="geo-dims-close" data-dims-close aria-label="Fermer">&times;</button>` +
    `</div>` +
    `<div class="geo-dims-body">` +
    `<div class="geo-dims-plot">${buildDimsSvg(ring)}</div>` +
    `<div class="geo-dims-list">` +
    `<div class="geo-dims-list-title">${escapeHtml(title)}</div>` +
    rows +
    `<div class="geo-dims-row geo-dims-row--total"><span>Périmètre</span><strong>${escapeHtml(formatMeters(perimeter))}</strong></div>` +
    `<div class="geo-dims-row geo-dims-row--total"><span>Surface</span><strong>${escapeHtml(formatArea(area))}</strong></div>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `</div>`
  )
}

export function showTerrainDims(ring: number[][], title: string): void {
  document.querySelector('.geo-dims-overlay')?.remove()
  const div = document.createElement('div')
  div.innerHTML = buildDimsModalHtml(ring, title)
  const overlay = div.firstElementChild as HTMLElement
  document.body.appendChild(overlay)
  const close = (): void => overlay.remove()
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) close()
  })
  overlay.querySelector<HTMLElement>('[data-dims-close]')?.addEventListener('click', close)
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      close()
      document.removeEventListener('keydown', onKey)
    }
  }
  document.addEventListener('keydown', onKey)
}

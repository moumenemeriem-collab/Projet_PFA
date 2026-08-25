// Dimensions d'une parcelle cadastrale (plan topographique) + ouverture Google Maps.

import { downloadTerrainPdf } from './pdfPlan'

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
// Supprime le sommet de fermeture (dernier point identique au premier) et les
// sommets consécutifs dupliqués, sinon la longueur d'un côté vaut 0 m.
export function extractRing(geometry: unknown): number[][] | null {
  if (!geometry || typeof geometry !== 'object') return null
  const g = geometry as { type?: string; coordinates?: unknown }
  const c = g.coordinates as unknown
  const coerce = (raw: unknown): number[][] | null => {
    if (!Array.isArray(raw) || !Array.isArray(raw[0])) return null
    const ring = (raw as number[][]).map((p) => [p[0], p[1]] as [number, number])
    const cleaned: number[][] = []
    for (const pt of ring) {
      const last = cleaned[cleaned.length - 1]
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) cleaned.push(pt)
    }
    if (cleaned.length > 1) {
      const first = cleaned[0]
      const last = cleaned[cleaned.length - 1]
      if (first[0] === last[0] && first[1] === last[1]) cleaned.pop()
    }
    if (cleaned.length < 3) return null
    return cleaned
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

export function closeRing(ring: number[][]): number[][] {
  if (ring.length < 3) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return ring
  return [...ring, [first[0], first[1]]]
}

export function ringAreaM2(ring: number[][]): number {
  return polygonAreaM2(ring)
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

const DIMS_SVG_W = 380
const DIMS_SVG_H = 250

export function buildDimsSvg(ring: number[][]): string {
  return `<svg viewBox="0 0 ${DIMS_SVG_W} ${DIMS_SVG_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plan topographique">${buildDimsSvgInner(ring)}</svg>`
}

function buildDimsSvgInner(ring: number[][]): string {
  const W = DIMS_SVG_W
  const H = DIMS_SVG_H
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
    `<rect width="${W}" height="${H}" fill="#fbfdff"/>` +
    `<g class="geo-dims-grid">${GRID_LINES}</g>` +
    `<polygon class="geo-dims-shape" points="${pts}"/>` +
    `<g class="geo-dims-vertex">${sides
      .map((s) => `<circle cx="${px(s.a[0]).toFixed(1)}" cy="${py(s.a[1]).toFixed(1)}" r="3"/>`)
      .join('')}</g>` +
    `<g class="geo-dims-north" transform="translate(${W - 22},16)"><path d="M0 10 L4 4 L-4 4 Z"/><path d="M0 10 V16" stroke-width="1.4"/></g>` +
    labels
  )
}

export function buildDimsModalHtml(ring: number[][], title: string): string {
  const sides = polygonSides(ring)
  const perimeter = sides.reduce((sum, s) => sum + s.d, 0)
  const area = polygonAreaM2(ring)
  const rows = sides
    .map((s, i) => `<tr><td>Côté ${i + 1}</td><td>${escapeHtml(formatMeters(s.d))}</td></tr>`)
    .join('')
  return (
    `<div class="geo-dims-overlay" data-dims-overlay>` +
    `<div class="geo-dims-modal">` +
    `<div class="geo-dims-header">` +
    `<h3>Dimensions du terrain</h3>` +
    `<div class="geo-dims-header-actions">` +
    `<button type="button" class="geo-dims-download" data-dims-pdf title="Télécharger le plan topographique (PDF)" aria-label="Télécharger le plan topographique (PDF)">` +
    `<svg class="geo-dims-pdf-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 1.5A1.5 1.5 0 0 1 3.5 0H10l4 4v10.5A1.5 1.5 0 0 1 12.5 16h-9A1.5 1.5 0 0 1 2 14.5v-13zM10 0.5V4a1 1 0 0 0 1 1h3.5L10 0.5zM9 7v5.3L7.1 10.4a.6.6 0 1 0-.85.85l2.6 2.6a.6.6 0 0 0 .85 0l2.6-2.6a.6.6 0 1 0-.85-.85L10 12.3V7a.6.6 0 1 0-1 0z"/></svg>` +
    `</button>` +
    `<button type="button" class="geo-dims-close" data-dims-close aria-label="Fermer">&times;</button>` +
    `</div>` +
    `</div>` +
    `<div class="geo-dims-body">` +
    `<div class="geo-dims-title">${escapeHtml(title)}</div>` +
    `<div class="geo-dims-plot" data-dims-plot>` +
    `<svg class="geo-dims-svg" data-dims-svg viewBox="0 0 ${DIMS_SVG_W} ${DIMS_SVG_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plan topographique">${buildDimsSvgInner(ring)}</svg>` +
    `<div class="geo-dims-zoom">` +
    `<button type="button" class="geo-dims-zoom-btn" data-dims-zoom="out" aria-label="Dézoomer">&#8722;</button>` +
    `<span class="geo-dims-zoom-value" data-dims-hint>100%</span>` +
    `<button type="button" class="geo-dims-zoom-btn" data-dims-zoom="in" aria-label="Zoomer">+</button>` +
    `</div>` +
    `</div>` +
    `<table class="geo-dims-table">` +
    `<thead><tr><th>Côté</th><th>Longueur</th></tr></thead>` +
    `<tbody>` +
    rows +
    `<tr class="geo-dims-total"><td>Périmètre</td><td>${escapeHtml(formatMeters(perimeter))}</td></tr>` +
    `<tr class="geo-dims-total"><td>Surface</td><td>${escapeHtml(formatArea(area))}</td></tr>` +
    `</tbody>` +
    `</table>` +
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

  const svg = overlay.querySelector<SVGSVGElement>('[data-dims-svg]')
  const hint = overlay.querySelector<HTMLElement>('[data-dims-hint]')
  let scale = 1
  const setScale = (s: number): void => {
    scale = Math.min(4, Math.max(1, s))
    if (svg) svg.style.transform = `scale(${scale})`
    if (hint) hint.textContent = `${Math.round(scale * 100)}%`
  }
  overlay.querySelector<HTMLElement>('[data-dims-zoom="in"]')?.addEventListener('click', () => setScale(scale + 0.25))
  overlay.querySelector<HTMLElement>('[data-dims-zoom="out"]')?.addEventListener('click', () => setScale(scale - 0.25))

  overlay.querySelector<HTMLElement>('[data-dims-pdf]')?.addEventListener('click', () => {
    downloadTerrainPdf(ring, title)
  })

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      close()
      document.removeEventListener('keydown', onKey)
    }
  }
  document.addEventListener('keydown', onKey)
}

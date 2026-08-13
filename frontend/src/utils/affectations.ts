// Découpage d'une parcelle cadastrale par les affectations du plan d'aménagement
// (intersection géométrique via @turf/intersect) + affichage détaillé.

import intersect from '@turf/intersect'
import { extractRing, polygonAreaM2 } from './terrainDims'

export interface AffectationPiece {
  feature: any
  properties: Record<string, unknown>
  designation: string
  label: string
  color: string
  areaM2: number
  percent: number
}

export interface PreparedPAZone {
  feature: any
  bbox: { minX: number; maxX: number; minY: number; maxY: number }
}

const AFFECTATION_PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6',
  '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#800000', '#aaffc3',
  '#808000', '#ffd8b1', '#000075', '#f0a3a3', '#1b3a6e', '#46f0a0',
]

// Couleur stable pour un même code d'affectation (déterminée par hachage).
export function affectationColor(key: string): string {
  const s = key || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AFFECTATION_PALETTE[h % AFFECTATION_PALETTE.length]
}

// Nom lisible d'une affectation : « Code — Description » (ex. « RB1 — Parc de stationnement »).
export function affectationLabel(props: Record<string, unknown>): string {
  const code = String(props.designation ?? '').trim()
  const desc = String(props.type_construction ?? '').trim()
  const definition = String(props.definition ?? '').trim()
  const description = desc || definition
  if (code && description) return `${code} — ${description}`
  if (code) return code
  if (description) return description
  return 'Affectation non définie'
}

// Détails complémentaires (règlement) d'une affectation, sous forme de paires libellé/valeur.
export function affectationDetails(props: Record<string, unknown>): { label: string; value: string }[] {
  const fields: [string, string][] = [
    ['definition', 'Définition'],
    ['type_construction', 'Type de construction'],
    ['cos', 'COS'],
    ['cus', 'CUS'],
    ['hauteur_max', 'Hauteur max'],
    ['largeur_min', 'Largeur min'],
    ['surface_min', 'Surface min'],
    ['ville', 'Commune'],
  ]
  const out: { label: string; value: string }[] = []
  fields.forEach(([key, label]) => {
    const v = props[key]
    if (v === null || v === undefined || v === '') return
    out.push({ label, value: String(v) })
  })
  return out
}

// Bounding box [lng, lat] d'une géométrie (Polygon / MultiPolygon).
export function featureBBoxFromGeom(geometry: unknown): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const walk = (arr: unknown[]): void => {
    for (const p of arr) {
      if (Array.isArray(p) && Array.isArray(p[0])) walk(p as unknown[])
      else {
        const pt = p as number[]
        minX = Math.min(minX, pt[0])
        maxX = Math.max(maxX, pt[0])
        minY = Math.min(minY, pt[1])
        maxY = Math.max(maxY, pt[1])
      }
    }
  }
  walk((geometry as { coordinates: unknown }).coordinates as unknown[])
  return { minX, maxX, minY, maxY }
}

// Supprime la coordonnée Z d'une géométrie (clone profond) — requis par turf.
export function stripZGeometry(geometry: unknown): { type: string; coordinates: unknown } {
  const g = JSON.parse(JSON.stringify(geometry)) as { type: string; coordinates: unknown }
  const walk = (arr: unknown[]): void => {
    for (const p of arr) {
      if (Array.isArray(p) && Array.isArray(p[0])) walk(p as unknown[])
      else (p as number[]).length = 2
    }
  }
  walk(g.coordinates as unknown[])
  return g
}

// Prépare une fois les polygones du plan d'aménagement (Z supprimé + bbox) pour accélérer les intersections.
export function preparePAZones(features: { geometry: unknown; properties: Record<string, unknown> }[]): PreparedPAZone[] {
  return features.map((f) => {
    const geometry = stripZGeometry(f.geometry)
    return {
      feature: { type: 'Feature', properties: f.properties, geometry },
      bbox: featureBBoxFromGeom(geometry),
    }
  })
}

function ringsFromGeometry(geometry: unknown): number[][][] {
  const out: number[][][] = []
  const g = geometry as { type?: string; coordinates?: unknown }
  if (!g || typeof g !== 'object') return out
  if (g.type === 'Polygon') {
    const ring = extractRing(geometry)
    if (ring) out.push(ring)
  } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    for (const poly of g.coordinates as unknown[][]) {
      const ring = extractRing({ type: 'Polygon', coordinates: poly })
      if (ring) out.push(ring)
    }
  }
  return out
}

// Surface en m² d'une géométrie (somme des anneaux, projection équirectangulaire locale).
export function geometryAreaM2(geometry: unknown): number {
  return ringsFromGeometry(geometry).reduce((sum, r) => sum + polygonAreaM2(r), 0)
}

export function formatAffArea(m2: number): string {
  if (!Number.isFinite(m2)) return '—'
  if (m2 >= 10000) {
    return `${(m2 / 10000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ha`
  }
  return `${Math.round(m2).toLocaleString('fr-FR')} m²`
}

// Découpe une parcelle cadastrale par les zones du plan d'aménagement et
// retourne la liste des affectations présentes (triées par surface décroissante).
export function computeParcelAffectations(
  cadastreFeature: { geometry: unknown; properties: Record<string, unknown> },
  paZones: PreparedPAZone[]
): AffectationPiece[] {
  const cadGeom = stripZGeometry(cadastreFeature.geometry)
  const cadFeat = { type: 'Feature' as const, properties: cadastreFeature.properties, geometry: cadGeom }
  const pb = featureBBoxFromGeom(cadGeom)
  const totalArea = geometryAreaM2(cadGeom)

  const pieces: AffectationPiece[] = []
  for (const z of paZones) {
    const zb = z.bbox
    if (pb.maxX < zb.minX || zb.maxX < pb.minX || pb.maxY < zb.minY || zb.maxY < pb.minY) continue
    try {
      const res = intersect(
        { type: 'FeatureCollection', features: [cadFeat, z.feature] },
        { properties: z.feature.properties }
      )
      if (!res) continue
      const props = (res.properties ?? z.feature.properties) as Record<string, unknown>
      const area = geometryAreaM2(res.geometry)
      if (area <= 0) continue
      const designation = String(props.designation ?? '').trim()
      pieces.push({
        feature: res as AffectationPiece['feature'],
        properties: props,
        designation,
        label: affectationLabel(props),
        color: affectationColor(designation),
        areaM2: area,
        percent: totalArea > 0 ? (area / totalArea) * 100 : 0,
      })
    } catch {
      /* géométrie invalide — ignorée */
    }
  }

  pieces.sort((a, b) => b.areaM2 - a.areaM2)
  return pieces
}

// ── Plan SVG (parcelle + affectations colorées), inspiré du plan topographique ──

const AFF_SVG_W = 380
const AFF_SVG_H = 250

const AFF_GRID_LINES =
  '<line x1="0" y1="50" x2="380" y2="50"/><line x1="0" y1="100" x2="380" y2="100"/><line x1="0" y1="150" x2="380" y2="150"/><line x1="0" y1="200" x2="380" y2="200"/>' +
  '<line x1="76" y1="0" x2="76" y2="250"/><line x1="152" y1="0" x2="152" y2="250"/><line x1="228" y1="0" x2="228" y2="250"/><line x1="304" y1="0" x2="304" y2="250"/>'

function affProject(ring: number[][]) {
  const W = AFF_SVG_W
  const H = AFF_SVG_H
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
  return { px, py }
}

function ringArea(ring: number[][]): number {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i]
    const p2 = ring[(i + 1) % ring.length]
    s += p1[0] * p2[1] - p2[0] * p1[1]
  }
  return Math.abs(s) / 2
}

// Centroïde d'un anneau (coordonnées [lng, lat]) par la formule du polygone.
function ringCentroid(ring: number[][]): { x: number; y: number } | null {
  const n = ring.length
  if (n < 3) return null
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    const p1 = ring[i]
    const p2 = ring[(i + 1) % n]
    const cross = p1[0] * p2[1] - p2[0] * p1[1]
    a += cross
    cx += (p1[0] + p2[0]) * cross
    cy += (p1[1] + p2[1]) * cross
  }
  if (Math.abs(a) < 1e-12) return null
  a *= 0.5
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

// Étiquette de l'affectation placée au centroïde de chaque pièce du plan.
function affectationLabels(px: (v: number) => number, py: (v: number) => number, pieces: AffectationPiece[]): string {
  return pieces
    .map((pc) => {
      const rings = ringsFromGeometry(pc.feature.geometry)
      if (rings.length === 0) return ''
      let main = rings[0]
      for (const r of rings) if (ringArea(r) > ringArea(main)) main = r
      const c = ringCentroid(main)
      if (!c) return ''
      const text = pc.designation || pc.label
      return `<text x="${px(c.x).toFixed(1)}" y="${py(c.y).toFixed(1)}" text-anchor="middle" class="geo-aff-label">${escapeAffHtml(text)}</text>`
    })
    .join('')
}

export function buildAffectationPlanSvg(terrainRing: number[][], pieces: AffectationPiece[]): string {
  const { px, py } = affProject(terrainRing)
  const pts = (ring: number[][]): string => ring.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ')
  const terrainPts = pts(terrainRing)
  const zones = pieces
    .map((pc) =>
      ringsFromGeometry(pc.feature.geometry)
        .map((r) => `<polygon class="geo-aff-piece" fill="${pc.color}" points="${pts(r)}"/>`)
        .join('')
    )
    .join('')
  return (
    `<rect width="${AFF_SVG_W}" height="${AFF_SVG_H}" fill="#fbfdff"/>` +
    `<g class="geo-dims-grid">${AFF_GRID_LINES}</g>` +
    zones +
    `<g class="geo-aff-labels">${affectationLabels(px, py, pieces)}</g>` +
    `<polygon class="geo-aff-terrain" points="${terrainPts}"/>` +
    `<g class="geo-dims-north" transform="translate(${AFF_SVG_W - 22},16)"><path d="M0 10 L4 4 L-4 4 Z"/><path d="M0 10 V16" stroke-width="1.4"/></g>`
  )
}

export function escapeAffHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Bloc modal « Affectations du terrain », sur le modèle du modal Dimensions du terrain.
export function buildAffectationsModalHtml(title: string, terrainRing: number[][], pieces: AffectationPiece[]): string {
  const terrainArea = polygonAreaM2(terrainRing)
  const piecesArea = pieces.reduce((sum, p) => sum + p.areaM2, 0)
  const rows = pieces
    .map((pc) => {
      const details = affectationDetails(pc.properties)
        .map((d) => `<span class="geo-aff-detail">${escapeAffHtml(d.label)}&nbsp;: <strong>${escapeAffHtml(d.value)}</strong></span>`)
        .join('')
      return `<tr>
        <td class="geo-aff-cell-swatch"><span class="geo-aff-swatch" style="background:${pc.color}"></span></td>
        <td class="geo-aff-cell-main">
          <div class="geo-aff-name">${escapeAffHtml(pc.label)}</div>
          ${details ? `<div class="geo-aff-details">${details}</div>` : ''}
        </td>
        <td class="geo-aff-cell-num">${escapeAffHtml(formatAffArea(pc.areaM2))}</td>
        <td class="geo-aff-cell-num">${pc.percent.toFixed(1)} %</td>
      </tr>`
    })
    .join('')

  const emptyRows = pieces.length === 0
    ? '<tr class="geo-aff-empty"><td colspan="4">Aucune affectation trouvée pour cette parcelle dans le plan d\'aménagement.</td></tr>'
    : ''

  return (
    `<div class="geo-dims-overlay" data-aff-overlay>` +
    `<div class="geo-dims-modal geo-aff-modal">` +
    `<div class="geo-dims-header">` +
    `<h3>Affectations du terrain</h3>` +
    `<div class="geo-dims-header-actions">` +
    `<button type="button" class="geo-dims-close" data-aff-close aria-label="Fermer">&times;</button>` +
    `</div>` +
    `</div>` +
    `<div class="geo-dims-body">` +
    `<div class="geo-dims-title">${escapeAffHtml(title)}</div>` +
    `<div class="geo-dims-plot geo-aff-plot">` +
    `<svg class="geo-dims-svg" viewBox="0 0 ${AFF_SVG_W} ${AFF_SVG_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Affectations de la parcelle">${buildAffectationPlanSvg(terrainRing, pieces)}</svg>` +
    `</div>` +
    `<table class="geo-dims-table geo-aff-table">` +
    `<thead><tr><th></th><th>Affectation</th><th>Superficie</th><th>Part</th></tr></thead>` +
    `<tbody>` +
    rows +
    emptyRows +
    `<tr class="geo-dims-total"><td></td><td>Total parcelles intersectées</td><td>${escapeAffHtml(formatAffArea(piecesArea))}</td><td></td></tr>` +
    `<tr class="geo-dims-total"><td></td><td>Superficie totale du terrain</td><td>${escapeAffHtml(formatAffArea(terrainArea))}</td><td></td></tr>` +
    `</tbody>` +
    `</table>` +
    `</div>` +
    `</div>` +
    `</div>`
  )
}

export function showAffectationsModal(title: string, terrainRing: number[][], pieces: AffectationPiece[]): void {
  document.querySelector('[data-aff-overlay]')?.remove()
  const div = document.createElement('div')
  div.innerHTML = buildAffectationsModalHtml(title, terrainRing, pieces)
  const overlay = div.firstElementChild as HTMLElement
  document.body.appendChild(overlay)
  const close = (): void => overlay.remove()
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) close()
  })
  overlay.querySelector<HTMLElement>('[data-aff-close]')?.addEventListener('click', close)
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      close()
      document.removeEventListener('keydown', onKey)
    }
  }
  document.addEventListener('keydown', onKey)
}

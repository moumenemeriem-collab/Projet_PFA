// Découpage d'une parcelle cadastrale par les affectations du plan d'aménagement
// (intersection géométrique via @turf/intersect) + affichage détaillé.

import intersect from '@turf/intersect'
import { extractRing, polygonAreaM2 } from './terrainDims'
import { downloadAffectationsPdf } from './pdfPlan'
import { getReglesPrincipales, getReglesDesignation } from './reglementationPA'

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

const NON_DEFINIE_PREFIXES = new Set(['AA', 'AAT', 'HA', 'MK', 'TA', 'SK', 'ME'])

const ALLOWED_ZONING = new Set([
  'B', 'B2', 'B3', 'B4', 'SB', 'SB2', 'SB4', 'SB6',
  'C', 'C2', 'C4',
  'ZPI', 'ZS',
  'IN', 'IN2', 'IN3', 'INS',
  'D', 'DS1', 'D1', 'D5',
  'RB', 'RS',
])

/**
 * Détermine si une affectation a un rôle effectif dans l'analyse / le calcul de rentabilité
 * (zonage constructible, équipements publics/privés, voirie/voies, espaces verts).
 * Masque uniquement les affectations non définies (null, vides, préfixes caducs AA/HA/MK/TA...).
 */
export function isAffectationValide(designation: unknown, props?: Record<string, unknown>): boolean {
  if (designation == null) return false
  const raw = String(designation).trim()
  if (!raw) return false
  const code = raw.toUpperCase()
  if (
    code === 'NULL' ||
    code === 'UNDEFINED' ||
    code === 'NONE' ||
    code === '-' ||
    code === 'NON DÉFINIE' ||
    code === 'NON DEFINIE' ||
    code === 'AFFECTATION NON DÉFINIE' ||
    code === 'AFFECTATION NON DEFINIE' ||
    NON_DEFINIE_PREFIXES.has(code)
  ) {
    return false
  }

  // 1. Zonage d'urbanisme constructible validé
  if (ALLOWED_ZONING.has(code) || getReglesDesignation(code).length > 0) {
    return true
  }

  // 2. Équipements publics ou privés (A, P, E, S, SP, M, C, G...)
  if (/^(A|P|E|S|SP|M|C|G)\d+/i.test(code)) {
    return true
  }

  // 3. Voirie / Voies d'aménagement (TE, CP, PS, PL, RP, RN, RR...)
  if (/^(TE|CP|PS|PL|RP|RN|RR)\d*/i.test(code)) {
    return true
  }

  // 4. Espaces verts (V...)
  if (/^V\d*/i.test(code)) {
    return true
  }

  // 5. Identification par le type de construction ou définition
  const tc = String(props?.type_construction ?? props?.definition ?? '').toLowerCase()
  if (tc) {
    const isEq = /equipement|administration|enseignement|sante|santé|sport|culte|mosqu|police|protection civile|service public|crèche|creche|scolaire/i.test(tc)
    const isVoie = /voie|voirie|rue|chemin|place|parking|stationnement|rond|pi[ée]ton|autoroute/i.test(tc)
    const isEv = /espace vert|mail plant|square|jardin|parc/i.test(tc)
    if (isEq || isVoie || isEv) {
      return true
    }
  }

  return false
}

// Couleur stable pour un même code d'affectation (déterminée par hachage).
export function affectationColor(key: string): string {
  const s = key || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AFFECTATION_PALETTE[h % AFFECTATION_PALETTE.length]
}

// Nom lisible d'une affectation : « Code : Description » (ex. « RB1 : Parc de stationnement »).
export function affectationLabel(props: Record<string, unknown>): string {
  const code = String(props.designation ?? '').trim()
  if (!isAffectationValide(code, props)) return ''
  const desc = String(props.type_construction ?? '').trim()
  const definition = String(props.definition ?? '').trim()
  const description = desc || definition
  if (code && description) return `${code} : ${description}`
  if (code) return code
  if (description) return description
  return code
}

// Ordre et libellés préférés des attributs du plan d'aménagement.
const AFF_ATTR_ORDER: [string, string][] = [
  ['designation', 'Code'],
  ['definition', 'Définition'],
  ['type_construction', 'Type de construction'],
  ['cos', 'COS'],
  ['cus', 'CUS'],
  ['hauteur_max', 'Hauteur max'],
  ['largeur_min', 'Largeur min'],
  ['surface_min', 'Surface min'],
  ['ville', 'Commune'],
]

const AFF_ATTR_EXCLUDED = new Set(['geometry', 'id', 'gid', 'ogc_fid', 'fid'])

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function hasAttrData(pieces: AffectationPiece[], key: string): boolean {
  return pieces.some((pc) => {
    const v = pc.properties[key]
    return v !== null && v !== undefined && v !== ''
  })
}

// Liste des colonnes à afficher : attributs connus d'abord (s'ils ont des
// données), puis tous les autres attributs non vides présents dans les pièces.
export function collectAffectationColumns(pieces: AffectationPiece[]): [string, string][] {
  const seen = new Set<string>()
  const order: [string, string][] = []
  const add = (key: string): void => {
    if (seen.has(key) || AFF_ATTR_EXCLUDED.has(key) || !hasAttrData(pieces, key)) return
    seen.add(key)
    const label = AFF_ATTR_ORDER.find(([k]) => k === key)?.[1] ?? humanizeKey(key)
    order.push([key, label])
  }
  AFF_ATTR_ORDER.forEach(([k]) => add(k))
  pieces.forEach((pc) => Object.keys(pc.properties).forEach(add))
  return order
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
  return features
    .filter((f) => isAffectationValide(f.properties?.designation, f.properties))
    .map((f) => {
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
  if (!Number.isFinite(m2)) return '0 m²'
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
      if (!isAffectationValide(designation, props)) continue
      const label = affectationLabel(props)
      if (!label) continue

      pieces.push({
        feature: res as AffectationPiece['feature'],
        properties: props,
        designation,
        label,
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

export function buildAffectationPlanSvg(terrainRing: number[][], pieces: AffectationPiece[]): string {
  const { px, py } = affProject(terrainRing)
  const pts = (ring: number[][]): string => ring.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ')
  const terrainPts = pts(terrainRing)
  const zones = pieces
    .map((pc) =>
      ringsFromGeometry(pc.feature.geometry)
        .map((r) => {
          const title = `<title>${escapeAffHtml(pc.label)} : ${escapeAffHtml(formatAffArea(pc.areaM2))} · ${pc.percent.toFixed(1)} %</title>`
          return `<polygon class="geo-aff-piece" fill="${pc.color}" points="${pts(r)}">${title}</polygon>`
        })
        .join('')
    )
    .join('')
  return (
    `<rect width="${AFF_SVG_W}" height="${AFF_SVG_H}" fill="#fbfdff"/>` +
    `<g class="geo-dims-grid">${AFF_GRID_LINES}</g>` +
    zones +
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
  const columns = collectAffectationColumns(pieces).filter(([k]) => k !== 'designation')
  const numCols = columns.length + 4
  const rows = pieces
    .map((pc) => {
      const code = pc.designation || ''
      const desc = String(pc.properties.type_construction ?? pc.properties.definition ?? '').trim()
      const propCells = columns
        .filter(([key]) => key !== 'designation')
        .map(([key]) => {
          const v = pc.properties[key]
          const val = v === null || v === undefined || v === '' ? '' : String(v)
          return `<td class="geo-aff-cell${key === 'definition' ? ' geo-aff-cell--wide' : ''}">${escapeAffHtml(val)}</td>`
        })
        .join('')
      const nameContent = code
        ? `<span class="geo-aff-badge">${escapeAffHtml(code)}</span>` + (desc ? `<span class="geo-aff-desc" title="${escapeAffHtml(desc)}">${escapeAffHtml(desc)}</span>` : '')
        : `<span title="${escapeAffHtml(desc || 'Affectation non définie')}">${escapeAffHtml(desc || 'Affectation non définie')}</span>`
      return (
        `<tr class="geo-aff-row">` +
        `<td class="geo-aff-cell-swatch"><span class="geo-aff-swatch" style="background:${pc.color}"></span></td>` +
        `<td class="geo-aff-cell-main"><div class="geo-aff-name">${nameContent}</div></td>` +
        `<td class="geo-aff-cell-num">${escapeAffHtml(formatAffArea(pc.areaM2))}</td>` +
        `<td class="geo-aff-cell-num">${pc.percent.toFixed(1)} %</td>` +
        propCells +
        `<td class="geo-aff-cell">${escapeAffHtml(code ? (getReglesPrincipales(code)?.conditions || 'Non spécifié') : 'Non spécifié')}</td>` +
        `<td class="geo-aff-cell">${escapeAffHtml(code ? (getReglesPrincipales(code)?.typeOperation || 'Non spécifié') : 'Non spécifié')}</td>` +
        `</tr>`
      )
    })
    .join('')

  const emptyRows = pieces.length === 0
    ? `<tr class="geo-aff-empty"><td colspan="${numCols}">Aucune affectation trouvée pour cette parcelle dans le plan d\'aménagement.</td></tr>`
    : ''

  return (
    `<div class="geo-dims-overlay" data-aff-overlay>` +
    `<div class="geo-dims-modal geo-aff-modal">` +
    `<div class="geo-dims-header">` +
    `<h3>Affectations du terrain</h3>` +
    `<div class="geo-dims-header-actions">` +
    `<button type="button" class="geo-dims-download" data-aff-pdf title="Télécharger le plan des affectations (PDF)" aria-label="Télécharger le plan des affectations (PDF)">` +
    `<svg class="geo-dims-pdf-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 1.5A1.5 1.5 0 0 1 3.5 0H10l4 4v10.5A1.5 1.5 0 0 1 12.5 16h-9A1.5 1.5 0 0 1 2 14.5v-13zM10 0.5V4a1 1 0 0 0 1 1h3.5L10 0.5zM9 7v5.3L7.1 10.4a.6.6 0 1 0-.85.85l2.6 2.6a.6.6 0 0 0 .85 0l2.6-2.6a.6.6 0 1 0-.85-.85L10 12.3V7a.6.6 0 1 0-1 0z"/></svg>` +
    `</button>` +
    `<button type="button" class="geo-dims-expand" data-aff-expand title="Agrandir / réduire" aria-label="Agrandir / réduire">` +
    `<svg class="geo-dims-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>` +
    `<svg class="geo-dims-expand-icon geo-dims-expand-icon--min" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>` +
    `</button>` +
    `<button type="button" class="geo-dims-close" data-aff-close aria-label="Fermer">&times;</button>` +
    `</div>` +
    `</div>` +
    `<div class="geo-dims-body">` +
    `<div class="geo-dims-title">${escapeAffHtml(title)}</div>` +
    `<div class="geo-dims-plot geo-aff-plot" data-aff-plot>` +
    `<svg class="geo-dims-svg geo-aff-svg" data-aff-svg viewBox="0 0 ${AFF_SVG_W} ${AFF_SVG_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Affectations de la parcelle">${buildAffectationPlanSvg(terrainRing, pieces)}</svg>` +
    `<div class="geo-dims-zoom">` +
    `<button type="button" class="geo-dims-zoom-btn" data-aff-zoom="out" aria-label="Dézoomer">&#8722;</button>` +
    `<span class="geo-dims-zoom-value" data-aff-hint>100%</span>` +
    `<button type="button" class="geo-dims-zoom-btn" data-aff-zoom="in" aria-label="Zoomer">+</button>` +
    `</div>` +
    `</div>` +
    `<div class="geo-aff-scroll">` +
    `<table class="geo-dims-table geo-aff-table">` +
    `<thead><tr>` +
    `<th></th><th>Affectation</th><th>Superficie</th><th>Part</th>` +
    columns.map(([key, label]) => `<th class="geo-aff-cell${key === 'definition' ? ' geo-aff-cell--wide' : ''}">${escapeAffHtml(label)}</th>`).join('') +
    `<th>Conditions</th><th>Type d'op&eacute;ration</th>` +
    `</tr></thead>` +
    `<tbody>` +
    rows +
    emptyRows +
    `<tr class="geo-dims-total"><td></td><td>Total parcelles intersectées</td><td>${escapeAffHtml(formatAffArea(piecesArea))}</td><td></td>` +
    `<td colspan="${columns.length + 2}"></td></tr>` +
    `<tr class="geo-dims-total"><td></td><td>Superficie totale du terrain</td><td>${escapeAffHtml(formatAffArea(terrainArea))}</td><td></td>` +
    `<td colspan="${columns.length + 2}"></td></tr>` +
    `</tbody>` +
    `</table>` +
    `</div>` +
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

  const close = (): void => {
    overlay.remove()
    document.removeEventListener('keydown', onKey)
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) close()
  })
  overlay.querySelector<HTMLElement>('[data-aff-close]')?.addEventListener('click', close)
  overlay.querySelector<HTMLElement>('[data-aff-pdf]')?.addEventListener('click', () => {
    downloadAffectationsPdf(title, terrainRing, pieces)
  })

  const modal = overlay.querySelector<HTMLElement>('.geo-aff-modal')
  overlay.querySelector<HTMLElement>('[data-aff-expand]')?.addEventListener('click', () => {
    modal?.classList.toggle('geo-aff-modal--expanded')
  })

  // Navigation du dessin : zoom (+/- boutons et molette) + déplacement (glisser).
  const svg = overlay.querySelector<SVGSVGElement>('[data-aff-svg]')
  const hint = overlay.querySelector<HTMLElement>('[data-aff-hint]')
  const plot = overlay.querySelector<HTMLElement>('[data-aff-plot]')
  let scale = 1
  let tx = 0
  let ty = 0
  const apply = (): void => {
    if (svg) svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
    if (hint) hint.textContent = `${Math.round(scale * 100)}%`
  }
  const setScale = (s: number): void => {
    scale = Math.min(4, Math.max(1, s))
    apply()
  }
  overlay.querySelector<HTMLElement>('[data-aff-zoom="in"]')?.addEventListener('click', () => setScale(scale + 0.25))
  overlay.querySelector<HTMLElement>('[data-aff-zoom="out"]')?.addEventListener('click', () => setScale(scale - 0.25))

  let dragging = false
  let lastX = 0
  let lastY = 0
  const onMove = (e: MouseEvent): void => {
    if (!dragging) return
    tx += e.clientX - lastX
    ty += e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    apply()
  }
  const onUp = (): void => {
    if (!dragging) return
    dragging = false
    plot?.classList.remove('geo-aff-plot--dragging')
  }
  plot?.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('[data-aff-zoom]')) return
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    plot.classList.add('geo-aff-plot--dragging')
  })
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  plot?.addEventListener('wheel', (e) => {
    e.preventDefault()
    setScale(scale + (e.deltaY < 0 ? 0.25 : -0.25))
  }, { passive: false })

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKey)
}

// Génération d'un plan topographique et d'affectations PDF d'une parcelle cadastrale en EPSG:26191
// (Merchich / Sahara — Lambert Conique Conforme, unité : mètre).
// Aucune dépendance externe : projection native + moteur PDF vectoriel professionnel.
// Structure : Page 1 portrait (fiche d'identité + métriques + tableau des sommets/côtés),
// Page 2 paysage (plan topographique vectoriel avec cartouche, échelle et coordonnées).

import type { AffectationPiece } from './affectations'

interface Pt {
  x: number
  y: number
}

interface PlanData {
  title: string
  pts: Pt[]
  sides: number[]
  perimeter: number
  area: number
}

// ---------------------------------------------------------------------------
// Constantes & Formatage A4
// ---------------------------------------------------------------------------

const AP = 595.28 // A4 portrait largeur
const APH = 841.89 // A4 portrait hauteur
const AL = 841.89 // A4 paysage largeur
const ALH = 595.28 // A4 paysage hauteur

const NAVY = '0.01 0.35 0.55'
const BLUE_ACCENT = '0.02 0.52 0.78'
const DARK = '0.06 0.09 0.16'
const GRAY = '0.4 0.45 0.52'
const LINE = '0.88 0.91 0.94'
const BG_CARD = '0.98 0.985 0.99'
const BG_GREEN = '0.94 0.99 0.95'
const GREEN_TEXT = '0.09 0.55 0.24'
const BG_BLUE = '0.94 0.97 1.0'
const BLUE_TEXT = '0.08 0.4 0.75'
const BG_AMBER = '0.99 0.97 0.92'
const AMBER_TEXT = '0.70 0.45 0.05'
const GRID = '0.88 0.91 0.94'

// ---------------------------------------------------------------------------
// Projection EPSG:26191
// ---------------------------------------------------------------------------

const E26191 = {
  a: 6378249.2, // Clarke 1880 (IGN)
  f: 1 / 293.4660212936269,
  lat0: (33.3 * Math.PI) / 180,
  lon0: (-5.4 * Math.PI) / 180,
  k0: 0.999625769,
  fe: 500000,
  fn: 300000,
}

export function projectSahara(latDeg: number, lngDeg: number): Pt {
  const { a, f, lat0, lon0, k0, fe, fn } = E26191
  const e2 = f * (2 - f)
  const e = Math.sqrt(e2)
  const toRad = (d: number): number => (d * Math.PI) / 180
  const phi = toRad(latDeg)
  const lam = toRad(lngDeg)
  const tOf = (p: number): number =>
    Math.tan(Math.PI / 4 - p / 2) / Math.pow((1 - e * Math.sin(p)) / (1 + e * Math.sin(p)), e / 2)
  const mOf = (p: number): number => Math.cos(p) / Math.sqrt(1 - e2 * Math.sin(p) * Math.sin(p))
  const t = tOf(phi)
  const t0 = tOf(lat0)
  const n = Math.sin(lat0)
  const F = mOf(lat0) / (n * Math.pow(t0, n))
  const rho = a * F * Math.pow(t, n) * k0
  const rho0 = a * F * Math.pow(t0, n) * k0
  const theta = n * (lam - lon0)
  return {
    x: fe + rho * Math.sin(theta),
    y: fn + rho0 - rho * Math.cos(theta),
  }
}

function polygonArea(pts: Pt[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    s += p.x * q.y - q.x * p.y
  }
  return Math.abs(s) / 2
}

// ---------------------------------------------------------------------------
// Encodage WinAnsi (polices standard du PDF : accents français, tirets, etc.)
// ---------------------------------------------------------------------------

const WIN_ANSI: Record<string, number> = {
  '¡': 0xa1, '¢': 0xa2, '£': 0xa3, '¤': 0xa4, '¥': 0xa5, '¦': 0xa6, '§': 0xa7,
  '¨': 0xa8, '©': 0xa9, 'ª': 0xaa, '«': 0xab, '¬': 0xac, '®': 0xae, '¯': 0xaf,
  '°': 0xb0, '±': 0xb1, '²': 0xb2, '³': 0xb3, '´': 0xb4, 'µ': 0xb5, '¶': 0xb6,
  '·': 0xb7, '¸': 0xb8, '¹': 0xb9, 'º': 0xba, '»': 0xbb, '¼': 0xbc, '½': 0xbd, '¾': 0xbe,
  '¿': 0xbf,
  'À': 0xc0, 'Á': 0xc1, 'Â': 0xc2, 'Ã': 0xc3, 'Ä': 0xc4, 'Å': 0xc5, 'Æ': 0xc6,
  'Ç': 0xc7, 'È': 0xc8, 'É': 0xc9, 'Ê': 0xca, 'Ë': 0xcb, 'Ì': 0xcc, 'Í': 0xcd,
  'Î': 0xce, 'Ï': 0xcf, 'Ð': 0xd0, 'Ñ': 0xd1, 'Ò': 0xd2, 'Ó': 0xd3, 'Ô': 0xd4,
  'Õ': 0xd5, 'Ö': 0xd6, 'Ø': 0xd8, 'Ù': 0xd9, 'Ú': 0xda, 'Û': 0xdb, 'Ü': 0xdc,
  'Ý': 0xdd, 'Þ': 0xde,
  'à': 0xe0, 'á': 0xe1, 'â': 0xe2, 'ã': 0xe3, 'ä': 0xe4, 'å': 0xe5, 'æ': 0xe6,
  'ç': 0xe7, 'è': 0xe8, 'é': 0xe9, 'ê': 0xea, 'ë': 0xeb, 'ì': 0xec, 'í': 0xed,
  'î': 0xee, 'ï': 0xef, 'ð': 0xf0, 'ñ': 0xf1, 'ò': 0xf2, 'ó': 0xf3, 'ô': 0xf4,
  'õ': 0xf5, 'ö': 0xf6, '÷': 0xf7, 'ø': 0xf8, 'ù': 0xf9, 'ú': 0xfa, 'û': 0xfb,
  'ü': 0xfc, 'ý': 0xfd, 'þ': 0xfe, 'ÿ': 0xff,
  '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88,
  '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

function winAnsiBytes(s: string): number[] {
  const out: number[] = []
  for (const ch of s) {
    const m = WIN_ANSI[ch]
    if (m != null) out.push(m)
    else {
      const code = ch.codePointAt(0) ?? 0
      out.push(code < 0x80 ? code : 0x3f)
    }
  }
  return out
}

function esc(s: string): string {
  let r = ''
  for (const ch of s) {
    if (ch === '(' || ch === ')' || ch === '\\') r += '\\'
    r += ch
  }
  return r
}

// Métriques Helvetica
const HELV_W: Record<number, number> = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556,
  58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556, 64: 1015,
  65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278,
  74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722,
  83: 667, 84: 611, 85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611,
  91: 278, 92: 278, 93: 278, 94: 469, 95: 556, 96: 333,
  97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556, 104: 556,
  105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556, 111: 556, 112: 556,
  113: 556, 114: 333, 115: 500, 116: 278, 117: 556, 118: 500, 119: 722, 120: 500,
  121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584,
  0x96: 556, 0x97: 1000, 0x91: 222, 0x92: 222, 0x93: 400, 0x94: 400, 0x85: 1000,
  0xb2: 333, 0xb0: 400,
}

const HELV_BOLD_W: Record<number, number> = {
  32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 238,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556,
  58: 333, 59: 333, 60: 584, 61: 584, 62: 584, 63: 611, 64: 975,
  65: 722, 66: 722, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278,
  74: 556, 75: 722, 76: 611, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722,
  83: 667, 84: 611, 85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611,
  91: 333, 92: 278, 93: 333, 94: 584, 95: 556, 96: 333,
  97: 556, 98: 611, 99: 556, 100: 611, 101: 556, 102: 333, 103: 611, 104: 611,
  105: 278, 106: 278, 107: 556, 108: 278, 109: 889, 110: 611, 111: 611, 112: 611,
  113: 611, 114: 389, 115: 556, 116: 333, 117: 611, 118: 556, 119: 778, 120: 556,
  121: 556, 122: 500, 123: 389, 124: 280, 125: 389, 126: 584,
  0x96: 556, 0x97: 1000, 0x91: 278, 0x92: 278, 0x93: 500, 0x94: 500, 0x85: 1000,
  0xb2: 333, 0xb0: 400,
}

const ACCENT_BASE: Record<string, string> = {
  À: 'A', Á: 'A', Â: 'A', Ã: 'A', Ä: 'A', Å: 'A',
  Ç: 'C', È: 'E', É: 'E', Ê: 'E', Ë: 'E',
  Ì: 'I', Í: 'I', Î: 'I', Ï: 'I',
  Ñ: 'N', Ò: 'O', Ó: 'O', Ô: 'O', Õ: 'O', Ö: 'O', Ø: 'O',
  Ù: 'U', Ú: 'U', Ü: 'U', Ý: 'Y',
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
  ç: 'c', è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ñ: 'n', ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o',
  ù: 'u', ú: 'u', ü: 'u', ý: 'y', ÿ: 'y',
}

function charWidth(ch: string, bold: boolean): number {
  const table = bold ? HELV_BOLD_W : HELV_W
  const code = ch.codePointAt(0) ?? 0
  if (table[code] != null) return table[code]
  const byte = WIN_ANSI[ch]
  if (byte != null && table[byte] != null) return table[byte]
  const base = ACCENT_BASE[ch]
  if (base) {
    const baseCode = base.codePointAt(0) ?? 0
    if (table[baseCode] != null) return table[baseCode]
  }
  return 556
}

function textW(s: string, size: number, bold = false): number {
  let u = 0
  for (const ch of s) u += charWidth(ch, bold)
  return (u * size) / 1000
}

function fitText(s: string, size: number, maxW: number, bold = false): string {
  if (textW(s, size, bold) <= maxW) return s
  let r = s
  while (r.length > 1 && textW(r + '…', size, bold) > maxW) r = r.slice(0, -1)
  return r + '…'
}

function frNum(v: number, maxDec = 0): string {
  const f = Number(v.toFixed(Math.max(0, maxDec)))
  const neg = f < 0 ? '-' : ''
  const str = Math.abs(f).toFixed(Math.max(0, maxDec))
  const dot = str.indexOf('.')
  const int = dot === -1 ? str : str.slice(0, dot)
  const dec = dot === -1 ? '' : str.slice(dot + 1)
  let gi = ''
  for (let k = 0; k < int.length; k++) {
    gi += k > 0 && (int.length - k) % 3 === 0 ? ' ' + int[k] : int[k]
  }
  return neg + gi + (dec ? ',' + dec : '')
}

function formatM(d: number): string {
  if (!Number.isFinite(d)) return '0 m'
  if (d >= 10000) return `${frNum(d / 1000, 1)} km`
  return `${frNum(d, d >= 100 ? 0 : 1)} m`
}

function formatA(m2: number): string {
  if (!Number.isFinite(m2)) return '0 m²'
  return m2 >= 10000
    ? `${frNum(m2 / 10000, 2)} ha (${frNum(m2, 0)} m²)`
    : `${frNum(m2, 0)} m²`
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function formatDateFr(d: Date): string {
  const p = (x: number): string => String(x).padStart(2, '0')
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} à ${p(d.getHours())}h${p(d.getMinutes())}`
}

function subj(d: PlanData): string {
  return /^Parcelle\b/i.test(d.title) ? d.title : `Parcelle ${d.title}`
}

function niceStep(range: number, targetTicks = 5): number {
  if (range <= 0) return 10
  const rough = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  let step = 1
  if (norm >= 5) step = 5
  else if (norm >= 2) step = 2
  return step * mag
}

// ---------------------------------------------------------------------------
// Dessin vectoriel commun
// ---------------------------------------------------------------------------

function drawRoundedRect(x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, strokeW = 1): string {
  let s = ''
  if (fill) s += `${fill} rg `
  if (stroke) s += `${stroke} RG ${strokeW} w `
  const k = 0.5522847498
  const kr = r * k
  s += `${(x + r).toFixed(2)} ${y.toFixed(2)} m `
  s += `${(x + w - r).toFixed(2)} ${y.toFixed(2)} l `
  s += `${(x + w - r + kr).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r - kr).toFixed(2)} ${(x + w).toFixed(2)} ${(y + r).toFixed(2)} c `
  s += `${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} l `
  s += `${(x + w).toFixed(2)} ${(y + h - r + kr).toFixed(2)} ${(x + w - r + kr).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)} c `
  s += `${(x + r).toFixed(2)} ${(y + h).toFixed(2)} l `
  s += `${(x + r - kr).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r + kr).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)} c `
  s += `${x.toFixed(2)} ${(y + r).toFixed(2)} l `
  s += `${x.toFixed(2)} ${(y + r - kr).toFixed(2)} ${(x + r - kr).toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c `
  if (fill && stroke) s += 'B\n'
  else if (fill) s += 'f\n'
  else if (stroke) s += 'S\n'
  return s
}

function drawHeaderBanner(title: string, subtitle: string, badgeText: string, width = AP, height = APH): string {
  const out: string[] = []
  const bannerH = 68
  const bannerY = height - bannerH

  out.push(`${NAVY} rg 0 ${bannerY.toFixed(2)} ${width.toFixed(2)} ${bannerH.toFixed(2)} re f\n`)
  out.push(`${BLUE_ACCENT} rg 0 ${(bannerY - 3).toFixed(2)} ${width.toFixed(2)} 3 re f\n`)

  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = '1 1 1'): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }

  txt('GEO INVEST • ANALYSE SPATIALE & FONCIÈRE', 36, bannerY + 48, 6.8, 'F2', '0.7 0.85 0.95')
  txt(title, 36, bannerY + 30, 14, 'F2', '1 1 1')
  txt(subtitle, 36, bannerY + 14, 8.5, 'F1', '0.85 0.92 0.98')

  if (badgeText) {
    const bw = textW(badgeText, 7.5, true) + 16
    const bx = width - 36 - bw
    const by = bannerY + 24
    out.push(drawRoundedRect(bx, by, bw, 20, 10, BLUE_ACCENT))
    txt(badgeText, bx + 8, by + 6, 7.5, 'F2', '1 1 1')
  }

  return out.join('')
}

function drawFooter(pageIdx: number, totalPages: number, dateStr: string, width = AP): string {
  const out: string[] = []
  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = GRAY): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }

  out.push(`${LINE} RG 0.8 w 36 34 m ${(width - 36).toFixed(2)} 34 l S\n`)
  txt(`GEO INVEST • Système d'Information Géographique • Généré le ${dateStr}`, 36, 22, 6.8, 'F1', GRAY)

  const rightText = `Page ${pageIdx} / ${totalPages}`
  const rw = textW(rightText, 6.8, true)
  txt(rightText, width - 36 - rw, 22, 6.8, 'F2', DARK)

  return out.join('')
}

// ---------------------------------------------------------------------------
// Anti-collision d'étiquettes (utilisé page 2 : coins + longueurs de côtés)
// ---------------------------------------------------------------------------

interface LabelBox {
  x: number
  y: number
  w: number
  h: number
  text: string
  size: number
}

function separateLabels(boxes: LabelBox[], iterations = 60, pad = 1.5): void {
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const ax0 = a.x - pad, ax1 = a.x + a.w + pad, ay0 = a.y - pad, ay1 = a.y + a.h + pad
        const bx0 = b.x - pad, bx1 = b.x + b.w + pad, by0 = b.y - pad, by1 = b.y + b.h + pad
        const overlapX = Math.min(ax1, bx1) - Math.max(ax0, bx0)
        const overlapY = Math.min(ay1, by1) - Math.max(ay0, by0)
        if (overlapX > 0 && overlapY > 0) {
          moved = true
          if (overlapX < overlapY) {
            const shift = overlapX / 2 + 0.2
            const dir = a.x + a.w / 2 < b.x + b.w / 2 ? -1 : 1
            a.x += dir * shift
            b.x -= dir * shift
          } else {
            const shift = overlapY / 2 + 0.2
            const dir = a.y + a.h / 2 < b.y + b.h / 2 ? -1 : 1
            a.y += dir * shift
            b.y -= dir * shift
          }
        }
      }
    }
    if (!moved) break
  }
}

// ---------------------------------------------------------------------------
// PAGE 1 — Fiche d'identité du terrain (portrait A4)
// ---------------------------------------------------------------------------

function buildPage1(d: PlanData, dateStr: string): string {
  const out: string[] = []
  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = DARK): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }
  const txtR = (s: string, right: number, y: number, size: number, font = 'F1', color = DARK): void =>
    txt(s, right - textW(s, size, font === 'F2'), y, size, font, color)

  // 1. En-tête
  out.push(drawHeaderBanner('PLAN TOPOGRAPHIQUE & GÉOMÉTRIQUE', subj(d), 'TOPOGRAPHIE', AP, APH))

  // 2. Grille de 4 cartes KPI
  const kpis = [
    { label: 'SUPERFICIE', val: `${frNum(d.area, 0)} m²`, sub: d.area >= 10000 ? `${frNum(d.area / 10000, 2)} ha` : 'Superficie brute', color: BG_BLUE, textColor: BLUE_TEXT },
    { label: 'PÉRIMÈTRE', val: formatM(d.perimeter), sub: 'Longueur totale contour', color: BG_CARD, textColor: NAVY },
    { label: 'SOMMETS', val: `${d.pts.length}`, sub: 'Bornes géoréférencées', color: BG_GREEN, textColor: GREEN_TEXT },
    { label: 'SYSTÈME', val: 'EPSG:26191', sub: 'Merchich / Sahara', color: BG_CARD, textColor: DARK },
  ]

  const kpiW = (AP - 72 - 3 * 8) / 4
  const kpiY = 708
  kpis.forEach((kpi, idx) => {
    const kx = 36 + idx * (kpiW + 8)
    out.push(drawRoundedRect(kx, kpiY, kpiW, 48, 6, kpi.color, LINE, 0.8))
    txt(kpi.label, kx + 8, kpiY + 34, 6.2, 'F2', GRAY)
    txt(kpi.val, kx + 8, kpiY + 18, 10, 'F2', kpi.textColor)
    txt(kpi.sub, kx + 8, kpiY + 7, 5.8, 'F1', GRAY)
  })

  // 3. Fiche d'informations du terrain
  let y = 688
  out.push(`${BLUE_ACCENT} rg 36 ${y - 12} 3 14 re f\n`)
  txt('INFORMATIONS GÉNÉRALES DU TERRAIN', 44, y - 10, 9.5, 'F2', DARK)
  y -= 22

  const infoRows = [
    { label: 'Identifiant / Nom de la parcelle :', val: subj(d) },
    { label: 'Système de coordonnées projetées :', val: 'EPSG:26191 (Merchich / Sahara - Lambert Conique Conforme)' },
    { label: 'Superficie cadastrale calculée :', val: formatA(d.area) },
    { label: 'Périmètre total du polygone :', val: formatM(d.perimeter) },
    { label: 'Date et heure du relevé :', val: dateStr },
  ]

  const infoCardH = infoRows.length * 17 + 8
  out.push(drawRoundedRect(36, y - infoCardH, AP - 72, infoCardH, 6, BG_CARD, LINE, 0.8))

  infoRows.forEach((row, i) => {
    const ry = y - 16 - i * 17
    if (i % 2 === 1) {
      out.push(`0.96 0.97 0.99 rg 37 ${(ry - 4).toFixed(2)} ${(AP - 74).toFixed(2)} 16 re f\n`)
    }
    txt(row.label, 48, ry, 7.8, 'F2', GRAY)
    txt(row.val, 230, ry, 7.8, 'F1', DARK)
  })

  y -= infoCardH + 18

  // 4. Tableau des coordonnées des sommets et des côtés
  out.push(`${BLUE_ACCENT} rg 36 ${y - 12} 3 14 re f\n`)
  txt('TABLEAU DES SOMMETS & LONGUEURS DES CÔTÉS (EPSG:26191)', 44, y - 10, 9.5, 'F2', DARK)
  y -= 22

  const tableX = 36
  const tableW = AP - 72
  const colW = { p: 50, x: 120, y: 120, seg: 100, dist: tableW - 390 }

  // En-tête du tableau
  out.push(drawRoundedRect(tableX, y - 18, tableW, 18, 4, NAVY))
  txt('Sommet', tableX + 10, y - 12, 7.5, 'F2', '1 1 1')
  txtR('X (m / Lambert)', tableX + colW.p + colW.x - 10, y - 12, 7.5, 'F2', '1 1 1')
  txtR('Y (m / Lambert)', tableX + colW.p + colW.x + colW.y - 10, y - 12, 7.5, 'F2', '1 1 1')
  txt('Segment', tableX + colW.p + colW.x + colW.y + 10, y - 12, 7.5, 'F2', '1 1 1')
  txtR('Longueur (m)', tableX + tableW - 12, y - 12, 7.5, 'F2', '1 1 1')
  y -= 18

  const n = d.pts.length
  const maxRowsPage1 = Math.min(n, 18)
  for (let i = 0; i < maxRowsPage1; i++) {
    const p = d.pts[i]
    const nextIdx = (i + 1) % n
    const sideLen = d.sides[i]
    const rowBg = i % 2 === 0 ? '1 1 1' : '0.97 0.985 1'

    out.push(`${rowBg} rg ${tableX} ${(y - 15).toFixed(2)} ${tableW} 15 re f\n`)
    out.push(`${LINE} RG 0.5 w ${tableX} ${(y - 15).toFixed(2)} m ${(tableX + tableW).toFixed(2)} ${(y - 15).toFixed(2)} l S\n`)

    txt(`P${i + 1}`, tableX + 10, y - 10.5, 7.5, 'F2', BLUE_TEXT)
    txtR(frNum(p.x, 2), tableX + colW.p + colW.x - 10, y - 10.5, 7.5, 'F1', DARK)
    txtR(frNum(p.y, 2), tableX + colW.p + colW.x + colW.y - 10, y - 10.5, 7.5, 'F1', DARK)
    txt(`P${i + 1} -> P${nextIdx + 1}`, tableX + colW.p + colW.x + colW.y + 10, y - 10.5, 7.5, 'F1', GRAY)
    txtR(frNum(sideLen, 2) + ' m', tableX + tableW - 12, y - 10.5, 7.5, 'F2', DARK)
    y -= 15
  }

  if (n > maxRowsPage1) {
    txt(`... et ${n - maxRowsPage1} autres sommets (voir plan page 2)`, tableX + 10, y - 12, 7.2, 'F1', GRAY)
  }

  // Pied de page
  out.push(drawFooter(1, 2, dateStr, AP))

  return out.join('')
}

// ---------------------------------------------------------------------------
// PAGE 2 — Plan topographique (paysage A4)
// ---------------------------------------------------------------------------

interface Page2Opts {
  fill?: string
  titleText?: string
  subtitleText?: string
  background?: Pt[]
}

function buildPage2(d: PlanData, dateStr: string, opts: Page2Opts = {}): string {
  const out: string[] = []
  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = DARK): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }
  const txtR = (s: string, right: number, y: number, size: number, font = 'F1', color = DARK): void =>
    txt(s, right - textW(s, size, font === 'F2'), y, size, font, color)

  // En-tête pleine largeur paysage
  out.push(drawHeaderBanner(opts.titleText ?? 'PLAN TOPOGRAPHIQUE & GÉOMÉTRIQUE', opts.subtitleText ?? `${subj(d)} • EPSG:26191`, 'PLAN VECTEUR', AL, ALH))

  const n = d.pts.length
  const allPts = opts.background && opts.background.length ? [...d.pts, ...opts.background] : d.pts
  const xs = allPts.map((p) => p.x)
  const ys = allPts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const eX = maxX - minX
  const eY = maxY - minY
  const step = niceStep(Math.max(eX, eY), 5)
  const padX = Math.max(eX * 0.1, step * 0.6)
  const padY = Math.max(eY * 0.1, step * 0.6)
  const bx0 = minX - padX
  const by0 = minY - padY
  const bx1 = maxX + padX
  const by1 = maxY + padY

  // Cadre du plan
  const P_X0 = 36
  const P_X1 = 560
  const P_Y0 = 48
  const P_Y1 = 512
  const IP = 12
  const SCALE_BAND = 24
  const A_X0 = P_X0 + IP
  const A_X1 = P_X1 - IP
  const A_Y0 = P_Y0 + IP + SCALE_BAND
  const A_Y1 = P_Y1 - IP

  // Fond du cadre de dessin
  out.push(`0.995 0.998 1 rg ${P_X0} ${P_Y0} ${P_X1 - P_X0} ${P_Y1 - P_Y0} re f\n`)
  out.push(`${LINE} RG 1 w ${P_X0} ${P_Y0} ${P_X1 - P_X0} ${P_Y1 - P_Y0} re S\n`)

  const scale = Math.min((A_X1 - A_X0) / (bx1 - bx0), (A_Y1 - A_Y0) / (by1 - by0))
  const offX = (A_X1 - A_X0 - (bx1 - bx0) * scale) / 2
  const offY = (A_Y1 - A_Y0 - (by1 - by0) * scale) / 2
  const px = (x: number): number => A_X0 + offX + (x - bx0) * scale
  const py = (y: number): number => A_Y1 - (offY + (y - by0) * scale)
  const pCX = px((bx0 + bx1) / 2)
  const pCY = py((by0 + by1) / 2)

  // Grille métrique
  out.push(`${GRID} RG 0.4 w\n`)
  for (let gx = Math.ceil(bx0 / step) * step; gx <= bx1; gx += step) {
    out.push(`${px(gx).toFixed(2)} ${A_Y0.toFixed(2)} m ${px(gx).toFixed(2)} ${A_Y1.toFixed(2)} l S\n`)
  }
  for (let gy = Math.ceil(by0 / step) * step; gy <= by1; gy += step) {
    out.push(`${A_X0.toFixed(2)} ${py(gy).toFixed(2)} m ${A_X1.toFixed(2)} ${py(gy).toFixed(2)} l S\n`)
  }

  // Contour filigrane contexte
  if (opts.background && opts.background.length >= 3) {
    const bg = opts.background
      .map((p, i) => `${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)} ${i === 0 ? 'm' : 'l'}`)
      .join(' ') + ' h S\n'
    out.push(`${LINE} RG 0.8 w\n${bg}`)
  }

  // Polygone principal
  const pathCmd = d.pts
    .map((p, i) => `${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)} ${i === 0 ? 'm' : 'l'}`)
    .join(' ') + ' h\n'

  if (opts.fill) {
    out.push(`${opts.fill} rg\n${pathCmd} f\n`)
  } else {
    out.push(`0.92 0.96 1 rg\n${pathCmd} f\n`)
  }
  out.push(`${NAVY} RG 1.5 w\n${pathCmd} S\n`)

  // Marques des sommets
  out.push(`${BLUE_ACCENT} rg\n`)
  for (let i = 0; i < n; i++) {
    const p = d.pts[i]
    const cx = px(p.x)
    const cy = py(p.y)
    out.push(`${(cx - 2).toFixed(2)} ${(cy - 2).toFixed(2)} 4 4 re f\n`)
  }

  // Anti-collision des étiquettes (Sommets & Distances)
  const labels: LabelBox[] = []
  for (let i = 0; i < n; i++) {
    const p = d.pts[i]
    const cx = px(p.x)
    const cy = py(p.y)
    const dx = cx - pCX
    const dy = cy - pCY
    const l = Math.hypot(dx, dy) || 1
    const lx = cx + (dx / l) * 14
    const ly = cy + (dy / l) * 14
    const text = `P${i + 1}`
    const w = textW(text, 7.5, true) + 5
    labels.push({ x: lx - w / 2, y: ly - 4, w, h: 8, text, size: 7.5 })
  }

  for (let i = 0; i < n; i++) {
    const p = d.pts[i]
    const q = d.pts[(i + 1) % n]
    const ax = px(p.x)
    const ay = py(p.y)
    const bx = px(q.x)
    const by = py(q.y)
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    const vx = bx - ax
    const vy = by - ay
    const vl = Math.hypot(vx, vy) || 1
    const nx = -vy / vl
    const ny = vx / vl
    const side = (mx - pCX) * nx + (my - pCY) * ny < 0 ? -1 : 1
    const lx = mx + nx * side * 10
    const ly = my + ny * side * 10
    const text = formatM(d.sides[i])
    const w = textW(text, 7.5, true) + 6
    labels.push({ x: lx - w / 2, y: ly - 5, w, h: 10, text, size: 7.5 })
  }

  separateLabels(labels)

  for (const l of labels) {
    if (l.y < A_Y0 + 2) l.y = A_Y0 + 2
    if (l.y + l.h > A_Y1 - 2) l.y = A_Y1 - 2 - l.h
    if (l.x < A_X0 + 2) l.x = A_X0 + 2
    if (l.x + l.w > A_X1 - 2) l.x = A_X1 - 2 - l.w
  }

  for (const l of labels) {
    out.push(`1 1 1 rg ${l.x.toFixed(2)} ${l.y.toFixed(2)} ${l.w.toFixed(2)} ${l.h.toFixed(2)} re f\n`)
    out.push(`${LINE} RG 0.5 w ${l.x.toFixed(2)} ${l.y.toFixed(2)} ${l.w.toFixed(2)} ${l.h.toFixed(2)} re S\n`)
    txt(l.text, l.x + (l.w - textW(l.text, l.size, true)) / 2, l.y + (l.h - l.size) / 2 + 1, l.size, 'F2', DARK)
  }

  // Flèche Nord
  const nX = P_X1 - 24
  const nY = P_Y1 - 24
  out.push(`${NAVY} RG 1.2 w ${NAVY} rg\n`)
  out.push(`${nX.toFixed(2)} ${(nY - 16).toFixed(2)} m ${nX.toFixed(2)} ${(nY + 8).toFixed(2)} l S\n`)
  out.push(`${nX.toFixed(2)} ${(nY + 8).toFixed(2)} m ${(nX - 4).toFixed(2)} ${(nY - 2).toFixed(2)} l ${(nX + 4).toFixed(2)} ${(nY - 2).toFixed(2)} l h f\n`)
  txt('N', nX - 3, nY + 12, 8.5, 'F2', NAVY)

  // Échelle graphique
  const metersPerPt = (bx1 - bx0) / (A_X1 - A_X0)
  const barStep = niceStep(eX, 3)
  const segments = Math.max(1, Math.min(3, Math.floor((A_X1 - A_X0) / 2 / (barStep * metersPerPt))))
  const barW = segments * barStep * metersPerPt
  const barX = (A_X0 + A_X1) / 2 - barW / 2
  const barY = P_Y0 + IP + 4
  out.push(`${DARK} RG 1 w ${DARK} rg\n`)
  out.push(`${barX.toFixed(2)} ${barY.toFixed(2)} m ${(barX + barW).toFixed(2)} ${barY.toFixed(2)} l S\n`)
  for (let i = 0; i <= segments; i++) {
    const x = barX + i * barStep * metersPerPt
    out.push(`${x.toFixed(2)} ${barY.toFixed(2)} m ${x.toFixed(2)} ${(barY + 4).toFixed(2)} l S\n`)
    const tick = frNum(Math.round(i * barStep), 0)
    const tw = textW(tick, 6.5)
    txt(tick, x - tw / 2, barY + 8, 6.5)
  }
  txt('m', barX + barW + 4, barY + 8, 6.5)

  // Cartouche latéral droit
  const T_X0 = 574
  const T_W = AL - 36 - T_X0
  const T_Top = P_Y1

  out.push(drawRoundedRect(T_X0, P_Y0, T_W, P_Y1 - P_Y0, 6, BG_CARD, LINE, 0.8))

  // En-tête cartouche
  out.push(drawRoundedRect(T_X0, T_Top - 24, T_W, 24, 4, NAVY))
  txt('CARTOUCHE & COORDONNÉES', T_X0 + 10, T_Top - 16, 8, 'F2', '1 1 1')

  let cy = T_Top - 36
  txt('Terrain :', T_X0 + 10, cy, 7.5, 'F2', GRAY)
  txt(fitText(subj(d), 7.5, T_W - 60, true), T_X0 + 55, cy, 7.5, 'F2', DARK)
  cy -= 14
  txt('Surface :', T_X0 + 10, cy, 7.5, 'F2', GRAY)
  txt(formatA(d.area), T_X0 + 55, cy, 7.5, 'F2', BLUE_TEXT)
  cy -= 14
  txt('Périmètre :', T_X0 + 10, cy, 7.5, 'F2', GRAY)
  txt(formatM(d.perimeter), T_X0 + 55, cy, 7.5, 'F2', DARK)
  cy -= 18

  // Tableau coordonnées compact
  out.push(drawRoundedRect(T_X0 + 6, cy - 14, T_W - 12, 14, 2, '0.94 0.97 1.0'))
  txt('Point', T_X0 + 12, cy - 10, 6.8, 'F2', BLUE_TEXT)
  txtR('X (m)', T_X0 + 115, cy - 10, 6.8, 'F2', BLUE_TEXT)
  txtR('Y (m)', T_X0 + T_W - 14, cy - 10, 6.8, 'F2', BLUE_TEXT)
  cy -= 16

  const maxRowsCartouche = Math.floor((cy - P_Y0 - 10) / 12)
  for (let i = 0; i < Math.min(n, maxRowsCartouche); i++) {
    const p = d.pts[i]
    if (i % 2 === 1) {
      out.push(`0.96 0.97 0.99 rg ${(T_X0 + 6).toFixed(2)} ${(cy - 10).toFixed(2)} ${(T_W - 12).toFixed(2)} 11 re f\n`)
    }
    txt(`P${i + 1}`, T_X0 + 12, cy - 8, 6.8, 'F2', BLUE_TEXT)
    txtR(frNum(p.x, 2), T_X0 + 115, cy - 8, 6.8, 'F1', DARK)
    txtR(frNum(p.y, 2), T_X0 + T_W - 14, cy - 8, 6.8, 'F1', DARK)
    cy -= 12
  }

  // Pied de page
  out.push(drawFooter(2, 2, dateStr, AL))

  return out.join('')
}

// ---------------------------------------------------------------------------
// PAGE RÉCAPITULATIF DES AFFECTATIONS (paysage A4)
// ---------------------------------------------------------------------------

const AFF_SUMMARY_MAX_ROWS = 10

function buildAffSummaryPage(d: PlanData, pieces: AffectationPiece[], totalCount: number, dateStr: string, continuation: boolean): string {
  const out: string[] = []
  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = DARK): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }
  const txtR = (s: string, right: number, y: number, size: number, font = 'F1', color = DARK): void =>
    txt(s, right - textW(s, size, font === 'F2'), y, size, font, color)

  out.push(drawHeaderBanner(
    'PLAN DES AFFECTATIONS DU SOL & DÉCOUPAGE',
    continuation ? `${subj(d)} (Suite)` : subj(d),
    'AFFECTATIONS',
    AL,
    ALH
  ))

  let y = 505

  if (!continuation) {
    // 4 KPI Cards
    const domPiece = pieces.length > 0 ? pieces.slice().sort((a, b) => b.areaM2 - a.areaM2)[0] : null

    const kpis = [
      { label: 'SUPERFICIE DU TERRAIN', val: `${frNum(d.area, 0)} m²`, sub: d.area >= 10000 ? `${frNum(d.area / 10000, 2)} ha` : 'Superficie cadastrale', color: BG_BLUE, textColor: BLUE_TEXT },
      { label: 'PÉRIMÈTRE TOTAL', val: formatM(d.perimeter), sub: 'Périmètre extérieur', color: BG_CARD, textColor: NAVY },
      { label: "ZONES D'AFFECTATION", val: `${totalCount} affectation(s)`, sub: `${pieces.length} affichée(s) sur cette page`, color: BG_GREEN, textColor: GREEN_TEXT },
      { label: 'AFFECTATION DOMINANTE', val: domPiece ? fitText(domPiece.label, 9, 140, true) : 'Aucune', sub: domPiece ? `${domPiece.percent.toFixed(1)} % (${frNum(domPiece.areaM2, 0)} m²)` : 'Aucune zone', color: BG_AMBER, textColor: AMBER_TEXT },
    ]

    const kpiW = (AL - 72 - 3 * 10) / 4
    kpis.forEach((kpi, idx) => {
      const kx = 36 + idx * (kpiW + 10)
      out.push(drawRoundedRect(kx, y - 46, kpiW, 46, 6, kpi.color, LINE, 0.8))
      txt(kpi.label, kx + 8, y - 14, 6.2, 'F2', GRAY)
      txt(kpi.val, kx + 8, y - 28, 9.5, 'F2', kpi.textColor)
      txt(kpi.sub, kx + 8, y - 40, 5.8, 'F1', GRAY)
    })

    y -= 64
  }

  // Tableau des affectations
  out.push(`${BLUE_ACCENT} rg 36 ${y - 12} 3 14 re f\n`)
  txt('DÉTAIL DES AFFECTATIONS DU PLAN D\'AMÉNAGEMENT', 44, y - 10, 9.5, 'F2', DARK)
  y -= 22

  const tableX = 36
  const tableW = AL - 72
  const colW = { color: 30, label: 220, desig: 200, m2: 120, ha: 100, pct: tableW - 670 }

  // En-tête
  out.push(drawRoundedRect(tableX, y - 18, tableW, 18, 4, NAVY))
  txt('Zonage', tableX + 10, y - 12, 7.5, 'F2', '1 1 1')
  txt('Libellé / Affectation', tableX + colW.color + 10, y - 12, 7.5, 'F2', '1 1 1')
  txt('Désignation PA', tableX + colW.color + colW.label + 10, y - 12, 7.5, 'F2', '1 1 1')
  txtR('Superficie (m²)', tableX + colW.color + colW.label + colW.desig + colW.m2 - 10, y - 12, 7.5, 'F2', '1 1 1')
  txtR('Superficie (ha)', tableX + colW.color + colW.label + colW.desig + colW.m2 + colW.ha - 10, y - 12, 7.5, 'F2', '1 1 1')
  txtR('Part (%)', tableX + tableW - 12, y - 12, 7.5, 'F2', '1 1 1')
  y -= 18

  pieces.forEach((pc, i) => {
    const rowBg = i % 2 === 0 ? '1 1 1' : '0.97 0.985 1'
    out.push(`${rowBg} rg ${tableX} ${(y - 18).toFixed(2)} ${tableW} 18 re f\n`)
    out.push(`${LINE} RG 0.5 w ${tableX} ${(y - 18).toFixed(2)} m ${(tableX + tableW).toFixed(2)} ${(y - 18).toFixed(2)} l S\n`)

    // Pastille de couleur de zonage
    const chipX = tableX + 10
    const chipY = y - 14
    out.push(drawRoundedRect(chipX, chipY, 12, 10, 2, hexToRgb(pc.color), LINE, 0.6))

    txt(fitText(pc.label, 8, colW.label - 14, true), tableX + colW.color + 10, y - 12, 8, 'F2', DARK)
    txt(fitText(pc.designation || 'Non spécifiée', 7.5, colW.desig - 14), tableX + colW.color + colW.label + 10, y - 12, 7.5, 'F1', GRAY)
    txtR(`${frNum(pc.areaM2, 0)} m²`, tableX + colW.color + colW.label + colW.desig + colW.m2 - 10, y - 12, 7.8, 'F2', DARK)
    txtR(pc.areaM2 >= 10000 ? `${frNum(pc.areaM2 / 10000, 2)} ha` : '< 1 ha', tableX + colW.color + colW.label + colW.desig + colW.m2 + colW.ha - 10, y - 12, 7.5, 'F1', GRAY)
    txtR(`${pc.percent.toFixed(1)} %`, tableX + tableW - 12, y - 12, 8, 'F2', BLUE_TEXT)

    y -= 18
  })

  if (pieces.length === 0) {
    out.push(`1 1 1 rg ${tableX} ${(y - 24).toFixed(2)} ${tableW} 24 re f\n`)
    txt("Aucune affectation trouvée pour cette parcelle dans le plan d'aménagement.", tableX + 16, y - 16, 8, 'F1', '0.72 0.11 0.11')
    y -= 24
  }

  // Pied de page
  out.push(drawFooter(1, 1 + pieces.length, dateStr, AL))

  return out.join('')
}

// ---------------------------------------------------------------------------
// Assemblage générique du PDF (N pages A4, polices F1/F2 partagées)
// ---------------------------------------------------------------------------

interface PdfPage {
  width: number
  height: number
  content: string
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

function ascii(s: string): Uint8Array {
  return new Uint8Array(winAnsiBytes(s))
}

function assemblePdf(pages: PdfPage[]): Uint8Array {
  const n = pages.length
  const firstFont = 3 + n
  const firstStream = firstFont + 2
  const objects: Uint8Array[] = []
  objects.push(
    ascii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    ascii(
      `2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i} 0 R`).join(' ')}] /Count ${n} >>\nendobj\n`
    )
  )
  for (let i = 0; i < n; i++) {
    objects.push(
      ascii(
        `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pages[i].width} ${pages[i].height}] ` +
        `/Resources << /Font << /F1 ${firstFont} 0 R /F2 ${firstFont + 1} 0 R >> >> /Contents ${firstStream + i} 0 R >>\nendobj\n`
      )
    )
  }
  objects.push(
    ascii(`${firstFont} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`),
    ascii(`${firstFont + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`)
  )
  for (let i = 0; i < n; i++) {
    const content = ascii(pages[i].content)
    objects.push(
      concat([
        ascii(`${firstStream + i} 0 obj\n<< /Length ${content.length} >>\nstream\n`),
        content,
        ascii('\nendstream\nendobj\n'),
      ])
    )
  }

  const header = ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
  const offsets: number[] = []
  const body: Uint8Array[] = [header]
  let pos = header.length
  for (const o of objects) {
    offsets.push(pos)
    body.push(o)
    pos += o.length
  }
  let xref = ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`)
  for (const off of offsets) {
    xref = concat([xref, ascii(`${String(off).padStart(10, '0')} 00000 n \n`)])
  }
  const trailer = ascii(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`
  )
  return concat([...body, xref, trailer])
}

function buildPdf(d: PlanData): Uint8Array {
  const dateStr = formatDateFr(new Date())
  return assemblePdf([
    { width: AP, height: APH, content: buildPage1(d, dateStr) },
    { width: AL, height: ALH, content: buildPage2(d, dateStr) },
  ])
}

// Premier anneau externe d'une géométrie GeoJSON (Polygon / MultiPolygon)
function ringOf(geometry: unknown): number[][] | null {
  const g = geometry as { type?: string; coordinates?: unknown }
  if (!g || typeof g !== 'object') return null
  const coords = g.coordinates as unknown
  let raw: unknown = null
  if (g.type === 'Polygon' && Array.isArray(coords)) raw = (coords as unknown[])[0]
  else if (g.type === 'MultiPolygon' && Array.isArray(coords) && Array.isArray(coords[0])) {
    raw = (coords as unknown[][])[0][0]
  }
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) return null
  const ring: number[][] = []
  for (const pt of raw as number[][]) {
    const last = ring[ring.length - 1]
    if (!last || last[0] !== pt[0] || last[1] !== pt[1]) ring.push([pt[0], pt[1]])
  }
  if (ring.length > 1) {
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] === last[0] && first[1] === last[1]) ring.pop()
  }
  return ring.length >= 3 ? ring : null
}

function hexToRgb(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '0.5 0.55 0.62'
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`
}

export function buildAffectationsPdf(title: string, terrainRing: number[][], pieces: AffectationPiece[]): Uint8Array {
  const dateStr = formatDateFr(new Date())

  const terrainPts = terrainRing.map(([lng, lat]) => projectSahara(lat, lng))
  const terrainSides = terrainPts.map((p, i) => {
    const q = terrainPts[(i + 1) % terrainPts.length]
    return Math.hypot(q.x - p.x, q.y - p.y)
  })
  const terrain: PlanData = {
    title,
    pts: terrainPts,
    sides: terrainSides,
    perimeter: terrainSides.reduce((s, x) => s + x, 0),
    area: polygonArea(terrainPts),
  }

  const pages: PdfPage[] = []

  // Page 1 récapitulative
  if (pieces.length === 0) {
    pages.push({ width: AL, height: ALH, content: buildAffSummaryPage(terrain, [], 0, dateStr, false) })
  } else {
    for (let i = 0; i < pieces.length; i += AFF_SUMMARY_MAX_ROWS) {
      pages.push({
        width: AL,
        height: ALH,
        content: buildAffSummaryPage(terrain, pieces.slice(i, i + AFF_SUMMARY_MAX_ROWS), pieces.length, dateStr, i > 0),
      })
    }
  }

  // Pages suivantes pour chaque zone d'affectation
  for (let idx = 0; idx < pieces.length; idx++) {
    const pc = pieces[idx]
    const ring = ringOf(pc.feature.geometry)
    if (!ring || ring.length < 3) continue
    const pts = ring.map(([lng, lat]) => projectSahara(lat, lng))
    const sides = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length]
      return Math.hypot(q.x - p.x, q.y - p.y)
    })
    const d: PlanData = {
      title: pc.label,
      pts,
      sides,
      perimeter: sides.reduce((s, x) => s + x, 0),
      area: polygonArea(pts),
    }
    const subtitle = pc.designation
      ? `Affectation « ${pc.designation} » • ${formatA(d.area)} • ${pc.percent.toFixed(1)} % du terrain • EPSG:26191 (Lambert Sahara)`
      : `${formatA(d.area)} • ${pc.percent.toFixed(1)} % du terrain • EPSG:26191 (Lambert Sahara)`
    pages.push({
      width: AL,
      height: ALH,
      content: buildPage2(d, dateStr, {
        fill: hexToRgb(pc.color),
        titleText: fitText(`ZONAGE : ${pc.label}`, 11, 550, true),
        subtitleText: fitText(subtitle, 7.5, 650),
        background: terrainPts,
      }),
    })
  }

  return assemblePdf(pages)
}

function sanitizeFileName(s: string): string {
  const clean = s
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return clean || 'plan-terrain'
}

function downloadBytes(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadTerrainPdf(ring: number[][], title: string): void {
  const pts = ring.map(([lng, lat]) => projectSahara(lat, lng))
  const sides = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]
    return Math.hypot(q.x - p.x, q.y - p.y)
  })
  const perimeter = sides.reduce((s, x) => s + x, 0)
  const area = polygonArea(pts)
  downloadBytes(buildPdf({ title, pts, sides, perimeter, area }), `${sanitizeFileName(title)}-topographie.pdf`)
}

export function downloadAffectationsPdf(title: string, terrainRing: number[][], pieces: AffectationPiece[]): void {
  downloadBytes(buildAffectationsPdf(title, terrainRing, pieces), `${sanitizeFileName(title)}-affectations.pdf`)
}
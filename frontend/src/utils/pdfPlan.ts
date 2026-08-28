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
const BG_MAP = '0.995 0.998 1.0'
const BORDER = '0.88 0.91 0.94'

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

// Métriques Times-Roman
const TIMES_W: Record<number, number> = {
  32: 250, 33: 333, 34: 408, 35: 500, 36: 500, 37: 833, 38: 778, 39: 180,
  40: 333, 41: 333, 42: 500, 43: 564, 44: 250, 45: 333, 46: 250, 47: 278,
  48: 500, 49: 500, 50: 500, 51: 500, 52: 500, 53: 500, 54: 500, 55: 500, 56: 500, 57: 500,
  58: 278, 59: 278, 60: 564, 61: 564, 62: 564, 63: 444, 64: 921,
  65: 722, 66: 667, 67: 667, 68: 722, 69: 611, 70: 556, 71: 722, 72: 722, 73: 333,
  74: 389, 75: 722, 76: 611, 77: 889, 78: 722, 79: 722, 80: 556, 81: 722, 82: 667,
  83: 556, 84: 611, 85: 722, 86: 667, 87: 889, 88: 667, 89: 667, 90: 611,
  91: 333, 92: 278, 93: 333, 94: 469, 95: 500, 96: 333,
  97: 444, 98: 500, 99: 444, 100: 500, 101: 444, 102: 278, 103: 500, 104: 500,
  105: 278, 106: 278, 107: 444, 108: 278, 109: 778, 110: 500, 111: 500, 112: 500,
  113: 500, 114: 333, 115: 389, 116: 278, 117: 500, 118: 500, 119: 722, 120: 500,
  121: 500, 122: 444, 123: 400, 124: 275, 125: 400, 126: 541,
  0x96: 500, 0x97: 1000, 0x91: 250, 0x92: 250, 0x93: 450, 0x94: 450, 0x85: 1000,
  0xb2: 300, 0xb0: 400, 0xb7: 250,
}

// Métriques Times-Bold
const TIMES_BOLD_W: Record<number, number> = {
  32: 250, 33: 333, 34: 555, 35: 500, 36: 500, 37: 1000, 38: 833, 39: 278,
  40: 333, 41: 333, 42: 500, 43: 570, 44: 250, 45: 333, 46: 250, 47: 278,
  48: 500, 49: 500, 50: 500, 51: 500, 52: 500, 53: 500, 54: 500, 55: 500, 56: 500, 57: 500,
  58: 333, 59: 333, 60: 570, 61: 570, 62: 570, 63: 500, 64: 930,
  65: 722, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 778, 73: 389,
  74: 500, 75: 778, 76: 667, 77: 944, 78: 722, 79: 778, 80: 611, 81: 778, 82: 722,
  83: 556, 84: 667, 85: 722, 86: 722, 87: 1000, 88: 722, 89: 722, 90: 667,
  91: 333, 92: 278, 93: 333, 94: 581, 95: 500, 96: 333,
  97: 500, 98: 556, 99: 444, 100: 556, 101: 444, 102: 333, 103: 500, 104: 556,
  105: 278, 106: 333, 107: 556, 108: 278, 109: 833, 110: 556, 111: 500, 112: 556,
  113: 556, 114: 444, 115: 389, 116: 333, 117: 556, 118: 500, 119: 722, 120: 500,
  121: 500, 122: 444, 123: 394, 124: 220, 125: 394, 126: 520,
  0x96: 500, 0x97: 1000, 0x91: 300, 0x92: 300, 0x93: 555, 0x94: 555, 0x85: 1000,
  0xb2: 300, 0xb0: 400, 0xb7: 250,
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
  const table = bold ? TIMES_BOLD_W : TIMES_W
  const code = ch.codePointAt(0) ?? 0
  if (table[code] != null) return table[code]
  const byte = WIN_ANSI[ch]
  if (byte != null && table[byte] != null) return table[byte]
  const base = ACCENT_BASE[ch]
  if (base) {
    const baseCode = base.codePointAt(0) ?? 0
    if (table[baseCode] != null) return table[baseCode]
  }
  return 500
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
  const bannerH = 74
  const bannerY = height - bannerH

  out.push(`${NAVY} rg 0 ${bannerY.toFixed(2)} ${width.toFixed(2)} ${bannerH.toFixed(2)} re f\n`)
  out.push(`${BLUE_ACCENT} rg 0 ${(bannerY - 3).toFixed(2)} ${width.toFixed(2)} 3 re f\n`)

  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = '1 1 1'): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }

  txt('WEB-SIG FONCIER • SIGMATOP SARL', 36, bannerY + 52, 12, 'F2', '0.7 0.85 0.95')
  txt(title, 36, bannerY + 32, 16, 'F2', '1 1 1')
  txt(subtitle, 36, bannerY + 14, 12, 'F1', '0.85 0.92 0.98')

  if (badgeText) {
    const bw = textW(badgeText, 12, true) + 20
    const bx = width - 36 - bw
    const by = bannerY + 24
    out.push(drawRoundedRect(bx, by, bw, 24, 12, BLUE_ACCENT))
    txt(badgeText, bx + 10, by + 7, 12, 'F2', '1 1 1')
  }

  return out.join('')
}

function drawFooter(pageIdx: number, totalPages: number, dateStr: string, width = AP): string {
  const out: string[] = []
  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = GRAY): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }

  out.push(`${LINE} RG 0.8 w 36 36 m ${(width - 36).toFixed(2)} 36 l S\n`)
  txt(`WebSIG Foncier • Système d'Information Géographique • ${dateStr}`, 36, 20, 12, 'F1', GRAY)

  const rightText = `Page ${pageIdx} / ${totalPages}`
  const rw = textW(rightText, 12, true)
  txt(rightText, width - 36 - rw, 20, 12, 'F2', DARK)

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

  // 1. En-tête (Titre 1 : 16 pt)
  out.push(drawHeaderBanner('PLAN TOPOGRAPHIQUE & GÉOMÉTRIQUE', subj(d), 'TOPOGRAPHIE', AP, APH))

  // 2. Grille de 4 cartes KPI
  const kpis = [
    { label: 'SUPERFICIE', val: `${frNum(d.area, 0)} m²`, sub: d.area >= 10000 ? `${frNum(d.area / 10000, 2)} ha` : 'Superficie brute', color: BG_BLUE, textColor: BLUE_TEXT },
    { label: 'PÉRIMÈTRE', val: formatM(d.perimeter), sub: 'Longueur totale contour', color: BG_CARD, textColor: NAVY },
    { label: 'SOMMETS', val: `${d.pts.length}`, sub: 'Bornes géoréférencées', color: BG_GREEN, textColor: GREEN_TEXT },
    { label: 'SYSTÈME', val: 'EPSG:26191', sub: 'Merchich / Sahara', color: BG_CARD, textColor: DARK },
  ]

  const kpiW = (AP - 72 - 3 * 8) / 4
  const kpiY = 698
  kpis.forEach((kpi, idx) => {
    const kx = 36 + idx * (kpiW + 8)
    out.push(drawRoundedRect(kx, kpiY, kpiW, 54, 6, kpi.color, LINE, 0.8))
    txt(kpi.label, kx + 8, kpiY + 38, 12, 'F2', GRAY)
    txt(kpi.val, kx + 8, kpiY + 20, 14, 'F2', kpi.textColor)
    txt(kpi.sub, kx + 8, kpiY + 6, 12, 'F1', GRAY)
  })

  // 3. Fiche d'informations du terrain (Titre 2 : 14 pt, Texte : 12 pt interligne 1.5)
  let y = 672
  out.push(`${BLUE_ACCENT} rg 36 ${y - 12} 3 16 re f\n`)
  txt('INFORMATIONS GÉNÉRALES DU TERRAIN', 44, y - 10, 14, 'F2', DARK)
  y -= 24

  const infoRows = [
    { label: 'Identifiant / Nom de la parcelle :', val: subj(d) },
    { label: 'Système de coordonnées projetées :', val: 'EPSG:26191 (Merchich / Sahara - Lambert Conique Conforme)' },
    { label: 'Superficie cadastrale calculée :', val: formatA(d.area) },
    { label: 'Périmètre total du polygone :', val: formatM(d.perimeter) },
    { label: 'Date et heure du relevé :', val: dateStr },
  ]

  const infoCardH = infoRows.length * 24 + 10
  out.push(drawRoundedRect(36, y - infoCardH, AP - 72, infoCardH, 6, BG_CARD, LINE, 0.8))

  infoRows.forEach((row, i) => {
    const ry = y - 20 - i * 24
    if (i % 2 === 1) {
      out.push(`0.96 0.97 0.99 rg 37 ${(ry - 5).toFixed(2)} ${(AP - 74).toFixed(2)} 22 re f\n`)
    }
    txt(row.label, 48, ry, 12, 'F2', GRAY)
    txt(row.val, 240, ry, 12, 'F1', DARK)
  })

  y -= infoCardH + 20

  // 4. Tableau des coordonnées des sommets et des côtés (Titre 2 : 14 pt, Texte : 12 pt interligne 1.5)
  out.push(`${BLUE_ACCENT} rg 36 ${y - 12} 3 16 re f\n`)
  txt('TABLEAU DES SOMMETS & LONGUEURS DES CÔTÉS (EPSG:26191)', 44, y - 10, 14, 'F2', DARK)
  y -= 24

  const tableX = 36
  const tableW = AP - 72
  const colW = { p: 60, x: 120, y: 120, seg: 100, dist: tableW - 400 }

  // En-tête du tableau
  out.push(drawRoundedRect(tableX, y - 22, tableW, 22, 4, NAVY))
  txt('Sommet', tableX + 10, y - 15, 12, 'F2', '1 1 1')
  txtR('X (m)', tableX + colW.p + colW.x - 10, y - 15, 12, 'F2', '1 1 1')
  txtR('Y (m)', tableX + colW.p + colW.x + colW.y - 10, y - 15, 12, 'F2', '1 1 1')
  txt('Segment', tableX + colW.p + colW.x + colW.y + 10, y - 15, 12, 'F2', '1 1 1')
  txtR('Longueur (m)', tableX + tableW - 12, y - 15, 12, 'F2', '1 1 1')
  y -= 22

  const n = d.pts.length
  const maxRowsPage1 = Math.min(n, 12)
  for (let i = 0; i < maxRowsPage1; i++) {
    const p = d.pts[i]
    const nextIdx = (i + 1) % n
    const sideLen = d.sides[i]
    const rowBg = i % 2 === 0 ? '1 1 1' : '0.97 0.985 1'

    out.push(`${rowBg} rg ${tableX} ${(y - 20).toFixed(2)} ${tableW} 20 re f\n`)
    out.push(`${LINE} RG 0.5 w ${tableX} ${(y - 20).toFixed(2)} m ${(tableX + tableW).toFixed(2)} ${(y - 20).toFixed(2)} l S\n`)

    txt(`P${i + 1}`, tableX + 10, y - 14, 12, 'F2', BLUE_TEXT)
    txtR(frNum(p.x, 2), tableX + colW.p + colW.x - 10, y - 14, 12, 'F1', DARK)
    txtR(frNum(p.y, 2), tableX + colW.p + colW.x + colW.y - 10, y - 14, 12, 'F1', DARK)
    txt(`P${i + 1} -> P${nextIdx + 1}`, tableX + colW.p + colW.x + colW.y + 10, y - 14, 12, 'F1', GRAY)
    txtR(frNum(sideLen, 2) + ' m', tableX + tableW - 12, y - 14, 12, 'F2', DARK)
    y -= 20
  }

  if (n > maxRowsPage1) {
    txt(`... et ${n - maxRowsPage1} autres sommets (voir plan page 2)`, tableX + 10, y - 14, 12, 'F1', GRAY)
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

  // En-tête pleine largeur paysage (Titre 1 : 16 pt)
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
  const bw = eX + 2 * padX
  const bh = eY + 2 * padY

  // Zone graphique
  const gX = 36
  const gY = 56
  const gW = AL - 72
  const gH = ALH - 74 - 56 - 16

  const scale = Math.min(gW / bw, gH / bh)
  const ox = gX + (gW - bw * scale) / 2
  const oy = gY + (gH - bh * scale) / 2
  const mapX = (x: number): number => ox + (x - bx0) * scale
  const mapY = (y: number): number => oy + (y - by0) * scale

  // Cadre de la zone de dessin
  out.push(`${BG_MAP} rg ${gX} ${gY} ${gW} ${gH} re f\n`)
  out.push(`${BORDER} RG 1 w ${gX} ${gY} ${gW} ${gH} re S\n`)

  // Grille carroyage
  const firstGridX = Math.ceil(bx0 / step) * step
  const lastGridX = Math.floor((bx0 + bw) / step) * step
  const firstGridY = Math.ceil(by0 / step) * step
  const lastGridY = Math.floor((by0 + bh) / step) * step

  for (let gx = firstGridX; gx <= lastGridX; gx += step) {
    const x = mapX(gx)
    if (x >= gX && x <= gX + gW) {
      out.push(`0.86 0.90 0.95 RG 0.5 w [2 3] 0 d ${x.toFixed(2)} ${gY} m ${x.toFixed(2)} ${(gY + gH).toFixed(2)} l S [] 0 d\n`)
      txt(`${Math.round(gx)}`, x + 2, gY + 3, 12, 'F1', GRAY)
    }
  }
  for (let gy = firstGridY; gy <= lastGridY; gy += step) {
    const y = mapY(gy)
    if (y >= gY && y <= gY + gH) {
      out.push(`0.86 0.90 0.95 RG 0.5 w [2 3] 0 d ${gX} ${y.toFixed(2)} m ${(gX + gW).toFixed(2)} ${y.toFixed(2)} l S [] 0 d\n`)
      txt(`${Math.round(gy)}`, gX + 3, y + 2, 12, 'F1', GRAY)
    }
  }

  // Fond polygonal secondaire
  if (opts.background && opts.background.length >= 3) {
    const bgMapped = opts.background.map((p) => ({ x: mapX(p.x), y: mapY(p.y) }))
    out.push('0.93 0.94 0.96 rg 0.7 0.75 0.82 RG 1 w [3 3] 0 d ')
    out.push(`${bgMapped[0].x.toFixed(2)} ${bgMapped[0].y.toFixed(2)} m `)
    for (let i = 1; i < bgMapped.length; i++) {
      out.push(`${bgMapped[i].x.toFixed(2)} ${bgMapped[i].y.toFixed(2)} l `)
    }
    out.push('h B [] 0 d\n')
  }

  // Polygone principal
  const mapped = d.pts.map((p) => ({ x: mapX(p.x), y: mapY(p.y) }))
  const fill = opts.fill ?? '0.88 0.93 0.99'
  out.push(`${fill} rg ${NAVY} RG 2 w `)
  out.push(`${mapped[0].x.toFixed(2)} ${mapped[0].y.toFixed(2)} m `)
  for (let i = 1; i < mapped.length; i++) {
    out.push(`${mapped[i].x.toFixed(2)} ${mapped[i].y.toFixed(2)} l `)
  }
  out.push('h B\n')

  // Sommets (pastilles numérotées)
  const labels: LabelBox[] = []
  mapped.forEach((pt, i) => {
    const tag = `P${i + 1}`
    const tw = textW(tag, 12, true)
    labels.push({ x: pt.x + 6, y: pt.y + 6, w: tw + 6, h: 14, text: tag, size: 12 })
  })

  // Longueurs de côtés
  for (let i = 0; i < n; i++) {
    const p1 = mapped[i]
    const p2 = mapped[(i + 1) % n]
    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    const tag = `${frNum(d.sides[i], 1)} m`
    const tw = textW(tag, 12, true)
    labels.push({ x: mx - tw / 2, y: my - 6, w: tw + 6, h: 14, text: tag, size: 12 })
  }

  separateLabels(labels, 40)

  // Dessin des pastilles de sommets
  mapped.forEach((pt) => {
    out.push(`1 1 1 rg ${NAVY} RG 1.5 w `)
    out.push(`${(pt.x + 3.5).toFixed(2)} ${pt.y.toFixed(2)} m `)
    out.push(`${(pt.x + 3.5).toFixed(2)} ${(pt.y + 1.93).toFixed(2)} ${(pt.x + 1.93).toFixed(2)} ${(pt.y + 3.5).toFixed(2)} ${pt.x.toFixed(2)} ${(pt.y + 3.5).toFixed(2)} c `)
    out.push(`${(pt.x - 1.93).toFixed(2)} ${(pt.y + 3.5).toFixed(2)} ${(pt.x - 3.5).toFixed(2)} ${(pt.y + 1.93).toFixed(2)} ${(pt.x - 3.5).toFixed(2)} ${pt.y.toFixed(2)} c `)
    out.push(`${(pt.x - 3.5).toFixed(2)} ${(pt.y - 1.93).toFixed(2)} ${(pt.x - 1.93).toFixed(2)} ${(pt.y - 3.5).toFixed(2)} ${pt.x.toFixed(2)} ${(pt.y - 3.5).toFixed(2)} c `)
    out.push(`${(pt.x + 1.93).toFixed(2)} ${(pt.y - 3.5).toFixed(2)} ${(pt.x + 3.5).toFixed(2)} ${(pt.y - 1.93).toFixed(2)} ${(pt.x + 3.5).toFixed(2)} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)} c B\n`)
  })

  // Dessin des étiquettes
  labels.forEach((lbl) => {
    out.push(drawRoundedRect(lbl.x, lbl.y, lbl.w, lbl.h, 2, '1 1 1', LINE, 0.5))
    txt(lbl.text, lbl.x + 3, lbl.y + 3, lbl.size, 'F2', DARK)
  })

  // Cartouche en bas à droite
  const cartW = 240
  const cartH = 74
  const cartX = gX + gW - cartW - 12
  const cartY = gY + 12
  out.push(drawRoundedRect(cartX, cartY, cartW, cartH, 6, '1 1 1', NAVY, 1.2))
  out.push(`${NAVY} rg ${cartX} ${(cartY + cartH - 22).toFixed(2)} ${cartW} 22 re f\n`)
  txt('CARTOUCHE DU PLAN', cartX + 10, cartY + cartH - 16, 12, 'F2', '1 1 1')
  txt(`Échelle indicative : 1 / ${Math.round(1000 / scale)}`, cartX + 10, cartY + 36, 12, 'F1', DARK)
  txt(`Superficie totale : ${formatA(d.area)}`, cartX + 10, cartY + 20, 12, 'F2', DARK)
  txt(`Périmètre : ${formatM(d.perimeter)}`, cartX + 10, cartY + 6, 12, 'F1', GRAY)

  // Pied de page
  out.push(drawFooter(2, 2, dateStr, AL))

  return out.join('')
}

// ---------------------------------------------------------------------------
// PAGE RÉCAPITULATIF DES AFFECTATIONS (paysage A4)
// ---------------------------------------------------------------------------

const AFF_SUMMARY_MAX_ROWS = 10

function buildAffSummaryPage(
  d: PlanData,
  pieces: AffectationPiece[],
  totalCount: number,
  dateStr: string,
  _isMultiPage: boolean
): string {
  const out: string[] = []
  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = DARK): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }
  const txtR = (s: string, right: number, y: number, size: number, font = 'F1', color = DARK): void =>
    txt(s, right - textW(s, size, font === 'F2'), y, size, font, color)

  // En-tête (Titre 1 : 16 pt)
  out.push(drawHeaderBanner("PLAN D'AMÉNAGEMENT & ZONAGE URBAIN", subj(d), 'RÉCAPITULATIF', AL, ALH))

  let y = ALH - 74 - 20

  // 4 Cartes KPI (Titre 2 : 14 pt pour les valeurs)
  if (pieces.length > 0) {
    const domPiece = pieces.length > 0 ? pieces.slice().sort((a, b) => b.areaM2 - a.areaM2)[0] : null

    const kpis = [
      { label: 'SUPERFICIE DU TERRAIN', val: `${frNum(d.area, 0)} m²`, sub: d.area >= 10000 ? `${frNum(d.area / 10000, 2)} ha` : 'Superficie cadastrale', color: BG_BLUE, textColor: BLUE_TEXT },
      { label: 'PÉRIMÈTRE TOTAL', val: formatM(d.perimeter), sub: 'Périmètre extérieur', color: BG_CARD, textColor: NAVY },
      { label: "ZONES D'AFFECTATION", val: `${totalCount} affectation(s)`, sub: `${pieces.length} affichée(s) sur cette page`, color: BG_GREEN, textColor: GREEN_TEXT },
      { label: 'AFFECTATION DOMINANTE', val: domPiece ? fitText(domPiece.label, 12, 140, true) : 'Aucune', sub: domPiece ? `${domPiece.percent.toFixed(1)} % (${frNum(domPiece.areaM2, 0)} m²)` : 'Aucune zone', color: BG_AMBER, textColor: AMBER_TEXT },
    ]

    const kpiW = (AL - 72 - 3 * 10) / 4
    kpis.forEach((kpi, idx) => {
      const kx = 36 + idx * (kpiW + 10)
      out.push(drawRoundedRect(kx, y - 54, kpiW, 54, 6, kpi.color, LINE, 0.8))
      txt(kpi.label, kx + 8, y - 18, 12, 'F2', GRAY)
      txt(kpi.val, kx + 8, y - 36, 14, 'F2', kpi.textColor)
      txt(kpi.sub, kx + 8, y - 50, 12, 'F1', GRAY)
    })

    y -= 72
  }

  // Tableau des affectations (Titre 2 : 14 pt, Texte : 12 pt interligne 1.5)
  out.push(`${BLUE_ACCENT} rg 36 ${y - 12} 3 16 re f\n`)
  txt('DÉTAIL DES AFFECTATIONS DU PLAN D\'AMÉNAGEMENT', 44, y - 10, 14, 'F2', DARK)
  y -= 26

  const tableX = 36
  const tableW = AL - 72
  const colW = { color: 30, label: 220, desig: 200, m2: 120, ha: 100, pct: tableW - 670 }

  // En-tête
  out.push(drawRoundedRect(tableX, y - 24, tableW, 24, 4, NAVY))
  txt('Zonage', tableX + 10, y - 16, 12, 'F2', '1 1 1')
  txt('Libellé / Affectation', tableX + colW.color + 10, y - 16, 12, 'F2', '1 1 1')
  txt('Désignation PA', tableX + colW.color + colW.label + 10, y - 16, 12, 'F2', '1 1 1')
  txtR('Superficie (m²)', tableX + colW.color + colW.label + colW.desig + colW.m2 - 10, y - 16, 12, 'F2', '1 1 1')
  txtR('Superficie (ha)', tableX + colW.color + colW.label + colW.desig + colW.m2 + colW.ha - 10, y - 16, 12, 'F2', '1 1 1')
  txtR('Part (%)', tableX + tableW - 12, y - 16, 12, 'F2', '1 1 1')
  y -= 24

  pieces.forEach((pc, i) => {
    const rowBg = i % 2 === 0 ? '1 1 1' : '0.97 0.985 1'
    out.push(`${rowBg} rg ${tableX} ${(y - 24).toFixed(2)} ${tableW} 24 re f\n`)
    out.push(`${LINE} RG 0.5 w ${tableX} ${(y - 24).toFixed(2)} m ${(tableX + tableW).toFixed(2)} ${(y - 24).toFixed(2)} l S\n`)

    // Pastille de couleur de zonage
    const chipX = tableX + 10
    const chipY = y - 18
    out.push(drawRoundedRect(chipX, chipY, 14, 12, 2, hexToRgb(pc.color), LINE, 0.6))

    txt(fitText(pc.label, 12, colW.label - 14, true), tableX + colW.color + 10, y - 16, 12, 'F2', DARK)
    txt(fitText(pc.designation || 'Non spécifiée', 12, colW.desig - 14), tableX + colW.color + colW.label + 10, y - 16, 12, 'F1', GRAY)
    txtR(`${frNum(pc.areaM2, 0)} m²`, tableX + colW.color + colW.label + colW.desig + colW.m2 - 10, y - 16, 12, 'F2', DARK)
    txtR(pc.areaM2 >= 10000 ? `${frNum(pc.areaM2 / 10000, 2)} ha` : '< 1 ha', tableX + colW.color + colW.label + colW.desig + colW.m2 + colW.ha - 10, y - 16, 12, 'F1', GRAY)
    txtR(`${pc.percent.toFixed(1)} %`, tableX + tableW - 12, y - 16, 12, 'F2', BLUE_TEXT)

    y -= 24
  })

  if (pieces.length === 0) {
    out.push(`1 1 1 rg ${tableX} ${(y - 28).toFixed(2)} ${tableW} 28 re f\n`)
    txt("Aucune affectation trouvée pour cette parcelle dans le plan d'aménagement.", tableX + 16, y - 18, 12, 'F1', '0.72 0.11 0.11')
    y -= 28
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
    ascii(`${firstFont} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>\nendobj\n`),
    ascii(`${firstFont + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`)
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
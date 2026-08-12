// Génération d'un plan topographique PDF d'une parcelle cadastrale en EPSG:26191
// (Merchich / Sahara — Lambert Conique Conforme, unité : mètre).
// Aucune dépendance externe : projection implémentée + PDF minimal écrit à la main.
// Structure : page 1 portrait = fiche d'identité du terrain, page 2 paysage = plan topographique.

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

// ---------------------------------------------------------------------------
// Outils communs
// ---------------------------------------------------------------------------

const AP = 595.28 // A4 portrait
const APH = 841.89
const AL = 841.89 // A4 paysage
const ALH = 595.28

const NAVY = '0.11 0.23 0.43'
const DARK = '0.07 0.15 0.28'
const GRAY = '0.5 0.55 0.62'
const LINE = '0.82 0.87 0.95'
const GRID = '0.92 0.94 0.96'

function niceStep(range: number, targetSegments: number): number {
  const raw = range / targetSegments
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / pow
  const nice = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10
  return nice * pow
}

function textW(s: string, size: number): number {
  let u = 0
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c === 32) u += 278
    else if (c >= 48 && c <= 57) u += 556
    else if (c >= 65 && c <= 90) u += 667
    else if (c >= 97 && c <= 122) u += 500
    else u += 556
  }
  return (u * size) / 1000
}

function wrap(s: string, size: number, maxW: number): string[] {
  const words = s.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (textW(test, size) <= maxW) cur = test
    else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
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
  if (!Number.isFinite(d)) return '—'
  if (d >= 10000) return `${frNum(d / 1000, 1)} km`
  return `${frNum(d, d >= 100 ? 0 : 1)} m`
}

function formatA(m2: number): string {
  if (!Number.isFinite(m2)) return '—'
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

// ---------------------------------------------------------------------------
// PAGE 1 — Fiche d'identité du terrain (portrait A4)
// ---------------------------------------------------------------------------

function buildPage1(d: PlanData, dateStr: string): string {
  const out: string[] = []
  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = NAVY): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }

  // ── Titre ──
  txt('PLAN TOPOGRAPHIQUE', 60, 790, 24, 'F2')
  txt(subj(d), 60, 762, 14, 'F2')
  out.push(`${NAVY} RG 1.2 w 60 742 m 300 742 l S\n`)

  // ── Bloc d'informations ──
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Système de coordonnées', value: 'EPSG:26191 — Merchich / Sahara (Lambert Conique Conforme) — Unité : mètre' },
    { label: 'Surface', value: formatA(d.area) },
    { label: 'Périmètre', value: formatM(d.perimeter) },
    { label: 'Nombre de côtés', value: `${d.pts.length}` },
    { label: 'Date de génération', value: dateStr },
  ]
  const labelX = 82
  const valX = 270
  const valW = 535.28 - 82 - 30
  const lines = rows.map((r) => ({ label: r.label, text: wrap(r.value, 9, valW) }))
  let y = 678
  const positions: Array<{ label: string; text: string[]; y: number }> = []
  for (const r of lines) {
    positions.push({ label: r.label, text: r.text, y })
    y -= r.text.length * 13 + 14
  }
  const cardBottom = y + 6
  const cardTop = 706

  out.push(`0.985 0.99 1 rg 60 ${cardBottom.toFixed(2)} 475.28 ${(cardTop - cardBottom).toFixed(2)} re f\n`)
  out.push(`${LINE} RG 0.9 w 60 ${cardBottom.toFixed(2)} 475.28 ${(cardTop - cardBottom).toFixed(2)} re S\n`)
  txt('INFORMATIONS GÉNÉRALES', labelX, cardTop - 22, 10, 'F2')
  for (const p of positions) {
    txt(p.label, labelX, p.y, 9, 'F2', '0.4 0.45 0.55')
    p.text.forEach((line, i) => txt(line, valX, p.y - i * 13, 9))
  }

  // ── Pied de page ──
  txt(`Généré le ${dateStr}`, 60, 40, 7.5, 'F1', GRAY)
  const footR = 'Système EPSG:26191 (Merchich / Sahara) — Coordonnées Lambert en mètres'
  txt(footR, AP - 60 - textW(footR, 7.5), 40, 7.5, 'F1', GRAY)

  return out.join('')
}

// ---------------------------------------------------------------------------
// PAGE 2 — Plan topographique (paysage A4)
// ---------------------------------------------------------------------------

function buildPage2(d: PlanData, dateStr: string): string {
  const out: string[] = []
  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = NAVY): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }
  const txtR = (s: string, right: number, y: number, size: number, font = 'F1', color = NAVY): void =>
    txt(s, right - textW(s, size), y, size, font, color)

  const n = d.pts.length
  const xs = d.pts.map((p) => p.x)
  const ys = d.pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const eX = maxX - minX
  const eY = maxY - minY
  const step = niceStep(Math.max(eX, eY), 5)
  const padX = Math.max(eX * 0.08, step * 0.5)
  const padY = Math.max(eY * 0.08, step * 0.5)
  const bx0 = minX - padX
  const by0 = minY - padY
  const bx1 = maxX + padX
  const by1 = maxY + padY

  // ── Cadre du plan ──
  const P_X0 = 30
  const P_X1 = 540
  const P_Y0 = 50
  const P_Y1 = 545
  const IP = 14
  const A_X0 = P_X0 + IP
  const A_X1 = P_X1 - IP
  const A_Y0 = P_Y0 + IP
  const A_Y1 = P_Y1 - IP

  // ── Titre du plan ──
  txt(subj(d), P_X0 + 4, P_Y1 + 22, 11, 'F2')
  txt('Plan topographique — EPSG:26191 (Lambert Conique Conforme, unité : mètre)', P_X0 + 4, P_Y1 + 8, 7.5, 'F1', GRAY)

  const scale = Math.min((A_X1 - A_X0) / (bx1 - bx0), (A_Y1 - A_Y0) / (by1 - by0))
  const offX = (A_X1 - A_X0 - (bx1 - bx0) * scale) / 2
  const offY = (A_Y1 - A_Y0 - (by1 - by0) * scale) / 2
  const px = (x: number): number => A_X0 + offX + (x - bx0) * scale
  const py = (y: number): number => A_Y1 - (offY + (y - by0) * scale)
  const pCX = px((bx0 + bx1) / 2)
  const pCY = py((by0 + by1) / 2)

  // ── Grille légère ──
  out.push(`${GRID} RG 0.4 w\n`)
  for (let x = Math.ceil(bx0 / step) * step; x <= bx1; x += step) {
    out.push(`${px(x).toFixed(2)} ${A_Y0.toFixed(2)} m ${px(x).toFixed(2)} ${A_Y1.toFixed(2)} l S\n`)
  }
  for (let y = Math.ceil(by0 / step) * step; y <= by1; y += step) {
    out.push(`${A_X0.toFixed(2)} ${py(y).toFixed(2)} m ${A_X1.toFixed(2)} ${py(y).toFixed(2)} l S\n`)
  }

  // ── Cadre ──
  out.push(`${DARK} RG 1.3 w 30 50 510 495 re S\n`)

  // ── Polygone (contour seul, sans remplissage) ──
  out.push(`${DARK} RG 1.5 w\n`)
  out.push(
    d.pts
      .map((p, i) => `${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)} ${i === 0 ? 'm' : 'l'}`)
      .join(' ') + ' h S\n'
  )

  // ── Coins P1..Pn (marque + étiquette décalée vers l'extérieur) ──
  out.push(`${DARK} rg\n`)
  for (let i = 0; i < n; i++) {
    const p = d.pts[i]
    const cx = px(p.x)
    const cy = py(p.y)
    out.push(`${(cx - 1.8).toFixed(2)} ${(cy - 1.8).toFixed(2)} 3.6 3.6 re f\n`)
    const dx = cx - pCX
    const dy = cy - pCY
    const l = Math.hypot(dx, dy) || 1
    const lx = cx + (dx / l) * 13
    const ly = cy + (dy / l) * 13
    const label = `P${i + 1}`
    const w = textW(label, 7.5) + 5
    out.push(`1 1 1 rg ${(lx - w / 2).toFixed(2)} ${(ly - 4).toFixed(2)} ${w.toFixed(2)} 8 re f\n`)
    txt(label, lx - w / 2 + 2.5, ly - 0.5, 7.5, 'F2', DARK)
  }

  // ── Longueurs des côtés (décalage perpendiculaire, côté extérieur) ──
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
    const lx = mx + nx * side * 9
    const ly = my + ny * side * 9
    const label = formatM(d.sides[i])
    const w = textW(label, 8) + 6
    out.push(`1 1 1 rg ${(lx - w / 2).toFixed(2)} ${(ly - 5).toFixed(2)} ${w.toFixed(2)} 10 re f\n`)
    txt(label, lx - w / 2 + 3, ly - 0.5, 8, 'F2', DARK)
  }

  // ── Flèche nord (coin haut droit, hors emprise) ──
  const nX = P_X1 - 26
  const nY = P_Y1 - 26
  out.push(`${DARK} RG 1.2 w ${DARK} rg\n`)
  out.push(`${nX.toFixed(2)} ${(nY - 18).toFixed(2)} m ${nX.toFixed(2)} ${(nY + 8).toFixed(2)} l S\n`)
  out.push(
    `${nX.toFixed(2)} ${(nY + 8).toFixed(2)} m ${(nX - 5).toFixed(2)} ${(nY - 2).toFixed(2)} l ${(nX + 5).toFixed(2)} ${(nY - 2).toFixed(2)} l h f\n`
  )
  txt('N', nX - 3, nY + 14, 9, 'F2')

  // ── Échelle graphique (barre en bas du plan) ──
  const metersPerPt = (bx1 - bx0) / (A_X1 - A_X0)
  const barStep = niceStep(eX, 3)
  const segments = Math.max(1, Math.min(3, Math.floor((A_X1 - A_X0) / 2 / (barStep * metersPerPt))))
  const barW = segments * barStep * metersPerPt
  const barX = (A_X0 + A_X1) / 2 - barW / 2
  const barY = P_Y0 + 22
  out.push(`${DARK} RG 1 w ${DARK} rg\n`)
  out.push(`${barX.toFixed(2)} ${barY.toFixed(2)} m ${(barX + barW).toFixed(2)} ${barY.toFixed(2)} l S\n`)
  for (let i = 0; i <= segments; i++) {
    const x = barX + i * barStep * metersPerPt
    out.push(`${x.toFixed(2)} ${barY.toFixed(2)} m ${x.toFixed(2)} ${(barY + 5).toFixed(2)} l S\n`)
    const tick = frNum(Math.round(i * barStep), 0)
    const tw = textW(tick, 7)
    txt(tick, x - tw / 2, barY + 10, 7)
  }
  txt('m', barX + barW + 4, barY + 10, 7)

  // ── Encart TABLEAU DES COORDONNÉES (cadre séparé, à droite) ──
  const T_X0 = 566
  const T_X1 = AL - 30
  const T_W = T_X1 - T_X0
  const tPadTop = 14
  const tTitleH = 16
  const tColH = 14
  const tRowH = 12
  const tPadBottom = 10
  const tH = tPadTop + tTitleH + tColH + n * tRowH + tPadBottom
  const T_Top = P_Y1
  const T_Bottom = T_Top - tH

  out.push(`0.985 0.99 1 rg ${T_X0.toFixed(2)} ${T_Bottom.toFixed(2)} ${T_W.toFixed(2)} ${tH.toFixed(2)} re f\n`)
  out.push(`${NAVY} RG 0.9 w ${T_X0.toFixed(2)} ${T_Bottom.toFixed(2)} ${T_W.toFixed(2)} ${tH.toFixed(2)} re S\n`)
  txt('TABLEAU DES COORDONNÉES', T_X0 + 14, T_Top - tPadTop - 4, 8.5, 'F2')

  const colP = 40
  const colX = 72
  const colY = 72
  const gx0 = T_X0 + 14
  const yh = T_Top - tPadTop - tTitleH - 4
  txt('Coin', gx0, yh, 8, 'F2')
  txtR('X (m)', gx0 + colP + colX, yh, 8, 'F2')
  txtR('Y (m)', gx0 + colP + colX + colY, yh, 8, 'F2')
  const hlY = yh - 5.5
  out.push(`${LINE} RG 0.8 w ${gx0.toFixed(2)} ${hlY.toFixed(2)} m ${(gx0 + colP + colX + colY).toFixed(2)} ${hlY.toFixed(2)} l S\n`)

  for (let i = 0; i < n; i++) {
    const ry = yh - 5.5 - (i + 1) * tRowH
    txt(`P${i + 1}`, gx0, ry, 8, 'F2', DARK)
    txtR(frNum(d.pts[i].x, 2), gx0 + colP + colX, ry, 8)
    txtR(frNum(d.pts[i].y, 2), gx0 + colP + colX + colY, ry, 8)
  }

  // ── Pied de page ──
  txt(`Généré le ${dateStr}`, P_X0, 30, 7.5, 'F1', GRAY)
  const footR = 'Système EPSG:26191 (Merchich / Sahara) — Coordonnées Lambert en mètres'
  txt(footR, AL - 30 - textW(footR, 7.5), 30, 7.5, 'F1', GRAY)

  return out.join('')
}

// ---------------------------------------------------------------------------
// Assemblage du PDF (2 pages)
// ---------------------------------------------------------------------------

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

function buildPdf(d: PlanData): Uint8Array {
  const dateStr = formatDateFr(new Date())
  const content1 = ascii(buildPage1(d, dateStr))
  const content2 = ascii(buildPage2(d, dateStr))
  const objects: Uint8Array[] = []
  objects.push(
    ascii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    ascii('2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n'),
    ascii(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + AP + ' ' + APH + '] ' +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>\nendobj\n'
    ),
    ascii(
      '4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + AL + ' ' + ALH + '] ' +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 8 0 R >>\nendobj\n'
    ),
    ascii('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'),
    ascii('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'),
    concat([
      ascii('7 0 obj\n<< /Length ' + content1.length + ' >>\nstream\n'),
      content1,
      ascii('\nendstream\nendobj\n'),
    ]),
    concat([
      ascii('8 0 obj\n<< /Length ' + content2.length + ' >>\nstream\n'),
      content2,
      ascii('\nendstream\nendobj\n'),
    ]),
  )

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

function sanitizeFileName(s: string): string {
  const clean = s
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return clean || 'plan-terrain'
}

export function downloadTerrainPdf(ring: number[][], title: string): void {
  const pts = ring.map(([lng, lat]) => projectSahara(lat, lng))
  const sides = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]
    return Math.hypot(q.x - p.x, q.y - p.y)
  })
  const perimeter = sides.reduce((s, x) => s + x, 0)
  const area = polygonArea(pts)
  const pdf = buildPdf({ title, pts, sides, perimeter, area })
  const blob = new Blob([pdf as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFileName(title)}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

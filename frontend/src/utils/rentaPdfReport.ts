// Générateur de rapport PDF professionnel vectoriel pour l'étude de rentabilité financière et foncière.
// Génère un fichier PDF natif téléchargeable directement (textes sélectionnables et copiables,
// tables vectorielles, métriques financières, et capture satellite OSM / ESRI avec le contour du terrain).

import type { Rentabilite } from '../api/projets'

export interface RentaReportData {
  projectName?: string
  terrainNom: string
  reference?: string
  commune?: string
  superficie?: number
  polygonCoords?: number[][] // [lng, lat][]
  lat?: number
  lng?: number
  rentaResult: Rentabilite
  rentaForm: {
    prixFoncierM2?: string
    fraisAcquisition?: string
    tauxChute?: string
    cos?: string
    cus?: string
    tauxEtudes?: string
    tauxImprevus?: string
    tauxCommercialisation?: string
    tauxActualisation?: string
    dureeConstruction?: string
    dureeCommercialisation?: string
    hasAppartement?: boolean
    hasCommerce?: boolean
    hasBureau?: boolean
    hasEquipement?: boolean
    hasEquipementPrive?: boolean
    prixVenteApp?: string
    prixVenteCommerce?: string
    prixVenteBureau?: string
    prixVenteEquipement?: string
    prixVenteEquipementPrive?: string
    coutConstrApp?: string
    coutConstrCommerce?: string
    coutConstrBureau?: string
  }
}

// ---------------------------------------------------------------------------
// Constantes & Formatage A4
// ---------------------------------------------------------------------------

const AP = 595.28 // A4 portrait largeur
const APH = 841.89 // A4 portrait hauteur

const NAVY = '0.01 0.35 0.55'
const BLUE_ACCENT = '0.02 0.52 0.78'
const DARK = '0.06 0.09 0.16'
const GRAY = '0.4 0.45 0.52'
const LIGHT_GRAY = '0.6 0.65 0.72'
const LINE = '0.88 0.91 0.94'
const BG_CARD = '0.98 0.985 0.99'
const BG_GREEN = '0.94 0.99 0.95'
const GREEN_TEXT = '0.09 0.55 0.24'
const BG_BLUE = '0.94 0.97 1.0'
const BLUE_TEXT = '0.08 0.4 0.75'

// ---------------------------------------------------------------------------
// Encodage WinAnsi (polices standard PDF avec accents français)
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

function textW(s: string, size: number, bold = false): number {
  const table = bold ? TIMES_BOLD_W : TIMES_W
  let u = 0
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    const byte = WIN_ANSI[ch]
    if (byte != null && table[byte] != null) u += table[byte]
    else if (table[code] != null) u += table[code]
    else u += 500
  }
  return (u * size) / 1000
}

function fitText(s: string, size: number, maxW: number, bold = false): string {
  if (textW(s, size, bold) <= maxW) return s
  let r = s
  while (r.length > 1 && textW(r + '…', size, bold) > maxW) r = r.slice(0, -1)
  return r + '…'
}

function fmtVal(v: number | undefined | null, maxDec = 0): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const f = Number(Number(v).toFixed(maxDec))
  const neg = f < 0 ? '-' : ''
  const str = Math.abs(f).toFixed(maxDec)
  const dot = str.indexOf('.')
  const int = dot === -1 ? str : str.slice(0, dot)
  const dec = dot === -1 ? '' : str.slice(dot + 1)
  let gi = ''
  for (let i = 0; i < int.length; i++) {
    if (i > 0 && (int.length - i) % 3 === 0) gi += ' '
    gi += int[i]
  }
  return dec ? `${neg}${gi},${dec}` : `${neg}${gi}`
}

// ---------------------------------------------------------------------------
// Projection Slippy Map & Capture Satellite Canvas
// ---------------------------------------------------------------------------

function lngToTileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z)
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
}

export async function generateSatelliteSnapshot(
  polygonCoords?: number[][],
  center?: { lat: number; lng: number }
): Promise<string> {
  const width = 800
  const height = 460
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  const pts = polygonCoords && polygonCoords.length > 2 ? polygonCoords : null

  if (pts) {
    pts.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    })
  }

  const cLat = pts ? (minLat + maxLat) / 2 : (center?.lat ?? 33.5731)
  const cLng = pts ? (minLng + maxLng) / 2 : (center?.lng ?? -7.5898)

  let zoom = 17
  if (pts) {
    const dLng = Math.max(maxLng - minLng, 0.001)
    const dLat = Math.max(maxLat - minLat, 0.001)
    const span = Math.max(dLng, dLat)
    if (span > 0.05) zoom = 13
    else if (span > 0.02) zoom = 14
    else if (span > 0.008) zoom = 15
    else if (span > 0.003) zoom = 16
    else if (span > 0.001) zoom = 17
    else zoom = 18
  }

  const centerTileX = lngToTileX(cLng, zoom)
  const centerTileY = latToTileY(cLat, zoom)

  const tileSize = 256
  const startTileX = Math.floor(centerTileX - width / (2 * tileSize)) - 1
  const endTileX = Math.floor(centerTileX + width / (2 * tileSize)) + 1
  const startTileY = Math.floor(centerTileY - height / (2 * tileSize)) - 1
  const endTileY = Math.floor(centerTileY + height / (2 * tileSize)) + 1

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, width, height)

  const loadTile = (x: number, y: number, z: number): Promise<{ img: HTMLImageElement; x: number; y: number } | null> => {
    return new Promise((resolve) => {
      const maxT = Math.pow(2, z)
      const wrappedX = ((x % maxT) + maxT) % maxT
      if (y < 0 || y >= maxT) return resolve(null)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve({ img, x, y })
      img.onerror = () => {
        const fallback = new Image()
        fallback.crossOrigin = 'anonymous'
        fallback.onload = () => resolve({ img: fallback, x, y })
        fallback.onerror = () => resolve(null)
        fallback.src = `https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`
      }
      img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${wrappedX}`
    })
  }

  const tilePromises: Promise<{ img: HTMLImageElement; x: number; y: number } | null>[] = []
  for (let tx = startTileX; tx <= endTileX; tx++) {
    for (let ty = startTileY; ty <= endTileY; ty++) {
      tilePromises.push(loadTile(tx, ty, zoom))
    }
  }

  const loadedTiles = await Promise.all(tilePromises)

  loadedTiles.forEach((t) => {
    if (!t) return
    const px = width / 2 + (t.x - centerTileX) * tileSize
    const py = height / 2 + (t.y - centerTileY) * tileSize
    ctx.drawImage(t.img, px, py, tileSize, tileSize)
  })

  const toCanvasPx = (lng: number, lat: number): { x: number; y: number } => {
    const tx = lngToTileX(lng, zoom)
    const ty = latToTileY(lat, zoom)
    return {
      x: width / 2 + (tx - centerTileX) * tileSize,
      y: height / 2 + (ty - centerTileY) * tileSize,
    }
  }

  if (pts && pts.length > 2) {
    const canvasPts = pts.map(([lng, lat]) => toCanvasPx(lng, lat))

    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = 12

    ctx.beginPath()
    ctx.moveTo(canvasPts[0].x, canvasPts[0].y)
    for (let i = 1; i < canvasPts.length; i++) {
      ctx.lineTo(canvasPts[i].x, canvasPts[i].y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'
    ctx.fill()

    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3.5
    ctx.stroke()
    ctx.restore()

    ctx.beginPath()
    ctx.moveTo(canvasPts[0].x, canvasPts[0].y)
    for (let i = 1; i < canvasPts.length; i++) {
      ctx.lineTo(canvasPts[i].x, canvasPts[i].y)
    }
    ctx.closePath()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    canvasPts.forEach((p) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI)
      ctx.fillStyle = '#0284c7'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })
  } else {
    const cp = toCanvasPx(cLng, cLat)
    ctx.beginPath()
    ctx.arc(cp.x, cp.y, 8, 0, 2 * Math.PI)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Boussole
  ctx.save()
  const northX = width - 40
  const northY = 40
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'
  ctx.beginPath()
  ctx.arc(northX, northY, 20, 0, 2 * Math.PI)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(northX, northY - 14)
  ctx.lineTo(northX - 6, northY + 8)
  ctx.lineTo(northX, northY + 3)
  ctx.closePath()
  ctx.fillStyle = '#ef4444'
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(northX, northY - 14)
  ctx.lineTo(northX + 6, northY + 8)
  ctx.lineTo(northX, northY + 3)
  ctx.closePath()
  ctx.fillStyle = '#f8fafc'
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 9px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('N', northX, northY - 16)
  ctx.restore()

  // Légende
  ctx.save()
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
  ctx.roundRect ? ctx.roundRect(14, height - 42, 260, 28, 6) : ctx.fillRect(14, height - 42, 260, 28)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.stroke()

  ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 1.5
  ctx.fillRect(24, height - 34, 12, 12)
  ctx.strokeRect(24, height - 34, 12, 12)

  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Emprise du terrain (Imagerie Satellite)', 42, height - 25)
  ctx.restore()

  return canvas.toDataURL('image/jpeg', 0.85)
}

function dataUrlToJpegBytes(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(',')
  const base64 = parts.length > 1 ? parts[1] : parts[0]
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

// ---------------------------------------------------------------------------
// Construction Page 1 : Fiche + Carte Satellite + KPIs + Paramètres + Surfaces
// ---------------------------------------------------------------------------

function buildRentaPage1(data: RentaReportData, dateStr: string, hasImage: boolean): string {
  const out: string[] = []
  const { rentaResult, rentaForm } = data

  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = DARK): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }
  const txtR = (s: string, xRight: number, y: number, size: number, font = 'F1', color = DARK): void => {
    const w = textW(s, size, font === 'F2')
    txt(s, xRight - w, y, size, font, color)
  }

  // ── En-tête ──
  txt('RAPPORT D\'ÉTUDE DE RENTABILITÉ FINANCIÈRE', 45, 806, 16, 'F2', NAVY)
  txt(`WebSIG Foncier • SIGMATOP SARL • Édition : ${dateStr}`, 45, 788, 12, 'F1', GRAY)

  out.push(`${BLUE_ACCENT} RG 1.5 w 45 776 m ${(AP - 45).toFixed(2)} 776 l S\n`)

  // ── Haut Gauche : Fiche d'identification du Terrain ──
  const c1X = 45
  const c1W = 245
  const c1Top = 762
  const c1H = 146
  const c1Bottom = c1Top - c1H

  out.push(`${BG_CARD} rg ${c1X} ${c1Bottom} ${c1W} ${c1H} re f\n`)
  out.push(`${LINE} RG 0.8 w ${c1X} ${c1Bottom} ${c1W} ${c1H} re S\n`)

  txt('IDENTIFICATION DU TERRAIN', c1X + 10, c1Top - 18, 14, 'F2', NAVY)
  out.push(`${LINE} RG 0.5 w ${c1X + 10} ${c1Top - 24} m ${c1X + c1W - 10} ${c1Top - 24} l S\n`)

  const supM2 = data.superficie || rentaResult.surfaces?.surface_brute || 0
  const supHa = supM2 > 0 ? (supM2 / 10000).toFixed(2) : '0'

  const infoRows = [
    { label: 'Nom / Intitulé :', val: fitText(data.terrainNom, 12, 125, true) },
    { label: 'Réf. Cadastrale :', val: data.reference || 'Non renseignée' },
    { label: 'Superficie totale :', val: `${fmtVal(supM2)} m² (${supHa} ha)` },
    { label: 'Coordonnées GPS :', val: data.lat && data.lng ? `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}` : 'Non renseignées' },
    { label: 'Projet associé :', val: fitText(data.projectName || 'Projet Foncier', 12, 125) },
  ]

  let iy = c1Top - 42
  infoRows.forEach((r) => {
    txt(r.label, c1X + 10, iy, 12, 'F1', GRAY)
    txtR(r.val, c1X + c1W - 10, iy, 12, 'F2', DARK)
    out.push(`${LINE} RG 0.4 w ${c1X + 10} ${(iy - 4).toFixed(2)} m ${c1X + c1W - 10} ${(iy - 4).toFixed(2)} l S\n`)
    iy -= 22
  })

  // ── Haut Droite : Image Satellite avec Tracé ──
  const c2X = 300
  const c2W = AP - 45 - c2X
  const c2Top = 762
  const c2H = 146
  const c2Bottom = c2Top - c2H

  out.push(`0.06 0.09 0.16 rg ${c2X} ${c2Bottom} ${c2W} ${c2H} re f\n`)
  out.push(`${LINE} RG 0.8 w ${c2X} ${c2Bottom} ${c2W} ${c2H} re S\n`)

  if (hasImage) {
    const imgPad = 2
    const imgW = c2W - 2 * imgPad
    const imgH = c2H - 22 - 2 * imgPad
    const imgX = c2X + imgPad
    const imgY = c2Bottom + 22 + imgPad
    out.push(`q ${imgW.toFixed(2)} 0 0 ${imgH.toFixed(2)} ${imgX.toFixed(2)} ${imgY.toFixed(2)} cm /Img1 Do Q\n`)
  }

  // Légende photo
  out.push(`0.97 0.98 0.99 rg ${c2X} ${c2Bottom} ${c2W} 22 re f\n`)
  out.push(`${LINE} RG 0.6 w ${c2X} ${(c2Bottom + 22).toFixed(2)} m ${c2X + c2W} ${(c2Bottom + 22).toFixed(2)} l S\n`)
  txt('Vue aérienne Satellite & Emprise du terrain', c2X + 8, c2Bottom + 7, 12, 'F2', GRAY)

  // ── Indicateurs Clés (KPIs - 4 Cartouches) ──
  const kpiTop = 604
  const kpiH = 54
  const kpiBottom = kpiTop - kpiH
  const kpiW = (AP - 90 - 3 * 8) / 4

  const kpis = [
    { label: 'TRI (Taux Interne)', val: rentaResult.tri != null ? `${rentaResult.tri}%` : 'Non calculé', bg: BG_GREEN, fg: GREEN_TEXT },
    { label: 'Bénéfice Net Global', val: `${fmtVal(rentaResult.benefice_net)} DH`, bg: BG_GREEN, fg: GREEN_TEXT },
    { label: 'Chiffre d\'Affaires', val: `${fmtVal(rentaResult.ca?.ca_total)} DH`, bg: BG_BLUE, fg: BLUE_TEXT },
    { label: 'Coût Total Projet', val: `${fmtVal(rentaResult.cout_total_projet)} DH`, bg: BG_CARD, fg: DARK },
  ]

  kpis.forEach((k, i) => {
    const kx = 45 + i * (kpiW + 8)
    out.push(`${k.bg} rg ${kx.toFixed(2)} ${kpiBottom.toFixed(2)} ${kpiW.toFixed(2)} ${kpiH} re f\n`)
    out.push(`${LINE} RG 0.8 w ${kx.toFixed(2)} ${kpiBottom.toFixed(2)} ${kpiW.toFixed(2)} ${kpiH} re S\n`)
    txt(k.label, kx + 8, kpiTop - 18, 12, 'F2', GRAY)
    txt(k.val, kx + 8, kpiTop - 38, 14, 'F2', k.fg)
  })

  // ── Deux Cartes du Milieu : Paramètres + Bilan des Surfaces ──
  const midTop = 538
  const midH = 260
  const midBottom = midTop - midH
  const midW = (AP - 90 - 12) / 2

  // Bloc Gauche : Paramètres & Hypothèses
  const m1X = 45
  out.push(`${BG_CARD} rg ${m1X} ${midBottom} ${midW} ${midH} re f\n`)
  out.push(`${LINE} RG 0.8 w ${m1X} ${midBottom} ${midW} ${midH} re S\n`)
  txt('PARAMÈTRES & TAUX APPLIQUÉS', m1X + 10, midTop - 18, 14, 'F2', NAVY)
  out.push(`${LINE} RG 0.5 w ${m1X + 10} ${midTop - 24} m ${m1X + midW - 10} ${midTop - 24} l S\n`)

  const paramRows = [
    { label: 'Prix foncier brut :', val: `${fmtVal(rentaResult.parametres?.prix_foncier_m2 ?? Number(rentaForm.prixFoncierM2))} DH/m²` },
    { label: 'Frais d\'acquisition :', val: `${rentaResult.parametres?.frais_acquisition_pct ?? rentaForm.fraisAcquisition ?? 0} %` },
    { label: 'Taux de chute :', val: `${rentaResult.parametres?.taux_chute_pct ?? rentaForm.tauxChute ?? 0} %` },
    { label: 'COS / CUS :', val: `${rentaResult.parametres?.cos ?? rentaForm.cos ?? 'N/A'} / ${rentaResult.parametres?.cus ?? rentaForm.cus ?? 'N/A'}` },
    { label: 'Études & Honoraires :', val: `${rentaResult.parametres?.taux_etudes_pct ?? rentaForm.tauxEtudes ?? 0} %` },
    { label: 'Imprévus :', val: `${rentaResult.parametres?.taux_imprevus_pct ?? rentaForm.tauxImprevus ?? 0} %` },
    { label: 'Frais commercialisation :', val: `${rentaResult.parametres?.taux_commercialisation_pct ?? rentaForm.tauxCommercialisation ?? 0} %` },
    { label: 'Taux d\'actualisation :', val: `${rentaResult.parametres?.taux_actualisation_pct ?? rentaForm.tauxActualisation ?? 0} %` },
    { label: 'Durée construction :', val: `${rentaResult.parametres?.duree_construction ?? rentaForm.dureeConstruction ?? 2} an(s)` },
    { label: 'Durée commercialisation :', val: `${rentaResult.parametres?.duree_commercialisation ?? rentaForm.dureeCommercialisation ?? 3} an(s)` },
  ]

  let py = midTop - 42
  paramRows.forEach((r) => {
    txt(r.label, m1X + 10, py, 12, 'F1', GRAY)
    txtR(r.val, m1X + midW - 10, py, 12, 'F2', DARK)
    out.push(`${LINE} RG 0.3 w ${m1X + 10} ${(py - 3.5).toFixed(2)} m ${m1X + midW - 10} ${(py - 3.5).toFixed(2)} l S\n`)
    py -= 22
  })

  // Bloc Droite : Bilan des Surfaces
  const m2X = 45 + midW + 12
  out.push(`${BG_CARD} rg ${m2X} ${midBottom} ${midW} ${midH} re f\n`)
  out.push(`${LINE} RG 0.8 w ${m2X} ${midBottom} ${midW} ${midH} re S\n`)
  txt('BILAN DES SURFACES DU PROJET (M²)', m2X + 10, midTop - 18, 14, 'F2', NAVY)
  out.push(`${LINE} RG 0.5 w ${m2X + 10} ${midTop - 24} m ${m2X + midW - 10} ${midTop - 24} l S\n`)

  const surfRows = [
    { label: 'Surface brute :', val: `${fmtVal(rentaResult.surfaces?.surface_brute)} m²` },
    { label: 'SHON / SHOB :', val: `${fmtVal(rentaResult.surfaces?.shon)} / ${fmtVal(rentaResult.surfaces?.shob)} m²` },
    { label: 'Surface vendable :', val: `${fmtVal(rentaResult.surfaces?.surface_vendable)} m²` },
    { label: 'Appartements :', val: `${fmtVal(rentaResult.surfaces?.surface_appartements)} m²` },
    { label: 'Commerces :', val: `${fmtVal(rentaResult.surfaces?.surface_commerces)} m²` },
    { label: 'Bureaux :', val: `${fmtVal(rentaResult.surfaces?.surface_bureaux)} m²` },
    { label: 'Équipements publics :', val: `${fmtVal(rentaResult.surfaces?.surface_equipements)} m²` },
    { label: 'Équipements privés :', val: `${fmtVal(rentaResult.surfaces?.surface_equipements_prives)} m²` },
    { label: 'Voirie & Espaces verts :', val: `${fmtVal(rentaResult.surfaces?.surface_voie)} / ${fmtVal(rentaResult.surfaces?.surface_espace_vert)} m²` },
    { label: 'Surface à aménager :', val: `${fmtVal(rentaResult.surfaces?.surface_a_amenager)} m²` },
  ]

  let sy = midTop - 42
  surfRows.forEach((r) => {
    txt(r.label, m2X + 10, sy, 12, 'F1', GRAY)
    txtR(r.val, m2X + midW - 10, sy, 12, 'F2', DARK)
    out.push(`${LINE} RG 0.3 w ${m2X + 10} ${(sy - 3.5).toFixed(2)} m ${m2X + midW - 10} ${(sy - 3.5).toFixed(2)} l S\n`)
    sy -= 22
  })

  // ── Bloc Bas : Synthèse Économique & Répartition Financière ──
  const botTop = 266
  const botH = 80
  const botBottom = botTop - botH
  const botW = AP - 90

  out.push(`${BG_CARD} rg 45 ${botBottom} ${botW} ${botH} re f\n`)
  out.push(`${LINE} RG 0.8 w 45 ${botBottom} ${botW} ${botH} re S\n`)
  txt('SYNTHÈSE FINANCIÈRE GLOBALE (DH)', 55, botTop - 18, 14, 'F2', NAVY)
  out.push(`${LINE} RG 0.5 w 55 ${botTop - 24} m ${(AP - 55).toFixed(2)} ${botTop - 24} l S\n`)

  const synCols = [
    { label: 'Acquisition foncier', val: `${fmtVal(rentaResult.acquisition?.cout_total)} DH` },
    { label: 'Coût construction', val: `${fmtVal(rentaResult.construction?.cout_total)} DH` },
    { label: 'Total des charges', val: `${fmtVal(rentaResult.cout_total_projet)} DH` },
    { label: 'Chiffre d\'affaires', val: `${fmtVal(rentaResult.ca?.ca_total)} DH` },
  ]

  const sColW = botW / 4
  synCols.forEach((sc, idx) => {
    const scx = 45 + idx * sColW
    txt(sc.label, scx + 10, botTop - 44, 12, 'F1', GRAY)
    txt(sc.val, scx + 10, botTop - 64, 12, 'F2', DARK)
  })

  // ── Pied de page ──
  out.push(`${LINE} RG 0.5 w 45 48 m ${(AP - 45).toFixed(2)} 48 l S\n`)
  txt('Plateforme WebSIG de Prospection & Analyse Foncière • SIGMATOP SARL', 45, 28, 12, 'F1', LIGHT_GRAY)
  txtR('Page 1 / 2', AP - 45, 28, 12, 'F2', GRAY)

  return out.join('')
}

// ---------------------------------------------------------------------------
// Construction Page 2 : Grand Tableau Structuré des Flux de Trésorerie
// ---------------------------------------------------------------------------

function buildRentaPage2(data: RentaReportData, dateStr: string): string {
  const out: string[] = []
  const { rentaResult } = data
  const fluxList = rentaResult.flux ?? []

  const txt = (s: string, x: number, y: number, size: number, font = 'F1', color = DARK): void => {
    out.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(s)}) Tj ET\n`)
  }
  const txtR = (s: string, xRight: number, y: number, size: number, font = 'F1', color = DARK): void => {
    const w = textW(s, size, font === 'F2')
    txt(s, xRight - w, y, size, font, color)
  }

  // ── En-tête Page 2 ──
  txt('TABLEAU PRÉVISIONNEL DES FLUX DE TRÉSORERIE', 45, 806, 16, 'F2', NAVY)
  txt(`WebSIG Foncier • Terrain : ${fitText(data.terrainNom, 12, 180, true)} • Généré le ${dateStr}`, 45, 788, 12, 'F1', GRAY)

  out.push(`${BLUE_ACCENT} RG 1.5 w 45 776 m ${(AP - 45).toFixed(2)} 776 l S\n`)

  // ── Tableau des Flux ──
  const tX = 45
  const tW = AP - 90
  const colLabelW = 220
  const nbCols = Math.max(1, fluxList.length)
  const colYearW = (tW - colLabelW) / nbCols

  let curY = 762

  // En-tête du tableau
  const headH = 28
  out.push(`0.92 0.95 0.98 rg ${tX} ${(curY - headH).toFixed(2)} ${tW} ${headH} re f\n`)
  out.push(`${LINE} RG 0.8 w ${tX} ${(curY - headH).toFixed(2)} ${tW} ${headH} re S\n`)
  txt('POSTE DE TRÉSORERIE (DH)', tX + 8, curY - 18, 12, 'F2', NAVY)

  fluxList.forEach((f, i) => {
    const yx = tX + colLabelW + i * colYearW
    txtR(`Année ${f.annee}`, yx + colYearW - 8, curY - 18, 12, 'F2', NAVY)
  })
  curY -= headH

  const renderSectionHeader = (title: string): void => {
    const secH = 24
    out.push(`0.88 0.92 0.96 rg ${tX} ${(curY - secH).toFixed(2)} ${tW} ${secH} re f\n`)
    out.push(`${LINE} RG 0.6 w ${tX} ${(curY - secH).toFixed(2)} ${tW} ${secH} re S\n`)
    txt(title, tX + 8, curY - 16, 14, 'F2', NAVY)
    curY -= secH
  }

  const renderDataRow = (label: string, values: Array<{ val: number | undefined; pct?: string }>, isEven: boolean): void => {
    const rowH = 24
    if (isEven) {
      out.push(`0.985 0.99 1.0 rg ${tX} ${(curY - rowH).toFixed(2)} ${tW} ${rowH} re f\n`)
    }
    out.push(`${LINE} RG 0.4 w ${tX} ${(curY - rowH).toFixed(2)} ${tW} ${rowH} re S\n`)

    txt(label, tX + 8, curY - 16, 12, 'F1', DARK)

    values.forEach((v, i) => {
      const yx = tX + colLabelW + i * colYearW
      if (v.val != null && v.val > 0) {
        const valStr = `${fmtVal(v.val)}${v.pct ? ` (${v.pct})` : ''}`
        txtR(valStr, yx + colYearW - 8, curY - 16, 12, 'F1', DARK)
      } else {
        txtR('0 DH', yx + colYearW - 8, curY - 16, 12, 'F1', LIGHT_GRAY)
      }
    })
    curY -= rowH
  }

  // 1. SECTION CHARGES
  renderSectionHeader('CHARGES DU PROJET')

  renderDataRow(
    'Acquisition du foncier',
    fluxList.map((f) => ({ val: f.annee === 0 ? f.acquisition : 0, pct: f.annee === 0 && f.acquisition > 0 ? '100%' : undefined })),
    false
  )

  renderDataRow(
    'Aménagement',
    fluxList.map((f) => ({ val: f.annee === 0 ? f.amenagement : 0, pct: f.annee === 0 && f.amenagement > 0 ? '100%' : undefined })),
    true
  )

  renderDataRow(
    'Coût de construction',
    fluxList.map((f) => {
      const p = rentaResult.repartition_construction?.[f.annee]
      return { val: f.construction, pct: p ? `${p}%` : undefined }
    }),
    false
  )

  renderDataRow(
    'Études et honoraires',
    fluxList.map((f) => {
      const p = rentaResult.repartition_construction?.[f.annee]
      return { val: f.etudes_honoraires, pct: p ? `${p}%` : undefined }
    }),
    true
  )

  renderDataRow(
    'Imprévus',
    fluxList.map((f) => {
      const p = rentaResult.repartition_construction?.[f.annee]
      return { val: f.imprevus, pct: p ? `${p}%` : undefined }
    }),
    false
  )

  // 2. SECTION CHIFFRE D'AFFAIRES
  renderSectionHeader('CHIFFRE D\'AFFAIRES & COMMERCIALISATION')

  renderDataRow(
    'Chiffre d\'affaires (hors équipements)',
    fluxList.map((f) => {
      const val = f.ca_commercialisation ?? (f.annee === 0 ? 0 : f.ca)
      const idx = f.annee - 1
      const p = idx >= 0 ? rentaResult.repartition_ventes?.[idx] : undefined
      return { val, pct: p ? `${p}%` : undefined }
    }),
    false
  )

  renderDataRow(
    'Frais de commercialisation',
    fluxList.map((f) => {
      const val = f.frais_commercialisation ?? f.commercialisation
      const idx = f.annee - 1
      const p = idx >= 0 ? rentaResult.repartition_ventes?.[idx] : undefined
      return { val, pct: p ? `${p}%` : undefined }
    }),
    true
  )

  renderDataRow(
    'Ventes équipements publics',
    fluxList.map((f) => {
      const val = f.ca_equipement_public ?? (f.annee === 1 ? (rentaResult.ca?.ca_equipements ?? 0) : 0)
      const idx = f.annee - 1
      const p = idx >= 0 ? rentaResult.repartition_ventes_equipement?.[idx] : undefined
      return { val, pct: p ? `${p}%` : undefined }
    }),
    false
  )

  renderDataRow(
    'Ventes équipements privés',
    fluxList.map((f) => {
      const val = f.ca_equipement_prive ?? (f.annee === 1 ? (rentaResult.ca?.ca_equipements_prives ?? 0) : 0)
      const idx = f.annee - 1
      const p = idx >= 0 ? rentaResult.repartition_ventes_equipement_prive?.[idx] : undefined
      return { val, pct: p ? `${p}%` : undefined }
    }),
    true
  )

  // 3. LIGNE TOTAL FLUX NET
  const netH = 32
  out.push(`${BG_GREEN} rg ${tX} ${(curY - netH).toFixed(2)} ${tW} ${netH} re f\n`)
  out.push(`0.09 0.55 0.24 RG 1.2 w ${tX} ${(curY - netH).toFixed(2)} ${tW} ${netH} re S\n`)
  txt('FLUX NET DE TRÉSORERIE (DH)', tX + 8, curY - 20, 14, 'F2', GREEN_TEXT)

  fluxList.forEach((f, i) => {
    const yx = tX + colLabelW + i * colYearW
    txtR(`${fmtVal(f.flux_net)} DH`, yx + colYearW - 8, curY - 20, 14, 'F2', GREEN_TEXT)
  })
  curY -= netH

  // ── Pied de page ──
  out.push(`${LINE} RG 0.5 w 45 48 m ${(AP - 45).toFixed(2)} 48 l S\n`)
  txt('Plateforme WebSIG de Prospection & Analyse Foncière • SIGMATOP SARL', 45, 28, 12, 'F1', LIGHT_GRAY)
  txtR('Page 2 / 2', AP - 45, 28, 12, 'F2', GRAY)

  return out.join('')
}

// ---------------------------------------------------------------------------
// Assemblage du PDF binaire vectoriel (avec XObject Image si disponible)
// ---------------------------------------------------------------------------

interface GeneratedPdfPage {
  width: number
  height: number
  content: string
  hasImage?: boolean
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

function strToAscii(s: string): Uint8Array {
  return new Uint8Array(winAnsiBytes(s))
}

function assembleVectorPdf(pages: GeneratedPdfPage[], jpegBytes: Uint8Array | null): Uint8Array {
  const n = pages.length
  const firstFont = 3 + n
  const hasImg = jpegBytes != null && jpegBytes.length > 0
  const imageObjId = hasImg ? firstFont + 2 : null
  const firstStream = hasImg ? firstFont + 3 : firstFont + 2

  const objects: Uint8Array[] = []

  // 1: Catalog
  objects.push(strToAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'))

  // 2: Pages
  objects.push(
    strToAscii(
      `2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i} 0 R`).join(' ')}] /Count ${n} >>\nendobj\n`
    )
  )

  // 3..3+n-1: Page objects
  for (let i = 0; i < n; i++) {
    const p = pages[i]
    const xObjRes = p.hasImage && imageObjId ? `/XObject << /Img1 ${imageObjId} 0 R >> ` : ''
    objects.push(
      strToAscii(
        `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.width} ${p.height}] ` +
        `/Resources << /Font << /F1 ${firstFont} 0 R /F2 ${firstFont + 1} 0 R >> ${xObjRes}>> /Contents ${firstStream + i} 0 R >>\nendobj\n`
      )
    )
  }

  // Fonts
  objects.push(
    strToAscii(`${firstFont} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>\nendobj\n`),
    strToAscii(`${firstFont + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`)
  )

  // Image Object
  if (hasImg && imageObjId) {
    const imgHeader = strToAscii(
      `${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width 800 /Height 460 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    )
    const imgFooter = strToAscii('\nendstream\nendobj\n')
    objects.push(concatBytes([imgHeader, jpegBytes, imgFooter]))
  }

  // Page Content Streams
  for (let i = 0; i < n; i++) {
    const streamContent = strToAscii(pages[i].content)
    objects.push(
      concatBytes([
        strToAscii(`${firstStream + i} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n`),
        streamContent,
        strToAscii('\nendstream\nendobj\n'),
      ])
    )
  }

  const header = strToAscii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
  const offsets: number[] = []
  const body: Uint8Array[] = [header]
  let pos = header.length
  for (const o of objects) {
    offsets.push(pos)
    body.push(o)
    pos += o.length
  }
  let xref = strToAscii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`)
  for (const off of offsets) {
    xref = concatBytes([xref, strToAscii(`${String(off).padStart(10, '0')} 00000 n \n`)])
  }
  const trailer = strToAscii(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`
  )
  return concatBytes([...body, xref, trailer])
}

function sanitizeFileName(s: string): string {
  const clean = s
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return clean || 'rapport-rentabilite'
}

function downloadPdfBytes(bytes: Uint8Array, name: string): void {
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

// ---------------------------------------------------------------------------
// Point d'entrée principal pour téléchargement direct
// ---------------------------------------------------------------------------

export async function generateAndDownloadRentaPdfReport(data: RentaReportData): Promise<void> {
  const now = new Date()
  const p = (x: number): string => String(x).padStart(2, '0')
  const dateStr = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} à ${p(now.getHours())}h${p(now.getMinutes())}`

  let jpegBytes: Uint8Array | null = null
  try {
    const dataUrl = await generateSatelliteSnapshot(
      data.polygonCoords,
      data.lat && data.lng ? { lat: data.lat, lng: data.lng } : undefined
    )
    if (dataUrl) {
      jpegBytes = dataUrlToJpegBytes(dataUrl)
    }
  } catch (err) {
    console.warn('[pdf-report] Erreur capture satellite:', err)
  }

  const pages: GeneratedPdfPage[] = [
    {
      width: AP,
      height: APH,
      content: buildRentaPage1(data, dateStr, jpegBytes != null),
      hasImage: jpegBytes != null,
    },
    {
      width: AP,
      height: APH,
      content: buildRentaPage2(data, dateStr),
      hasImage: false,
    },
  ]

  const pdfBytes = assembleVectorPdf(pages, jpegBytes)
  const filename = `${sanitizeFileName(data.terrainNom)}-rentabilite.pdf`
  downloadPdfBytes(pdfBytes, filename)
}

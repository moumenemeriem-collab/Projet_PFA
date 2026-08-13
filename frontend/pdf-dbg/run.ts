import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeParcelAffectations, preparePAZones } from './affectations.ts'
import { extractRing } from './terrainDims.ts'
import { buildAffectationsPdf } from './pdfPlan.ts'

const ROOT = 'C:/Users/hp/Desktop/StageSIGMATOP/dev/websig-potentiel-foncier-final'
const cad = JSON.parse(readFileSync(join(ROOT, 'tmp_cadastre.geojson'), 'utf-8'))
const pa = JSON.parse(readFileSync(join(ROOT, 'tmp_pa.geojson'), 'utf-8'))

const paPrepared = preparePAZones(pa.features)

// Find parcels with pieces, sorted by piece count (limit scan for speed)
const stats: { num: string; n: number }[] = []
for (const f of cad.features.slice(0, 40)) {
  process.stdout.write('.')
  const pieces = computeParcelAffectations(f, paPrepared)
  if (pieces.length > 0) stats.push({ num: String(f.properties.num), n: pieces.length })
}
console.log('\nparcels with pieces:', stats.length)
console.log('top 10 by pieces:', stats.slice(0, 10))

// Test the one with most pieces (worst case)
const top = stats[0]
const feat = cad.features.find((f: any) => String(f.properties.num) === top.num)
const pieces = computeParcelAffectations(feat, paPrepared)
const ring = extractRing(feat.geometry)
console.log('parcel:', top.num, 'pieces:', pieces.length, 'ring pts:', ring?.length)

const bytes = buildAffectationsPdf(`Parcelle ${top.num}`, ring!, pieces)
writeFileSync(join(ROOT, 'tmp_test_aff.pdf'), Buffer.from(bytes))
console.log('pdf bytes:', bytes.length)

const text = Buffer.from(bytes).toString('latin1')
const pageObjs = (text.match(/\/Type \/Page\b/g) || []).length
console.log('page objects:', pageObjs)
const streamMatches = text.match(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g) || []
console.log('content streams:', streamMatches.length)
let emptyStreams = 0
let nanCount = 0
let totalLen = 0
for (const m of streamMatches) {
  const body = m.split('stream\n')[1] || ''
  totalLen += body.length
  if (body.trim().length === 0) emptyStreams++
  if (/NaN|Infinity/.test(body)) nanCount++
}
console.log('empty streams:', emptyStreams, 'streams with NaN/Infinity:', nanCount, 'total stream len:', totalLen)

// Also test a small parcel (1-2 pieces)
for (let i = stats.length - 1; i >= 0; i--) {
  if (stats[i].n <= 2) {
    const f2 = cad.features.find((f: any) => String(f.properties.num) === stats[i].num)
    const p2 = computeParcelAffectations(f2, paPrepared)
    const r2 = extractRing(f2.geometry)
    const b2 = buildAffectationsPdf(`Parcelle ${stats[i].num}`, r2!, p2)
    const t2 = Buffer.from(b2).toString('latin1')
    const pages2 = (t2.match(/\/Type \/Page\b/g) || []).length
    console.log('small parcel', stats[i].num, 'pieces:', p2.length, 'pdf bytes:', b2.length, 'pages:', pages2, 'has NaN:', /NaN|Infinity/.test(t2))
    break
  }
}

// Worst case: parcel T54884 (257 overlapping zones)
const big = cad.features.find((f: any) => String(f.properties.num) === 'T54884')
if (big) {
  const bigPieces = computeParcelAffectations(big, paPrepared)
  const bigRing = extractRing(big.geometry)
  console.log('BIG parcel T54884 pieces:', bigPieces.length, 'ring pts:', bigRing?.length)
  try {
    const bb = buildAffectationsPdf('Parcelle T54884', bigRing!, bigPieces)
    writeFileSync(join(ROOT, 'tmp_big_aff.pdf'), Buffer.from(bb))
    const tb = Buffer.from(bb).toString('latin1')
    const pb = (tb.match(/\/Type \/Page\b/g) || []).length
    console.log('BIG pdf bytes:', bb.length, 'pages:', pb, 'has NaN:', /NaN|Infinity/.test(tb))
  } catch (e) {
    console.log('BIG pdf ERROR:', e)
  }
}

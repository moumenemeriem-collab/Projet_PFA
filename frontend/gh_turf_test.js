const fs = require('fs')
const intersect = require('@turf/intersect').default

const cad = JSON.parse(fs.readFileSync('../backend/media/couches/cadastre/CadGIS_Temara.geojson', 'utf8'))
const pa = JSON.parse(fs.readFileSync('../backend/media/couches/plan_amenagement/plan_amenagement_20260810_121211.geojson', 'utf8'))

function featuresOf(fc) { return fc.features }
function ringBbox(coords) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const walk = (arr) => { for (const p of arr) { if (Array.isArray(p[0])) walk(p); else { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]) } } }
  walk(coords)
  return { minX, maxX, minY, maxY }
}
function ringAreaM2(coords) {
  // shoelace in projected meters (equirectangular at mean lat)
  let sum = 0, latSum = 0, n = 0
  const walk = (arr) => { for (const p of arr) { if (Array.isArray(p[0])) walk(p); else { latSum += p[1]; n++ } } }
  walk(coords)
  const latC = latSum / n
  const kLat = 111320, kLng = 111320 * Math.cos(latC * Math.PI / 180)
  const collectRings = (arr, out) => { for (const p of arr) { if (Array.isArray(p[0]) && Array.isArray(p[0][0])) collectRings(p, out); else out.push(arr) } return out }
  const rings = collectRings(coords, [])
  for (const r of rings) { for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; sum += a[0] * kLng * b[1] * kLat - b[0] * kLng * a[1] * kLat } }
  return Math.abs(sum) / 2
}

// build PA polygon features once
const zones = []
for (const f of pa.features) {
  zones.push({ designation: f.properties.designation, type: f.properties.type_construction, props: f.properties, fc: { type: 'Feature', properties: f.properties, geometry: f.geometry } })
}
console.log('zones:', zones.length)

// pick a mid-size parcel
let target = null
for (const f of cad.features) {
  if (!target || (f.geometry.coordinates[0].length > 5 && f.geometry.coordinates[0].length < 12)) { target = f }
}
console.log('parcel num:', target.properties.num, 'verts:', target.geometry.coordinates[0].length)

const pb = ringBbox(target.geometry.coordinates)
let pieces = []
const t0 = Date.now()
for (const z of zones) {
  const zb = ringBbox(z.fc.geometry.coordinates)
  if (pb.maxX < zb.minX || zb.maxX < pb.minX || pb.maxY < zb.minY || zb.maxY < pb.minY) continue
  try {
    const res = intersect(target, z.fc)
    if (res) pieces.push({ designation: z.designation, type: z.type, props: z.props, geom: res.geometry })
  } catch (e) { console.log('err for zone', z.designation, e.message) }
}
console.log('ms:', Date.now() - t0, 'pieces:', pieces.length)
console.log('designations:', JSON.stringify([...new Set(pieces.map(p => p.designation))]))
const parcelArea = ringAreaM2(target.geometry.coordinates)
let pieceArea = 0
pieces.forEach((p, i) => { const a = ringAreaM2(p.geom.coordinates); pieceArea += a; if (i < 5) console.log('  ', p.designation, a.toFixed(0)) })
console.log('parcelArea:', parcelArea.toFixed(0), 'pieceArea sum:', pieceArea.toFixed(0), 'ratio:', (pieceArea / parcelArea).toFixed(3))

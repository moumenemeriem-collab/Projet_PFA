import fs from 'node:fs'
import intersect from '@turf/intersect'

const cad = JSON.parse(fs.readFileSync('../backend/media/couches/cadastre/CadGIS_Temara.geojson', 'utf8'))
const pa = JSON.parse(fs.readFileSync('../backend/media/couches/plan_amenagement/plan_amenagement_20260810_121211.geojson', 'utf8'))

function ringBbox(coords) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const walk = (arr) => { for (const p of arr) { if (Array.isArray(p[0])) walk(p); else { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]) } } }
  walk(coords)
  return { minX, maxX, minY, maxY }
}
function allRings(coords, out = []) {
  if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && typeof coords[0][0][0] === 'number') { out.push(coords); return out }
  for (const c of coords) allRings(c, out)
  return out
}
function stripZ(feature) {
  const g = JSON.parse(JSON.stringify(feature.geometry))
  const walk = (arr) => { for (const p of arr) { if (Array.isArray(p[0])) walk(p); else { p.length = 2 } } }
  walk(g.coordinates)
  return { type: 'Feature', properties: feature.properties, geometry: g }
}
function ringAreaM2(ring) {
  let latSum = 0
  for (const p of ring) latSum += p[1]
  const latC = latSum / ring.length
  const kLat = 111320, kLng = 111320 * Math.cos(latC * Math.PI / 180)
  let s = 0
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; s += a[0] * kLng * b[1] * kLat - b[0] * kLng * a[1] * kLat }
  return Math.abs(s) / 2
}
function geomAreaM2(coords) {
  return allRings(coords).reduce((sum, r) => sum + ringAreaM2(r), 0)
}

const zones = []
for (const f of pa.features) {
  zones.push({ designation: f.properties.designation ?? '', type: f.properties.type_construction ?? '', props: f.properties, fc: f })
}

// Test several parcels
let totalPieces = 0, totalAreas = 0, totalParcelArea = 0
let withIntersect = 0, tries = 0, errors = 0
const t0 = Date.now()
const samples = [0, 1, 2, 3, 4, 5, 10, 50, 100, 200, 500, 1000]
for (const idx of samples) {
  const target = cad.features[idx]
  const pb = ringBbox(target.geometry.coordinates)
  const parcelArea = geomAreaM2(target.geometry.coordinates)
  totalParcelArea += parcelArea
  let pieceArea = 0
  let count = 0
  for (const z of zones) {
    const zb = ringBbox(z.fc.geometry.coordinates)
    if (pb.maxX < zb.minX || zb.maxX < pb.minX || pb.maxY < zb.minY || zb.maxY < pb.minY) continue
    tries++
    try {
      const res = intersect(stripZ(target), stripZ(z.fc))
      if (res) { count++; pieceArea += geomAreaM2(res.geometry.coordinates); withIntersect++ }
    } catch { errors++ }
  }
  totalPieces += count
  totalAreas += pieceArea
  console.log(`parcel[${idx}] num=${target.properties.num} area=${parcelArea.toFixed(0)} pieces=${count} pieceArea=${pieceArea.toFixed(0)}`)
}
console.log('ms:', Date.now() - t0)
console.log('totalPieces:', totalPieces, 'totalAreas:', totalAreas.toFixed(0), 'totalParcelArea:', totalParcelArea.toFixed(0), 'ratio:', (totalAreas / totalParcelArea).toFixed(3))
console.log('tries:', tries, 'withIntersect:', withIntersect, 'errors:', errors)

const fs = require('fs')
const intersect = require('@turf/intersect').default

const cad = JSON.parse(fs.readFileSync('../backend/media/couches/cadastre/CadGIS_Temara.geojson', 'utf8'))
const pa = JSON.parse(fs.readFileSync('../backend/media/couches/plan_amenagement/plan_amenagement_20260810_121211.geojson', 'utf8'))

function ringBbox(coords) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const walk = (arr) => { for (const p of arr) { if (Array.isArray(p[0])) walk(p); else { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]) } } }
  walk(coords)
  return { minX, maxX, minY, maxY }
}
function stripZ(feature) {
  const g = JSON.parse(JSON.stringify(feature.geometry))
  const walk = (arr) => { for (const p of arr) { if (Array.isArray(p[0])) walk(p); else { p.length = 2 } } }
  walk(g.coordinates)
  return { type: 'Feature', properties: feature.properties, geometry: g }
}

const zones = pa.features.map((f) => stripZ(f))
console.log('zones prepared:', zones.length)

const samples = [0, 1, 2, 3, 4, 5, 10, 50, 100, 200, 500, 1000]
let totalPieces = 0, totalErrors = 0, tried = 0, totalAreas = 0, totalParcelArea = 0
for (const idx of samples) {
  const target = stripZ(cad.features[idx])
  const pb = ringBbox(target.geometry.coordinates)
  let count = 0, pieceArea = 0, errors = 0
  for (const z of zones) {
    const zb = ringBbox(z.geometry.coordinates)
    if (pb.maxX < zb.minX || zb.maxX < pb.minX || pb.maxY < zb.minY || zb.maxY < pb.minY) continue
    tried++
    try {
      const res = intersect({ type: 'FeatureCollection', features: [target, z] }, { properties: z.properties })
      if (res) { count++ }
    } catch (e) { errors++; if (errors < 3) console.log('ERR parcel', idx, 'zone', z.properties.designation, '->', e.message) }
  }
  const area = ringBbox(target.geometry.coordinates)
  console.log(`parcel[${idx}] num=${target.properties.num} pieces=${count} errors=${errors}`)
  totalPieces += count
  totalErrors += errors
}
console.log('tried:', tried, 'totalPieces:', totalPieces, 'totalErrors:', totalErrors)

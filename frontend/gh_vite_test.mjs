import { createServer } from 'vite'

const server = await createServer({
  root: process.cwd(),
  logLevel: 'error',
  server: { middlewareMode: true },
})

const fs = await import('node:fs')
const cad = JSON.parse(fs.readFileSync('../backend/media/couches/cadastre/CadGIS_Temara.geojson', 'utf8'))
const pa = JSON.parse(fs.readFileSync('../backend/media/couches/plan_amenagement/plan_amenagement_20260810_121211.geojson', 'utf8'))

const { computeParcelAffectations, preparePAZones } = await server.ssrLoadModule('/src/utils/affectations.ts')

const zones = preparePAZones(pa.features)
console.log('zones prepared:', zones.length)

const samples = [0, 1, 2, 3, 4, 5, 10, 50, 100, 200, 500, 1000]
let total = 0
for (const idx of samples) {
  const f = cad.features[idx]
  const pieces = computeParcelAffectations(f, zones)
  console.log(`parcel[${idx}] num=${f.properties.num} pieces=${pieces.length} ${pieces.slice(0, 3).map((p) => p.designation + ':' + Math.round(p.areaM2)).join(', ')}`)
  total += pieces.length
}
console.log('TOTAL pieces:', total)
await server.close()

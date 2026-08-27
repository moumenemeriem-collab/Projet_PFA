// Générateur de rapport PDF professionnel pour l'étude de rentabilité financière et foncière.
// Inclut la capture satellite OSM / ESRI avec le contour du terrain et l'ensemble des indicateurs.

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

  // Calcul du centre et de la boîte englobante
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

  // Zoom adapté à la taille du terrain
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

  // Fond gris foncé initial
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
        // Fallback OSM standard
        const fallback = new Image()
        fallback.crossOrigin = 'anonymous'
        fallback.onload = () => resolve({ img: fallback, x, y })
        fallback.onerror = () => resolve(null)
        fallback.src = `https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`
      }
      // ESRI World Imagery (Satellite haute résolution)
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

  // Dessin des tuiles satellite
  loadedTiles.forEach((t) => {
    if (!t) return
    const px = width / 2 + (t.x - centerTileX) * tileSize
    const py = height / 2 + (t.y - centerTileY) * tileSize
    ctx.drawImage(t.img, px, py, tileSize, tileSize)
  })

  // Conversion Coordonnées GPS -> Pixels Canvas
  const toCanvasPx = (lng: number, lat: number): { x: number; y: number } => {
    const tx = lngToTileX(lng, zoom)
    const ty = latToTileY(lat, zoom)
    return {
      x: width / 2 + (tx - centerTileX) * tileSize,
      y: height / 2 + (ty - centerTileY) * tileSize,
    }
  }

  // Tracé du polygone du terrain
  if (pts && pts.length > 2) {
    const canvasPts = pts.map(([lng, lat]) => toCanvasPx(lng, lat))

    // Ombre portée / Glow
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = 12

    // Remplissage translucide bleu / cyan
    ctx.beginPath()
    ctx.moveTo(canvasPts[0].x, canvasPts[0].y)
    for (let i = 1; i < canvasPts.length; i++) {
      ctx.lineTo(canvasPts[i].x, canvasPts[i].y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'
    ctx.fill()

    // Contour net cyan lumineux
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3.5
    ctx.stroke()
    ctx.restore()

    // Ligne intérieure fine blanche
    ctx.beginPath()
    ctx.moveTo(canvasPts[0].x, canvasPts[0].y)
    for (let i = 1; i < canvasPts.length; i++) {
      ctx.lineTo(canvasPts[i].x, canvasPts[i].y)
    }
    ctx.closePath()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Sommets du polygone (points)
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
    // Si pas de polygone complet : point marqueur au centre
    const cp = toCanvasPx(cLng, cLat)
    ctx.beginPath()
    ctx.arc(cp.x, cp.y, 8, 0, 2 * Math.PI)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // ── Éléments cartographiques : Boussole / Nord ──
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

  // Flèche Nord
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

  // ── Légende / Badge en bas à gauche ──
  ctx.save()
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
  ctx.roundRect ? ctx.roundRect(14, height - 42, 260, 28, 6) : ctx.fillRect(14, height - 42, 260, 28)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.stroke()

  // Pastille de légende
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

  return canvas.toDataURL('image/jpeg', 0.9)
}

// ---------------------------------------------------------------------------
// Générateur de Rapport HTML Print-Ready & PDF
// ---------------------------------------------------------------------------

export async function generateAndDownloadRentaPdfReport(data: RentaReportData): Promise<void> {
  const { rentaResult, rentaForm } = data
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  // Génération de la vue satellite
  const snapshotUrl = await generateSatelliteSnapshot(
    data.polygonCoords,
    data.lat && data.lng ? { lat: data.lat, lng: data.lng } : undefined
  )

  const fmt = (v: number | undefined | null): string => {
    if (v == null || !Number.isFinite(Number(v))) return '—'
    return Number(v).toLocaleString('fr-FR')
  }

  const fluxList = rentaResult.flux ?? []

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport de Rentabilité - ${data.terrainNom}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9pt;
      line-height: 1.35;
    }

    /* ── En-tête ── */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .report-brand {
      display: flex;
      flex-direction: column;
    }
    .report-logo {
      font-size: 14pt;
      font-weight: 800;
      color: #0369a1;
      letter-spacing: -0.02em;
    }
    .report-sublogo {
      font-size: 7.5pt;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .report-title-box {
      text-align: right;
    }
    .report-title {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px;
      text-transform: uppercase;
    }
    .report-date {
      font-size: 7.5pt;
      color: #64748b;
    }

    /* ── Grille 2 colonnes du haut : Infos + Carte ── */
    .top-grid {
      display: grid;
      grid-template-columns: 1fr 1.15fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .card-title {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0369a1;
      margin: 0 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #f1f5f9;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 3.5px 0;
      border-bottom: 1px dashed #f1f5f9;
      font-size: 8pt;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #475569;
    }
    .info-val {
      font-weight: 700;
      color: #0f172a;
    }

    .map-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #0f172a;
    }
    .map-img {
      width: 100%;
      height: 160px;
      object-fit: cover;
      display: block;
    }
    .map-caption {
      padding: 4px 8px;
      background: #f8fafc;
      font-size: 7pt;
      color: #64748b;
      font-weight: 600;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }

    /* ── Bloc Indicateurs Clés (KPIs) ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
    }
    .kpi-card--primary {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .kpi-card--accent {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .kpi-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 3px;
    }
    .kpi-val {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-val--green {
      color: #15803d;
    }
    .kpi-val--blue {
      color: #1d4ed8;
    }

    /* ── Tableaux ── */
    .section-title {
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
      margin: 12px 0 6px;
      padding-left: 6px;
      border-left: 3px solid #0284c7;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin-bottom: 12px;
    }
    table.data-table th, table.data-table td {
      padding: 4.5px 8px;
      border: 1px solid #e2e8f0;
      text-align: right;
    }
    table.data-table thead th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      font-size: 7pt;
      letter-spacing: 0.03em;
    }
    table.data-table thead th:first-child {
      text-align: left;
    }
    table.data-table tbody tr:nth-child(even) {
      background: #fafafa;
    }
    .row-sec-header td {
      background: #e2e8f0 !important;
      font-weight: 800;
      color: #0f172a;
      text-align: left !important;
      font-size: 7pt;
      text-transform: uppercase;
      padding: 4px 8px;
    }
    .row-net td {
      background: #f0fdf4 !important;
      border-top: 2px solid #16a34a !important;
      font-weight: 800;
      color: #15803d;
      font-size: 8pt;
    }
    .pct-tag {
      display: inline-block;
      font-size: 6pt;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 0 4px;
      margin-left: 4px;
    }

    /* ── Grille 2 colonnes bas : Paramètres + Surfaces ── */
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    /* ── Pied de page ── */
    .report-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #94a3b8;
    }

    @media print {
      body { margin: 0; }
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>

  <!-- Bouton d'impression automatique / barre d'action -->
  <div class="no-print" style="background:#0f172a; color:#fff; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:1000; box-shadow:0 2px 10px rgba(0,0,0,0.2);">
    <span style="font-weight:700; font-size:12px;">Rapport de Rentabilité Financière — Prêt à imprimer / enregistrer en PDF</span>
    <button onclick="window.print()" style="background:#0284c7; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:700; cursor:pointer; font-size:12px;">
      🖨️ Enregistrer en PDF / Imprimer
    </button>
  </div>

  <div style="padding: 10px;">
    <!-- En-tête -->
    <header class="report-header">
      <div class="report-brand">
        <span class="report-logo">WebSIG Foncier</span>
        <span class="report-sublogo">SIGMATOP — Étude de Potentiel Foncier & Rentabilité</span>
      </div>
      <div class="report-title-box">
        <h1 class="report-title">Rapport d'Étude de Rentabilité</h1>
        <div class="report-date">Généré le ${dateStr} à ${timeStr} — Référence : ${data.reference || data.terrainNom}</div>
      </div>
    </header>

    <!-- Haut : Fiche foncier + Carte satellite -->
    <div class="top-grid">
      <div class="card">
        <div class="card-title">Fiche d'identification du Terrain</div>
        <div class="info-row">
          <span class="info-label">Nom / Intitulé :</span>
          <span class="info-val">${data.terrainNom}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Réf. Cadastrale :</span>
          <span class="info-val">${data.reference || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Superficie totale :</span>
          <span class="info-val">${fmt(data.superficie || rentaResult.surfaces?.surface_brute)} m²</span>
        </div>
        <div class="info-row">
          <span class="info-label">Surface en Hectares :</span>
          <span class="info-val">${((data.superficie || rentaResult.surfaces?.surface_brute || 0) / 10000).toFixed(2)} ha</span>
        </div>
        <div class="info-row">
          <span class="info-label">Coordonnées GPS :</span>
          <span class="info-val">${data.lat ? `${data.lat.toFixed(5)}, ${data.lng?.toFixed(5)}` : '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Projet associé :</span>
          <span class="info-val">${data.projectName || 'Simulation Foncier'}</span>
        </div>
      </div>

      <div class="map-box">
        <img class="map-img" src="${snapshotUrl}" alt="Vue satellite du terrain" />
        <div class="map-caption">Vue aérienne Satellite & Emprise du terrain (ESRI / OSM)</div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-card--primary">
        <div class="kpi-label">Taux de Rentabilité Interne (TRI)</div>
        <div class="kpi-val kpi-val--green">${rentaResult.tri != null ? `${rentaResult.tri}%` : '—'}</div>
      </div>
      <div class="kpi-card kpi-card--primary">
        <div class="kpi-label">Bénéfice Net Global</div>
        <div class="kpi-val kpi-val--green">${fmt(rentaResult.benefice_net)} DH</div>
      </div>
      <div class="kpi-card kpi-card--accent">
        <div class="kpi-label">Chiffre d'Affaires Total</div>
        <div class="kpi-val kpi-val--blue">${fmt(rentaResult.ca?.ca_total)} DH</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Coût Total du Projet</div>
        <div class="kpi-val">${fmt(rentaResult.cout_total_projet)} DH</div>
      </div>
    </div>

    <!-- Deux colonnes : Paramètres & Surfaces -->
    <div class="bottom-grid">
      <div class="card">
        <div class="card-title">Paramètres & Taux Appliqués</div>
        <div class="info-row"><span class="info-label">Prix foncier brut :</span><span class="info-val">${fmt(rentaResult.parametres?.prix_foncier_m2 ?? Number(rentaForm.prixFoncierM2))} DH/m²</span></div>
        <div class="info-row"><span class="info-label">Frais d'acquisition :</span><span class="info-val">${rentaResult.parametres?.frais_acquisition_pct ?? rentaForm.fraisAcquisition ?? 0}%</span></div>
        <div class="info-row"><span class="info-label">Taux de chute :</span><span class="info-val">${rentaResult.parametres?.taux_chute_pct ?? rentaForm.tauxChute ?? 0}%</span></div>
        <div class="info-row"><span class="info-label">COS / CUS :</span><span class="info-val">${rentaResult.parametres?.cos ?? rentaForm.cos ?? '—'} / ${rentaResult.parametres?.cus ?? rentaForm.cus ?? '—'}</span></div>
        <div class="info-row"><span class="info-label">Études & Honoraires :</span><span class="info-val">${rentaResult.parametres?.taux_etudes_pct ?? rentaForm.tauxEtudes ?? 0}%</span></div>
        <div class="info-row"><span class="info-label">Imprévus :</span><span class="info-val">${rentaResult.parametres?.taux_imprevus_pct ?? rentaForm.tauxImprevus ?? 0}%</span></div>
        <div class="info-row"><span class="info-label">Frais de commercialisation :</span><span class="info-val">${rentaResult.parametres?.taux_commercialisation_pct ?? rentaForm.tauxCommercialisation ?? 0}%</span></div>
        <div class="info-row"><span class="info-label">Taux d'actualisation :</span><span class="info-val">${rentaResult.parametres?.taux_actualisation_pct ?? rentaForm.tauxActualisation ?? 0}%</span></div>
        <div class="info-row"><span class="info-label">Durée construction / vente :</span><span class="info-val">${rentaResult.parametres?.duree_construction ?? rentaForm.dureeConstruction ?? 2} ans / ${rentaResult.parametres?.duree_commercialisation ?? rentaForm.dureeCommercialisation ?? 3} ans</span></div>
      </div>

      <div class="card">
        <div class="card-title">Bilan des Surfaces du Projet</div>
        <div class="info-row"><span class="info-label">Surface brute :</span><span class="info-val">${fmt(rentaResult.surfaces?.surface_brute)} m²</span></div>
        <div class="info-row"><span class="info-label">SHON / SHOB :</span><span class="info-val">${fmt(rentaResult.surfaces?.shon)} / ${fmt(rentaResult.surfaces?.shob)} m²</span></div>
        <div class="info-row"><span class="info-label">Surface vendable :</span><span class="info-val">${fmt(rentaResult.surfaces?.surface_vendable)} m²</span></div>
        <div class="info-row"><span class="info-label">Appartements :</span><span class="info-val">${fmt(rentaResult.surfaces?.surface_appartements)} m²</span></div>
        <div class="info-row"><span class="info-label">Commerces :</span><span class="info-val">${fmt(rentaResult.surfaces?.surface_commerces)} m²</span></div>
        <div class="info-row"><span class="info-label">Bureaux :</span><span class="info-val">${fmt(rentaResult.surfaces?.surface_bureaux)} m²</span></div>
        <div class="info-row"><span class="info-label">Équipements publics / privés :</span><span class="info-val">${fmt(rentaResult.surfaces?.surface_equipements)} / ${fmt(rentaResult.surfaces?.surface_equipements_prives)} m²</span></div>
        <div class="info-row"><span class="info-label">Voirie & Espaces verts :</span><span class="info-val">${fmt(rentaResult.surfaces?.surface_voie)} / ${fmt(rentaResult.surfaces?.surface_espace_vert)} m²</span></div>
        <div class="info-row"><span class="info-label">Surface à aménager :</span><span class="info-val">${fmt(rentaResult.surfaces?.surface_a_amenager)} m²</span></div>
      </div>
    </div>

    <!-- Tableau Prévisionnel des Flux de Trésorerie -->
    <div class="section-title">Tableau Prévisionnel des Flux de Trésorerie (DH)</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Poste</th>
          ${fluxList.map((f) => `<th>Année ${f.annee}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <!-- Section Charges -->
        <tr class="row-sec-header">
          <td colspan="${1 + fluxList.length}">Charges</td>
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Acquisition du foncier</td>
          ${fluxList.map((f) => `<td>${f.annee === 0 && f.acquisition > 0 ? `${fmt(f.acquisition)} <span class="pct-tag">100%</span>` : '—'}</td>`).join('')}
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Aménagement</td>
          ${fluxList.map((f) => `<td>${f.annee === 0 && f.amenagement > 0 ? `${fmt(f.amenagement)} <span class="pct-tag">100%</span>` : '—'}</td>`).join('')}
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Coût de construction</td>
          ${fluxList.map((f) => {
            const p = rentaResult.repartition_construction?.[f.annee]
            return `<td>${f.construction > 0 ? `${fmt(f.construction)} ${p ? `<span class="pct-tag">${p}%</span>` : ''}` : '—'}</td>`
          }).join('')}
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Études et honoraires</td>
          ${fluxList.map((f) => {
            const p = rentaResult.repartition_construction?.[f.annee]
            return `<td>${f.etudes_honoraires > 0 ? `${fmt(f.etudes_honoraires)} ${p ? `<span class="pct-tag">${p}%</span>` : ''}` : '—'}</td>`
          }).join('')}
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Imprévus</td>
          ${fluxList.map((f) => {
            const p = rentaResult.repartition_construction?.[f.annee]
            return `<td>${f.imprevus > 0 ? `${fmt(f.imprevus)} ${p ? `<span class="pct-tag">${p}%</span>` : ''}` : '—'}</td>`
          }).join('')}
        </tr>

        <!-- Section Chiffre d'affaires -->
        <tr class="row-sec-header">
          <td colspan="${1 + fluxList.length}">Chiffre d'affaires</td>
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Chiffre d'affaires (hors équipements)</td>
          ${fluxList.map((f) => {
            const val = f.ca_commercialisation ?? (f.annee === 0 ? 0 : f.ca)
            const idx = f.annee - 1
            const p = idx >= 0 ? rentaResult.repartition_ventes?.[idx] : undefined
            return `<td>${val > 0 ? `${fmt(val)} ${p ? `<span class="pct-tag">${p}%</span>` : ''}` : '—'}</td>`
          }).join('')}
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Frais de commercialisation</td>
          ${fluxList.map((f) => {
            const val = f.frais_commercialisation ?? f.commercialisation
            const idx = f.annee - 1
            const p = idx >= 0 ? rentaResult.repartition_ventes?.[idx] : undefined
            return `<td>${val > 0 ? `${fmt(val)} ${p ? `<span class="pct-tag">${p}%</span>` : ''}` : '—'}</td>`
          }).join('')}
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Ventes équipements publics</td>
          ${fluxList.map((f) => {
            const val = f.ca_equipement_public ?? (f.annee === 1 ? (rentaResult.ca?.ca_equipements ?? 0) : 0)
            const idx = f.annee - 1
            const p = idx >= 0 ? rentaResult.repartition_ventes_equipement?.[idx] : undefined
            return `<td>${val > 0 ? `${fmt(val)} ${p ? `<span class="pct-tag">${p}%</span>` : ''}` : '—'}</td>`
          }).join('')}
        </tr>
        <tr>
          <td style="text-align:left; font-weight:600;">Ventes équipements privés</td>
          ${fluxList.map((f) => {
            const val = f.ca_equipement_prive ?? (f.annee === 1 ? (rentaResult.ca?.ca_equipements_prives ?? 0) : 0)
            const idx = f.annee - 1
            const p = idx >= 0 ? rentaResult.repartition_ventes_equipement_prive?.[idx] : undefined
            return `<td>${val > 0 ? `${fmt(val)} ${p ? `<span class="pct-tag">${p}%</span>` : ''}` : '—'}</td>`
          }).join('')}
        </tr>

        <!-- Ligne Total Flux Net -->
        <tr class="row-net">
          <td style="text-align:left; font-weight:800;">Flux net de trésorerie (DH)</td>
          ${fluxList.map((f) => `<td>${fmt(f.flux_net)} DH</td>`).join('')}
        </tr>
      </tbody>
    </table>

    <!-- Pied de page -->
    <footer class="report-footer">
      <span>Plateforme WebSIG de Prospection Foncière — SIGMATOP SARL</span>
      <span>Document généré automatiquement à titre indicatif et décisionnel</span>
    </footer>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
`

  // Ouverture dans une nouvelle fenêtre pour impression / enregistrement PDF
  const printWindow = window.open('', '_blank', 'width=900,height=1000')
  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }
}

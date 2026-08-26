/** AHP — Analytic Hierarchy Process (client-side, feedback instantané). */

const RI_3 = 0.58

export interface AhpResult {
  poids: { accessibilite: number; positionnement: number; topographie: number }
  CR: number
  coherent: boolean
}

/**
 * Calcule les poids AHP à partir de 2 intensités consécutives + ordre des catégories.
 * @param intensites [a12, a23] — valeurs de Saaty pour les paires consécutives
 * @param ordre clés des catégories du plus important au moins important
 */
export function calculerPoidsAHP(
  intensites: [number, number],
  ordre: [string, string, string] = ['accessibilite', 'positionnement', 'topographie'],
): AhpResult {
  const [a12, a23] = intensites
  const a13 = a12 * a23

  const matrice: number[][] = [
    [1,     a12,   a13],
    [1/a12, 1,     a23],
    [1/a13, 1/a23, 1],
  ]

  const n = 3

  // Normalisation par colonnes
  const sommesCol = [0, 1, 2].map(c =>
    matrice.reduce((sum, row) => sum + row[c], 0)
  )

  const matriceNorm = matrice.map((row) =>
    row.map((val, c) => val / sommesCol[c])
  )

  // Poids = moyenne de chaque ligne
  const poidsArr = matriceNorm.map(row =>
    row.reduce((sum, v) => sum + v, 0) / n
  )

  // λmax
  const produit = matrice.map((row) =>
    row.reduce((sum, val, c) => sum + val * poidsArr[c], 0)
  )
  const lambdas = produit.map((v, r) => poidsArr[r] > 0 ? v / poidsArr[r] : 0)
  const lambdaMax = lambdas.reduce((s, v) => s + v, 0) / n

  const ci = (lambdaMax - n) / (n - 1)
  const cr = ci / RI_3

  // Mapper les poids selon l'ordre
  const poids: Record<string, number> = {}
  for (let i = 0; i < 3; i++) {
    poids[ordre[i]] = Math.round(poidsArr[i] * 1e6) / 1e6
  }

  return {
    poids: poids as AhpResult['poids'],
    CR: Math.round(cr * 1e6) / 1e6,
    coherent: cr < 0.10,
  }
}

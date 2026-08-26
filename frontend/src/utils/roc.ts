/** ROC — Rank Order Centroid (client-side, feedback instantané). */

const TABLEAU_ROC: Record<number, number[]> = {
  1: [1.000],
  2: [0.750, 0.250],
  3: [0.611, 0.278, 0.111],
  4: [0.521, 0.271, 0.146, 0.063],
  5: [0.457, 0.257, 0.156, 0.087, 0.043],
  6: [0.408, 0.242, 0.159, 0.101, 0.060, 0.030],
  7: [0.369, 0.229, 0.157, 0.107, 0.072, 0.044, 0.022],
  8: [0.338, 0.217, 0.153, 0.108, 0.078, 0.053, 0.032, 0.016],
}

function rocWeight(rang: number, n: number): number {
  let sum = 0
  for (let k = rang; k <= n; k++) {
    sum += 1 / k
  }
  return sum / n
}

function getPoids(n: number): number[] {
  if (TABLEAU_ROC[n]) return [...TABLEAU_ROC[n]]
  return Array.from({ length: n }, (_, i) => rocWeight(i + 1, n))
}

/**
 * Calcule les poids ROC à partir de l'ordre des critères.
 * @param ordre critères du plus important au moins important
 */
export function calculerPoidsROC(ordre: string[]): Record<string, number> {
  if (!ordre.length) return {}

  const poids = getPoids(ordre.length)
  const result: Record<string, number> = {}

  ordre.forEach((critere, i) => {
    result[critere] = Math.round(poids[i] * 1e6) / 1e6
  })

  return result
}

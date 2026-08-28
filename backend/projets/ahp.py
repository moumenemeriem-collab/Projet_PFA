"""Analytic Hierarchy Process (AHP) — pondération des 3 catégories.

Calcul pur sans effet de bord. Entrée : ordre des catégories + 2 intensités
consécutives (échelle de Saaty 1-9). La 3e comparaison (rang1 vs rang3) est
déduite automatiquement (a13 = a12 × a23), garantissant CR ≈ 0 par
construction. Sortie : poids normalisés + ratio de cohérence CR.
"""

from __future__ import annotations

import math

# Indice aléatoire pour n = 3 (Saaty)
_RI_3 = 0.58


def _construire_matrice(ordre: list[str], intensites: list[float]) -> list[list[float]]:
    """Construit la matrice 3×3 à partir de l'ordre des catégories et de 2 intensités.

    ordre: [cat_rang1, cat_rang2, cat_rang3] — du plus important au moins important.
    intensites: [a12, a23] — valeurs de Saaty pour les paires consécutives.
    a13 = a12 × a23 est déduit automatiquement.
    """
    a12, a23 = intensites
    a13 = a12 * a23
    return [
        [1.0,        a12,         a13],
        [1.0 / a12,  1.0,         a23],
        [1.0 / a13,  1.0 / a23,   1.0],
    ]


def calculer_poids_ahp(
    intensites: list[float],
    ordre: list[str] | None = None,
) -> dict:
    """Calcule les poids AHP pour 3 catégories à partir de 2 intensités consécutives.

    Args:
        intensites: [a12, a23] — valeurs de Saaty pour les paires consécutives
                    (rang1 vs rang2, rang2 vs rang3).
        ordre: optionnel, liste des clés de catégories dans l'ordre choisi
               [rang1, rang2, rang3]. Si non fourni, utilise l'ordre par défaut
               [positionnement, accessibilite, topographie].

    Returns:
        {
            "poids": {"accessibilite": float, "positionnement": float, "topographie": float},
            "CR": float,
            "coherent": bool,
        }
    """
    if len(intensites) != 2:
        raise ValueError("Il faut exactement 2 intensités consécutives pour n=3.")

    for c in intensites:
        if c <= 0:
            raise ValueError(f"Intensité invalide : {c}. Les valeurs doivent être > 0.")

    if ordre is None:
        ordre = ["positionnement", "accessibilite", "topographie"]

    if len(ordre) != 3:
        raise ValueError("L'ordre doit contenir exactement 3 catégories.")

    matrice = _construire_matrice(ordre, intensites)
    n = 3

    # Étape 1 : normalisation par colonnes
    sommes_col = [sum(matrice[r][c] for r in range(n)) for c in range(n)]
    matrice_norm = [
        [matrice[r][c] / sommes_col[c] for c in range(n)]
        for r in range(n)
    ]

    # Étape 2 : moyenne de chaque ligne = poids
    poids = [sum(matrice_norm[r]) / n for r in range(n)]

    # Étape 3 : calcul du ratio de cohérence CR
    # λmax = moyenne de (Matrice × vecteur_poids) / poids, par ligne
    produit = [sum(matrice[r][c] * poids[c] for c in range(n)) for r in range(n)]
    lambdas = [produit[r] / poids[r] if poids[r] > 0 else 0 for r in range(n)]
    lambda_max = sum(lambdas) / n

    ci = (lambda_max - n) / (n - 1) if n > 1 else 0
    cr = ci / _RI_3 if _RI_3 > 0 else 0

    # Mapper les poids according à l'ordre
    poids_dict = {}
    for i, cat in enumerate(ordre):
        poids_dict[cat] = round(poids[i], 6)

    return {
        "poids": poids_dict,
        "CR": round(cr, 6),
        "coherent": cr < 0.10,
    }

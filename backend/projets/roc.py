"""Rank Order Centroid (ROC) — pondération des sous-critères par catégorie.

Calcul pur sans effet de bord. Entrée : ordre des critères du plus important
au moins important. Sortie : dictionnaire {critere: poids} (somme = 1).

Formule : w_i = (1/n) × Σ(1/k) pour k = i à n
"""

from __future__ import annotations

# Table précalculée pour n = 1 à 8 (ROC weights by rank, 1-indexed)
# rang 1 = plus important, rang n = moins important
_TABLEAU_ROC: dict[int, list[float]] = {
    1: [1.000],
    2: [0.750, 0.250],
    3: [0.611, 0.278, 0.111],
    4: [0.521, 0.271, 0.146, 0.063],
    5: [0.457, 0.257, 0.156, 0.087, 0.043],
    6: [0.408, 0.242, 0.159, 0.101, 0.060, 0.030],
    7: [0.369, 0.229, 0.157, 0.107, 0.072, 0.044, 0.022],
    8: [0.338, 0.217, 0.153, 0.108, 0.078, 0.053, 0.032, 0.016],
}


def _roc_weight(rang: int, n: int) -> float:
    """Calcule le poids ROC exact pour un critère au rang `rang` (1-indexé) parmi `n`."""
    if n <= 0 or rang <= 0 or rang > n:
        return 0.0
    return sum(1.0 / k for k in range(rang, n + 1)) / n


def _get_poids(n: int) -> list[float]:
    """Retourne la liste des poids ROC pour n critères (rang 1 = index 0)."""
    if n in _TABLEAU_ROC:
        return list(_TABLEAU_ROC[n])
    # Au-delà de 8, calcul à la volée
    return [_roc_weight(i + 1, n) for i in range(n)]


def calculer_poids_roc(ordre_criteres: list[str]) -> dict[str, float]:
    """Calcule les poids ROC à partir de l'ordre des critères.

    Args:
        ordre_criteres: liste du plus important au moins important.

    Returns:
        { "Enseignement": 0.611, "Santé": 0.278, ... }  (somme ≈ 1.0)
    """
    if not ordre_criteres:
        return {}

    n = len(ordre_criteres)
    poids = _get_poids(n)

    resultat = {}
    for i, critere in enumerate(ordre_criteres):
        resultat[critere] = round(poids[i], 6)

    return resultat

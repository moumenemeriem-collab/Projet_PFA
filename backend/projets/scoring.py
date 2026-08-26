"""Agrégation SAW (Simple Additive Weighting) — score final par terrain.

Calcul pur sans effet de bord. Orchestre les poids AHP (catégories) et
ROC (sous-critères) pour produire un score composite par terrain.
"""

from __future__ import annotations

from .roc import calculer_poids_roc


# ---------------------------------------------------------------------------
# Calcul des poids globaux
# ---------------------------------------------------------------------------

def calculer_poids_globaux(
    poids_ahp: dict[str, float],
    ordres_roc: dict[str, list[str]],
) -> dict[str, dict[str, float]]:
    """Calcule les poids globaux = poids AHP catégorie × poids ROC local.

    Args:
        poids_ahp: {"accessibilite": 0.4, "positionnement": 0.35, "topographie": 0.25}
        ordres_roc: {
            "accessibilite": ["Enseignement", "Routes", "Santé"],
            "positionnement": ["Localisation", "Situation administrative"],
            "topographie": ["Pente"],
        }

    Returns:
        { "Enseignement": 0.244, "Routes": 0.122, "Santé": 0.034, ... }
    """
    poids_globaux = {}
    categories_avec_sous_criteres = set()

    for categorie, sous_criteres in ordres_roc.items():
        poids_cat = poids_ahp.get(categorie, 0)
        if not sous_criteres:
            continue

        categories_avec_sous_criteres.add(categorie)

        # Calculer les poids ROC locaux
        poids_roc = calculer_poids_roc(sous_criteres)

        for critere, poids_local in poids_roc.items():
            poids_globaux[critere] = poids_cat * poids_local

    # Vérifier si des catégories entières n'ont aucun sous-critère
    categories_manquantes = [
        cat for cat in poids_ahp
        if cat not in categories_avec_sous_criteres
    ]

    # Redistribution proportionnelle du poids des catégories vides
    if categories_manquantes and poids_globaux:
        poids_redistribue = sum(poids_ahp[cat] for cat in categories_manquantes)
        poids_actuel_total = sum(poids_globaux.values())

        if poids_actuel_total > 0:
            facteur = (poids_actuel_total + poids_redistribue) / poids_actuel_total
            for critere in poids_globaux:
                poids_globaux[critere] = round(poids_globaux[critere] * facteur, 6)

    # Renormaliser pour que la somme = 1
    total = sum(poids_globaux.values())
    if total > 0:
        poids_globaux = {k: round(v / total, 6) for k, v in poids_globaux.items()}

    return poids_globaux


# ---------------------------------------------------------------------------
# Score SAW par terrain
# ---------------------------------------------------------------------------

def calculer_score_terrain(
    scores_normalises: dict[str, float],
    poids_globaux: dict[str, float],
) -> float:
    """Calcule le score SAW d'un terrain.

    score = Σ (poids_global_i × score_normalisé_i)

    Args:
        scores_normalises: { "Enseignement": 0.85, "Pente": 1.0, ... }
        poids_globaux: { "Enseignement": 0.244, "Pente": 0.25, ... }

    Returns:
        Score composite dans [0, 1].
    """
    score = 0.0
    for critere, poids in poids_globaux.items():
        s = scores_normalises.get(critere, 0.0)
        score += poids * s
    return round(score, 6)


def calculer_contributions(
    scores_normalises: dict[str, float],
    poids_globaux: dict[str, float],
) -> list[dict]:
    """Calcule la contribution de chaque critère au score total.

    Returns:
        [{ "critere": "Enseignement", "poids": 0.244, "score": 0.85,
           "contribution": 0.207 }, ...]
    """
    contributions = []
    for critere, poids in poids_globaux.items():
        s = scores_normalises.get(critere, 0.0)
        contributions.append({
            "critere": critere,
            "poids": poids,
            "score": s,
            "contribution": round(poids * s, 6),
        })
    contributions.sort(key=lambda x: x["contribution"], reverse=True)
    return contributions


# ---------------------------------------------------------------------------
# Classement et filtrage
# ---------------------------------------------------------------------------

def classer_et_filtrer(
    terrains: list[dict],
    poids_globaux: dict[str, float],
    seuil: float = 0.0,
) -> list[dict]:
    """Classe les terrains par score décroissant et filtre par seuil.

    Args:
        terrains: liste de dicts, chacun ayant 'id' et 'scores_normalises'
        poids_globaux: poids globaux calculés
        seuil: score minimum pour être retenu (0.0 = pas de filtre)

    Returns:
        Liste triée par score décroissant, chaque terrain enrichi avec
        'score_final' et 'contributions'.
    """
    resultats = []

    for terrain in terrains:
        scores_norm = terrain.get('scores_normalises', {})
        score = calculer_score_terrain(scores_norm, poids_globaux)

        if score < seuil:
            continue

        contributions = calculer_contributions(scores_norm, poids_globaux)

        resultats.append({
            **terrain,
            'score_final': score,
            'contributions': contributions,
        })

    resultats.sort(key=lambda x: x['score_final'], reverse=True)

    for i, r in enumerate(resultats):
        r['rang'] = i + 1

    return resultats

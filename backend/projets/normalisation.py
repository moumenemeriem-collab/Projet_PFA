"""Normalisation des critères — score 0-1 par terrain.

Calcul pur sans effet de bord. Chaque sous-critère est transformé en
un score dans [0, 1] par terrain, sans demande de seuil à l'utilisateur.

- Équipements / Routes : min-max sur les distances réelles
- Localisation / Situation administrative : binaire (0 ou 1)
- Pente : binaire (0 ou 1) selon la plage choisie
"""

from __future__ import annotations

import math


# ---------------------------------------------------------------------------
# Normalisation min-max pour les distances
# ---------------------------------------------------------------------------

def normaliser_distances(distances: dict[str, float]) -> dict[str, float]:
    """Normalise un dict {terrain_id: distance} en scores 0-1 (min-max inversé).

    Le terrain le plus proche (distance min) obtient 1.0,
    le plus éloigné (distance max) obtient 0.0.
    """
    if not distances:
        return {}

    valeurs = list(distances.values())
    d_min = min(valeurs)
    d_max = max(valeurs)
    span = d_max - d_min

    if span < 1e-10:
        # Toutes les distances sont identiques → score 1.0 pour tous
        return {k: 1.0 for k in distances}

    return {
        k: round((d_max - v) / span, 6)
        for k, v in distances.items()
    }


def normaliser_distances_par_categorie(
    terrains_dist: dict[str, dict[str, float]],
) -> dict[str, dict[str, float]]:
    """Normalise les distances pour plusieurs catégories.

    Args:
        terrains_dist: { "enseignement": {terrain_id: distance}, "sante": {...}, ... }

    Returns:
        { "enseignement": {terrain_id: score}, ... }
    """
    return {cat: normaliser_distances(dists) for cat, dists in terrains_dist.items()}


# ---------------------------------------------------------------------------
# Scores binaires (localisation, situation administrative, pente)
# ---------------------------------------------------------------------------

def score_binaire(condition: bool) -> float:
    """Score binaire : 1.0 si la condition est vraie, 0.0 sinon."""
    return 1.0 if condition else 0.0


def score_localisation(zone_terrain: str, choix_utilisateur: str | list[str]) -> float:
    """Score pour la localisation (centre-ville, périphérie, zone rurale).

    Args:
        zone_terrain: zone calculée du terrain ('centre_ville', 'periurbaine', 'rurale')
        choix_utilisateur: zone(s) choisie(s) par l'utilisateur
    """
    if isinstance(choix_utilisateur, str):
        choix_utilisateur = [choix_utilisateur]
    return score_binaire(zone_terrain in choix_utilisateur)


def score_situation_administrative(
    dans_perimetre: bool, choix_utilisateur: str
) -> float:
    """Score pour la situation administrative (intra/extra périmètre urbain).

    Args:
        dans_perimetre: True si le terrain est à l'intérieur du périmètre
        choix_utilisateur: 'intra_perimetre' ou 'extra_perimetre'
    """
    if choix_utilisateur == 'intra_perimetre':
        return score_binaire(dans_perimetre)
    return score_binaire(not dans_perimetre)


def score_pente(pente_terrain: float | None, plages_choisies: list[str]) -> float:
    """Score pour la pente selon les plages sélectionnées.

    Args:
        pente_terrain: pente en % du terrain (None si inconnue)
        plages_choisies: ['0_5', '5_10', '10_15', 'gt15']
    """
    if pente_terrain is None or not plages_choisies:
        return 0.0

    plages = {
        '0_5': (0, 5),
        '5_10': (5, 10),
        '10_15': (10, 15),
        'gt15': (15, 100),
    }

    for plage_key in plages_choisies:
        lo, hi = plages.get(plage_key, (0, 100))
        if lo <= pente_terrain <= hi:
            return 1.0

    return 0.0


# ---------------------------------------------------------------------------
# Agrégation des scores par terrain
# ---------------------------------------------------------------------------

def normaliser_terrain(
    terrain_id: str,
    distances_par_categorie: dict[str, float] | None,
    choix_localisation: str | list[str] | None,
    zone_terrain: str | None,
    choix_situation_admin: str | None,
    dans_perimetre: bool | None,
    pente_terrain: float | None,
    plages_pente: list[str] | None,
    criteres_actifs: dict[str, bool],
) -> dict[str, float]:
    """Calcule les scores normalisés (0-1) pour un terrain donné.

    Args:
        terrain_id: identifiant du terrain
        distances_par_categorie: { "enseignement": distance, "sante": distance, ... }
        choix_localisation: choix radio de l'utilisateur
        zone_terrain: zone calculée du terrain
        choix_situation_admin: choix radio
        dans_perimetre: résultat du calcul SIG
        pente_terrain: pente en %
        plages_pente: plages choisies
        criteres_actifs: { "enseignement": True, "sante": False, ... }

    Returns:
        { "enseignement": 0.85, "localisation": 1.0, "pente": 0.0, ... }
    """
    scores = {}

    # Distance-based criteria
    if distances_par_categorie:
        for cat, dist in distances_par_categorie.items():
            if criteres_actifs.get(cat, False):
                scores[cat] = dist  # déjà normalisé en amont

    # Localisation
    if criteres_actifs.get('localisation', False) and zone_terrain and choix_localisation:
        scores['localisation'] = score_localisation(zone_terrain, choix_localisation)

    # Situation administrative
    if (criteres_actifs.get('situation_administrative', False)
            and dans_perimetre is not None and choix_situation_admin):
        scores['situation_administrative'] = score_situation_administrative(
            dans_perimetre, choix_situation_admin
        )

    # Pente
    if criteres_actifs.get('pente', False) and pente_terrain is not None and plages_pente:
        scores['pente'] = score_pente(pente_terrain, plages_pente)

    return scores

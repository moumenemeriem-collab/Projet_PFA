"""Normalisation des critères — score 0-1 par terrain.

Calcul pur sans effet de bord. Chaque sous-critère est transformé en
un score dans [0, 1] par terrain, sans demande de seuil à l'utilisateur.

- Équipements / Routes : min-max sur les distances réelles
- Localisation : binaire (0 ou 1)
- Altitude : binaire (0 ou 1) selon la plage choisie
"""

from __future__ import annotations


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
# Scores binaires (localisation, altitude)
# ---------------------------------------------------------------------------

def score_binaire(condition: bool) -> float:
    """Score binaire : 1.0 si la condition est vraie, 0.0 sinon."""
    return 1.0 if condition else 0.0


def score_localisation(zone_terrain: str | None, choix_utilisateur: str | list[str]) -> float:
    """Score pour la localisation (centre-ville, périphérie).

    Args:
        zone_terrain: zone calculée du terrain ('centre_ville', 'periurbaine'),
            ou None si indéterminée (centroïde hors de toute zone du plan d'aménagement).
        choix_utilisateur: zone(s) choisie(s) par l'utilisateur
    """
    if zone_terrain is None:
        return 0.0
    if isinstance(choix_utilisateur, str):
        choix_utilisateur = [choix_utilisateur]
    return score_binaire(zone_terrain in choix_utilisateur)


def score_altitude(altitude_terrain: float | None, plages_choisies: list[str]) -> float:
    """Score pour l'altitude selon les plages sélectionnées.

    Args:
        altitude_terrain: altitude (m) du terrain (None si inconnue)
        plages_choisies: ['lt100', '100_300', 'gt300']
    """
    if altitude_terrain is None or not plages_choisies:
        return 0.0

    for plage_key in plages_choisies:
        if plage_key == 'lt100' and altitude_terrain < 100:
            return 1.0
        if plage_key == '100_300' and 100 <= altitude_terrain <= 300:
            return 1.0
        if plage_key == 'gt300' and altitude_terrain > 300:
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
    altitude_terrain: float | None,
    plages_altitude: list[str] | None,
    criteres_actifs: dict[str, bool],
) -> dict[str, float]:
    """Calcule les scores normalisés (0-1) pour un terrain donné.

    Args:
        terrain_id: identifiant du terrain
        distances_par_categorie: { "enseignement": distance, "sante": distance, ... }
        choix_localisation: choix radio de l'utilisateur
        zone_terrain: zone calculée du terrain
        altitude_terrain: altitude en m
        plages_altitude: plages choisies
        criteres_actifs: { "enseignement": True, "sante": False, ... }

    Returns:
        { "enseignement": 0.85, "localisation": 1.0, "altitude": 0.0, ... }
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

    # Altitude
    if criteres_actifs.get('altitude', False) and altitude_terrain is not None and plages_altitude:
        scores['altitude'] = score_altitude(altitude_terrain, plages_altitude)

    return scores

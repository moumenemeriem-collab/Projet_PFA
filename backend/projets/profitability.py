"""
Service centralisé de calcul de rentabilité immobilière.

Reçoit les données du projet et retourne un objet complet contenant
surfaces, revenus, coûts, charges, flux annuels, VAN, TRI/IRR et ROI.
"""
from __future__ import annotations

import math


def _d(s) -> float:
    """Convertit en float avec fallback 0."""
    if s is None:
        return 0.0
    return float(s)


def _irr(flows: list[float], max_iter: int = 200, tol: float = 1e-8) -> float | None:
    """
    Calcule le TRI (IRR) par la méthode de Newton-Raphson.
    Retourne None si le TRI ne peut pas être calculé.
    """
    if len(flows) < 2:
        return None

    has_negative = any(f < 0 for f in flows)
    has_positive = any(f > 0 for f in flows)
    if not has_negative or not has_positive:
        return None

    rate = 0.1
    for _ in range(max_iter):
        npv = sum(f / (1 + rate) ** n for n, f in enumerate(flows))
        dnpv = sum(-n * f / (1 + rate) ** (n + 1) for n, f in enumerate(flows))
        if abs(dnpv) < 1e-14:
            break
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < tol:
            return new_rate
        rate = new_rate
        if rate < -0.99 or rate > 10:
            return None

    if abs(sum(f / (1 + rate) ** n for n, f in enumerate(flows))) > 0.01:
        return None
    return rate


def _van(flows: list[float], taux: float) -> float:
    """Calcule la VAN (Valeur Actuelle Nette)."""
    r = float(taux) / 100.0
    return sum(f / (1 + r) ** n for n, f in enumerate(flows))


def calculer_rentabilite_projet(projet) -> dict:
    """
    Fonction principale de calcul de rentabilité.
    Recoit une instance Projet et retourne un dict complet avec les résultats.
    """
    p = projet

    # ── 1. Données foncières ──
    surface_brute = _d(p.surface_souhaitee)
    prix_m2 = _d(p.prix_foncier_m2)
    frais_acq_pct = _d(p.frais_acquisition) / 100.0
    taux_chute_pct = _d(p.taux_chute) / 100.0
    cos = _d(p.cos)
    cus = _d(p.cus)

    # ── 2. Surfaces ──
    shon = surface_brute * cos if cos > 0 else 0
    shob = shon * 1.2
    surface_vendable = shon * 0.9

    # ── 3. Répartition par destination ──
    qp_apt = _d(p.quote_part_appartement) / 100.0
    qp_com = _d(p.quote_part_commerce) / 100.0
    qp_bur = _d(p.quote_part_bureau) / 100.0
    qp_eq = _d(getattr(p, 'quote_part_equipement', None)) / 100.0

    surf_apt = surface_vendable * qp_apt
    surf_com = surface_vendable * qp_com
    surf_bur = surface_vendable * qp_bur
    surf_eq = surface_vendable * qp_eq

    # ── 4. Chiffre d'affaires ──
    px_vente_apt = _d(p.prix_vente_appartement)
    px_vente_com = _d(p.prix_vente_commerce)
    px_vente_bur = _d(p.prix_vente_bureau)
    px_vente_eq = _d(getattr(p, 'prix_vente_equipement', None))

    ca_apt = surf_apt * px_vente_apt
    ca_com = surf_com * px_vente_com
    ca_bur = surf_bur * px_vente_bur
    ca_eq = surf_eq * px_vente_eq
    ca_total = ca_apt + ca_com + ca_bur + ca_eq

    # ── 5. Coûts de construction ──
    cout_apt = surf_apt * _d(p.cout_construction_appartement)
    cout_com = surf_com * _d(p.cout_construction_commerce)
    cout_bur = surf_bur * _d(p.cout_construction_bureau)
    cout_eq = surf_eq * _d(getattr(p, 'cout_construction_equipement', None))
    cout_construction_total = cout_apt + cout_com + cout_bur + cout_eq

    # ── 6. Charges ──
    taux_etudes = _d(p.taux_etudes_honoraires) / 100.0
    taux_imprevus = _d(p.taux_imprevus) / 100.0
    taux_comm = _d(p.taux_commercialisation) / 100.0

    frais_etudes = cout_construction_total * taux_etudes
    imprevus = cout_construction_total * taux_imprevus
    frais_commercialisation = ca_total * taux_comm

    # ── 7. Prix d'acquisition foncier ──
    prix_foncier = prix_m2 * surface_brute
    frais_acquisition_montant = prix_foncier * frais_acq_pct
    cout_acquisition = prix_foncier + frais_acquisition_montant

    # ── 8. Coût total du projet ──
    cout_total_projet = (
        cout_acquisition
        + cout_construction_total
        + frais_etudes
        + imprevus
    )

    # ── 9. Paramètres temporels ──
    duree_cons = max(int(p.duree_construction), 1)
    duree_comm = max(int(p.duree_commercialisation), 2)
    nb_annees = duree_cons + duree_comm

    # ── 10. Échelonnement construction (répartition uniforme par défaut) ──
    # Défaut : 50/50 pour 2 ans, répartition égale sinon
    rep_cons = p.repartition_construction
    if not rep_cons or not isinstance(rep_cons, list) or len(rep_cons) != duree_cons:
        rep_cons = [round(100.0 / duree_cons, 2)] * duree_cons

    # ── 11. Échelonnement ventes ──
    # Défaut : 30% / 30% / 40% pour 3 ans
    rep_ventes = p.repartition_ventes
    if not rep_ventes or not isinstance(rep_ventes, list) or len(rep_ventes) != duree_comm:
        if duree_comm == 3:
            rep_ventes = [30.0, 30.0, 40.0]
        else:
            rep_ventes = []
            for i in range(duree_comm):
                if i == 0:
                    rep_ventes.append(30.0)
                elif i == duree_comm - 1:
                    rep_ventes.append(40.0)
                else:
                    rep_ventes.append(30.0)
        total_def = sum(rep_ventes)
        if abs(total_def - 100) > 0.01 and total_def > 0:
            rep_ventes = [round(r * 100.0 / total_def, 2) for r in rep_ventes]

    # ── 12. Tableau des flux ──
    flux = []
    for annee in range(nb_annees):
        # CA (pendant commercialisation, après construction)
        ca_annee = 0.0
        idx_comm = annee - duree_cons
        if 0 <= idx_comm < duree_comm:
            ca_annee = ca_total * rep_ventes[idx_comm] / 100.0

        # Acquisition foncier (année 0 uniquement)
        acq_annee = cout_acquisition if annee == 0 else 0.0

        # Construction (répartie sur duree_cons années à partir de l'année 0)
        cons_annee = 0.0
        if 0 <= annee < duree_cons:
            cons_annee = cout_construction_total * rep_cons[annee] / 100.0

        # Études (même échelonnement que construction)
        etudes_annee = frais_etudes * rep_cons[annee] / 100.0 if 0 <= annee < duree_cons else 0.0

        # Imprévus (même échelonnement que construction)
        imp_annee = imprevus * rep_cons[annee] / 100.0 if 0 <= annee < duree_cons else 0.0

        # Commercialisation (même échelonnement que ventes)
        comm_annee = frais_commercialisation * rep_ventes[idx_comm] / 100.0 if 0 <= idx_comm < duree_comm else 0.0

        flux_net = ca_annee - acq_annee - cons_annee - etudes_annee - imp_annee - comm_annee

        flux.append({
            'annee': annee,
            'ca': round(ca_annee, 2),
            'acquisition': round(acq_annee, 2),
            'construction': round(cons_annee, 2),
            'etudes_honoraires': round(etudes_annee, 2),
            'imprevus': round(imp_annee, 2),
            'commercialisation': round(comm_annee, 2),
            'flux_net': round(flux_net, 2),
        })

    # ── 13. VAN, TRI, ROI ──
    flux_nets = [f['flux_net'] for f in flux]
    taux_actualisation = _d(p.taux_actualisation)
    van = _van(flux_nets, taux_actualisation)
    tri = _irr(flux_nets)

    benefice_net = sum(flux_nets)
    roi = (benefice_net / cout_total_projet * 100) if cout_total_projet > 0 else None

    return {
        'ok': True,
        'surfaces': {
            'surface_brute': round(surface_brute, 2),
            'shon': round(shon, 2),
            'shob': round(shob, 2),
            'surface_vendable': round(surface_vendable, 2),
            'surface_appartements': round(surf_apt, 2),
            'surface_commerces': round(surf_com, 2),
            'surface_bureaux': round(surf_bur, 2),
            'surface_equipements': round(surf_eq, 2),
        },
        'ca': {
            'ca_appartements': round(ca_apt, 2),
            'ca_commerces': round(ca_com, 2),
            'ca_bureaux': round(ca_bur, 2),
            'ca_equipements': round(ca_eq, 2),
            'ca_total': round(ca_total, 2),
        },
        'construction': {
            'cout_appartements': round(cout_apt, 2),
            'cout_commerces': round(cout_com, 2),
            'cout_bureaux': round(cout_bur, 2),
            'cout_equipements': round(cout_eq, 2),
            'cout_total': round(cout_construction_total, 2),
        },
        'charges': {
            'frais_etudes': round(frais_etudes, 2),
            'imprevus': round(imprevus, 2),
            'frais_commercialisation': round(frais_commercialisation, 2),
        },
        'acquisition': {
            'prix_foncier': round(prix_foncier, 2),
            'frais_acquisition': round(frais_acquisition_montant, 2),
            'cout_total': round(cout_acquisition, 2),
        },
        'cout_total_projet': round(cout_total_projet, 2),
        'benefice_net': round(benefice_net, 2),
        'roi': round(roi, 2) if roi is not None else None,
        'van': round(van, 2),
        'tri': round(tri * 100, 2) if tri is not None else None,
        'flux': flux,
        'repartition_construction': rep_cons,
        'repartition_ventes': rep_ventes,
    }

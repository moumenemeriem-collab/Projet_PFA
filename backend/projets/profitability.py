"""
Service centralisé de calcul de rentabilité immobilière.

Reçoit les données du projet et retourne un objet complet contenant
surfaces, revenus, coûts, charges, flux annuels, VAN, TRI/IRR et ROI.

CORRECTIONS APPORTÉES (par rapport à la version initiale) :
1. La commercialisation démarre 1 an après le lancement du projet
   (annee == 1), et non après la fin complète de la construction.
   -> idx_comm = annee - 1  (au lieu de annee - duree_cons)
2. nb_annees couvre la construction ET la commercialisation qui
   démarre en année 1 :
   -> nb_annees = max(duree_cons, 1 + duree_comm)
3. La CA des équipements ("CA eq") a son propre échéancier
   (ligne 44 du fichier Excel : 100% en année 1 par défaut),
   distinct de l'échéancier CA classique (30/30/40).
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
    Reçoit une instance Projet et retourne un dict complet avec les résultats.
    """
    p = projet

    # ── 1. Données foncières ──
    # Surface brute = surface totale réelle du projet (parcelle/polygone).
    # Si non fournie, repli sur la surface souhaitée.
    surface_totale = _d(getattr(p, 'surface_totale', None))
    surface_brute = surface_totale if surface_totale > 0 else _d(p.surface_souhaitee)
    prix_m2 = _d(p.prix_foncier_m2)
    frais_acq_pct = _d(p.frais_acquisition) / 100.0
    taux_chute_pct = _d(p.taux_chute) / 100.0
    cos = _d(p.cos)
    cus = _d(p.cus)

    # ── 2. Surfaces ──
    surface_voie = _d(getattr(p, 'surface_voie', None))
    surface_espace_vert = _d(getattr(p, 'surface_espace_vert', None))
    surface_constructible = _d(getattr(p, 'surface_constructible', None))
    if surface_constructible <= 0:
        surface_constructible = surface_brute

    has_voie_ou_espace_vert = (surface_voie > 0 or surface_espace_vert > 0)
    if has_voie_ou_espace_vert:
        shon = cos * surface_constructible * (1.0 - taux_chute_pct)
        shob = shon * 1.2
        surface_vendable = shon * 0.9
        surface_a_amenager = surface_voie + surface_espace_vert + (taux_chute_pct * surface_constructible)
    else:
        shon = cos * surface_constructible
        shob = shon * 1.2
        surface_vendable = shon * 0.9
        surface_a_amenager = 0.0

    # ── 3. Répartition par destination ──
    qp_apt = _d(p.quote_part_appartement) / 100.0
    qp_com = _d(p.quote_part_commerce) / 100.0
    qp_bur = _d(p.quote_part_bureau) / 100.0

    # La surface vendable est réservée exclusivement aux appartements, commerces et bureaux
    surf_apt = surface_vendable * qp_apt
    surf_com = surface_vendable * qp_com
    surf_bur = surface_vendable * qp_bur

    # Les équipements ont une surface définie propre et ne prennent pas de la surface vendable
    surf_eq = _d(getattr(p, 'surface_equipement', None))
    surf_eq_prive = _d(getattr(p, 'surface_equipement_prive', None))

    # ── 4. Chiffre d'affaires ──
    px_vente_apt = _d(p.prix_vente_appartement)
    px_vente_com = _d(p.prix_vente_commerce)
    px_vente_bur = _d(p.prix_vente_bureau)
    px_vente_eq = _d(getattr(p, 'prix_vente_equipement', None))
    px_vente_eq_prive = _d(getattr(p, 'prix_vente_equipement_prive', None))

    ca_apt = surf_apt * px_vente_apt
    ca_com = surf_com * px_vente_com
    ca_bur = surf_bur * px_vente_bur
    ca_eq = surf_eq * px_vente_eq
    ca_eq_prive = surf_eq_prive * px_vente_eq_prive
    ca_hors_eq = ca_apt + ca_com + ca_bur

    # Les frais de commercialisation s'ajoutent au CA (ne sont pas des charges)
    taux_comm = _d(p.taux_commercialisation) / 100.0
    frais_commercialisation = (ca_hors_eq + ca_eq + ca_eq_prive) * taux_comm
    ca_total = ca_hors_eq + ca_eq + ca_eq_prive + frais_commercialisation

    # ── 5. Coûts de construction ──
    # Les équipements n'ont pas de coût de construction
    cout_apt = surf_apt * _d(p.cout_construction_appartement)
    cout_com = surf_com * _d(p.cout_construction_commerce)
    cout_bur = surf_bur * _d(p.cout_construction_bureau)
    cout_eq = 0.0
    cout_eq_prive = 0.0
    cout_construction_total = cout_apt + cout_com + cout_bur

    # ── 6. Charges ──
    taux_etudes = _d(p.taux_etudes_honoraires) / 100.0
    taux_imprevus = _d(p.taux_imprevus) / 100.0

    frais_etudes = cout_construction_total * taux_etudes
    imprevus = cout_construction_total * taux_imprevus

    # ── 6bis. Charge d'aménagement (échelonnement aménagement) ──
    cout_amenagement = 600 * surface_a_amenager * 1.1

    # ── 7. Prix d'acquisition foncier ──
    # Prix / m² * surface brute du foncier * (1 + frais d'acquisition)
    # surface_brute = surface totale réelle du projet issue de la parcelle
    prix_foncier = prix_m2 * surface_brute
    frais_acquisition_montant = prix_foncier * frais_acq_pct
    cout_acquisition = prix_foncier + frais_acquisition_montant

    # ── 8. Coût total du projet ──
    # Les frais de commercialisation ne sont pas inclus dans les charges
    cout_total_projet = (
        cout_acquisition
        + cout_construction_total
        + frais_etudes
        + imprevus
        + cout_amenagement
    )

    # ── 9. Paramètres temporels ──
    duree_cons = max(int(p.duree_construction), 1)
    duree_comm = max(int(p.duree_commercialisation), 2)

    # La construction et charges associées s'étalent sur au moins 2 années (50% An 0, 50% An 1 si duree <= 2)
    duree_cons_effective = max(duree_cons, 2) if duree_cons <= 2 else duree_cons

    # La commercialisation démarre toujours avec un décalage d'1 an (en année 1).
    # nb_annees couvre l'horizon maximal entre fin des charges et fin de la commercialisation.
    nb_annees = max(duree_cons_effective, 1 + duree_comm)

    # ── 10. Échelonnement construction (50/50 pour <= 2 ans, uniforme sinon) ──
    rep_cons = p.repartition_construction
    if not rep_cons or not isinstance(rep_cons, list) or len(rep_cons) != duree_cons_effective:
        if duree_cons_effective == 2:
            rep_cons = [50.0, 50.0]
        else:
            rep_cons = [round(100.0 / duree_cons_effective, 2)] * duree_cons_effective
            diff = round(100.0 - sum(rep_cons), 2)
            if abs(diff) > 0.001:
                rep_cons[-1] = round(rep_cons[-1] + diff, 2)

    # ── 11. Échelonnement ventes (hors équipement, démarre en Année 1) ──
    rep_ventes = p.repartition_ventes
    if not rep_ventes or not isinstance(rep_ventes, list) or len(rep_ventes) != duree_comm:
        if duree_comm == 2:
            rep_ventes = [50.0, 50.0]
        elif duree_comm == 3:
            rep_ventes = [30.0, 30.0, 40.0]
        elif duree_comm == 4:
            rep_ventes = [25.0, 25.0, 25.0, 25.0]
        else:
            rep_ventes = [round(100.0 / duree_comm, 2)] * duree_comm
            diff = round(100.0 - sum(rep_ventes), 2)
            if abs(diff) > 0.001:
                rep_ventes[-1] = round(rep_ventes[-1] + diff, 2)

    # ── 11bis. Échelonnement CA équipement (100% en Année 1) ──
    rep_ventes_eq = getattr(p, 'repartition_ventes_equipement', None)
    if not rep_ventes_eq or not isinstance(rep_ventes_eq, list) or len(rep_ventes_eq) != duree_comm:
        rep_ventes_eq = [0.0] * duree_comm
        rep_ventes_eq[0] = 100.0

    rep_ventes_eq_prive = getattr(p, 'repartition_ventes_equipement_prive', None)
    if not rep_ventes_eq_prive or not isinstance(rep_ventes_eq_prive, list) or len(rep_ventes_eq_prive) != duree_comm:
        rep_ventes_eq_prive = [0.0] * duree_comm
        rep_ventes_eq_prive[0] = 100.0

    # ── 12. Tableau des flux ──
    flux = []
    for annee in range(nb_annees):
        idx_comm = annee - 1

        # CA hors équipement
        ca_hors_eq_annee = 0.0
        if 0 <= idx_comm < duree_comm:
            ca_hors_eq_annee = ca_hors_eq * rep_ventes[idx_comm] / 100.0

        # CA équipement public (100% en Année 1)
        ca_eq_annee = 0.0
        if 0 <= idx_comm < duree_comm:
            ca_eq_annee = ca_eq * rep_ventes_eq[idx_comm] / 100.0

        # CA équipement privé (100% en Année 1)
        ca_eq_prive_annee = 0.0
        if 0 <= idx_comm < duree_comm:
            ca_eq_prive_annee = ca_eq_prive * rep_ventes_eq_prive[idx_comm] / 100.0

        # Commercialisation (s'ajoute au CA)
        comm_annee = 0.0
        if 0 <= idx_comm < duree_comm:
            comm_annee = frais_commercialisation * rep_ventes[idx_comm] / 100.0

        ca_annee = ca_hors_eq_annee + ca_eq_annee + ca_eq_prive_annee + comm_annee

        # Acquisition foncier (Année 0 uniquement)
        acq_annee = cout_acquisition if annee == 0 else 0.0

        # Construction & charges associées (réparties sur duree_cons_effective à partir de l'année 0)
        cons_annee = 0.0
        etudes_annee = 0.0
        imp_annee = 0.0
        if 0 <= annee < duree_cons_effective:
            pct_cons = rep_cons[annee] / 100.0
            cons_annee = cout_construction_total * pct_cons
            etudes_annee = frais_etudes * pct_cons
            imp_annee = imprevus * pct_cons

        # Aménagement (100% en Année 0)
        amenagement_annee = cout_amenagement if annee == 0 else 0.0

        # Total des charges (SANS frais de commercialisation)
        total_charges_annee = acq_annee + amenagement_annee + cons_annee + etudes_annee + imp_annee
        flux_net = ca_annee - total_charges_annee

        cons_imp_etudes_annee = cons_annee + etudes_annee + imp_annee
        ca_eq_total_annee = ca_eq_annee + ca_eq_prive_annee

        flux.append({
            'annee': annee,
            'ca_commercialisation': round(ca_hors_eq_annee, 2),
            'ca_equipement_public': round(ca_eq_annee, 2),
            'ca_equipement_prive': round(ca_eq_prive_annee, 2),
            'ca_equipements': round(ca_eq_total_annee, 2),
            'frais_commercialisation': round(comm_annee, 2),
            'ca_total': round(ca_annee, 2),
            'ca': round(ca_annee, 2),
            'acquisition': round(acq_annee, 2),
            'construction': round(cons_annee, 2),
            'etudes_honoraires': round(etudes_annee, 2),
            'imprevus': round(imp_annee, 2),
            'autre_charge': round(cons_imp_etudes_annee, 2),
            'commercialisation': 0.0,
            'amenagement': round(amenagement_annee, 2),
            'total_charges': round(total_charges_annee, 2),
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
            'surface_equipements_prives': round(surf_eq_prive, 2),
            'surface_voie': round(surface_voie, 2),
            'surface_espace_vert': round(surface_espace_vert, 2),
            'surface_a_amenager': round(surface_a_amenager, 2),
        },
        'ca': {
            'ca_appartements': round(ca_apt, 2),
            'ca_commerces': round(ca_com, 2),
            'ca_bureaux': round(ca_bur, 2),
            'ca_equipements': round(ca_eq, 2),
            'ca_equipements_prives': round(ca_eq_prive, 2),
            'ca_total': round(ca_total, 2),
        },
        'construction': {
            'cout_appartements': round(cout_apt, 2),
            'cout_commerces': round(cout_com, 2),
            'cout_bureaux': round(cout_bur, 2),
            'cout_equipements': round(cout_eq, 2),
            'cout_equipements_prives': round(cout_eq_prive, 2),
            'cout_total': round(cout_construction_total, 2),
        },
        'charges': {
            'frais_etudes': round(frais_etudes, 2),
            'imprevus': round(imprevus, 2),
            'frais_commercialisation': round(frais_commercialisation, 2),
            'amenagement': round(cout_amenagement, 2),
            'cout_acquisition_foncier': round(cout_acquisition, 2),
        },
        'acquisition': {
            'prix_foncier': round(prix_foncier, 2),
            'frais_acquisition': round(frais_acquisition_montant, 2),
            'cout_total': round(cout_acquisition, 2),
        },
        'parametres': {
            'prix_foncier_m2': round(prix_m2, 2),
            'frais_acquisition_pct': round(frais_acq_pct * 100, 2),
            'taux_chute_pct': round(taux_chute_pct * 100, 2),
            'cos': round(cos, 2),
            'cus': round(cus, 2),
            'taux_etudes_pct': round(taux_etudes * 100, 2),
            'taux_imprevus_pct': round(taux_imprevus * 100, 2),
            'taux_commercialisation_pct': round(taux_comm * 100, 2),
            'taux_actualisation_pct': round(taux_actualisation, 2),
            'duree_construction': duree_cons,
            'duree_commercialisation': duree_comm,
        },
        'cout_total_projet': round(cout_total_projet, 2),
        'benefice_net': round(benefice_net, 2),
        'roi': round(roi, 2) if roi is not None else None,
        'van': round(van, 2),
        'tri': round(tri * 100, 2) if tri is not None else None,
        'flux': flux,
        'repartition_construction': rep_cons,
        'repartition_ventes': rep_ventes,
        'repartition_ventes_equipement': rep_ventes_eq,
        'repartition_ventes_equipement_prive': rep_ventes_eq_prive,
    }
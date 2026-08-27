"""Tests unitaires du service de calcul de rentabilité.

Ces tests n'utilisent pas la base de données : la fonction
``calculer_rentabilite_projet`` reçoit un objet dont on simule les
attributs via ``SimpleNamespace`` (même approche que l'endpoint de
preview ``ProjetRentabilitePreviewView``).
"""
from types import SimpleNamespace

from django.test import SimpleTestCase

from .profitability import calculer_rentabilite_projet


def _projet(**overrides):
    """Construit un objet projet factice avec des valeurs par défaut."""
    base = {
        'surface_souhaitee': 10000,
        'prix_foncier_m2': 4000,
        'frais_acquisition': 7,
        'taux_chute': 30,
        'cos': 1.0,
        'cus': 3,
        'quote_part_appartement': 100,
        'quote_part_commerce': 0,
        'quote_part_bureau': 0,
        'quote_part_equipement': 0,
        'quote_part_equipement_prive': 0,
        'prix_vente_appartement': 8000,
        'prix_vente_commerce': None,
        'prix_vente_bureau': None,
        'prix_vente_equipement': None,
        'prix_vente_equipement_prive': None,
        'surface_equipement': None,
        'surface_equipement_prive': None,
        'cout_construction_appartement': 4500,
        'cout_construction_commerce': None,
        'cout_construction_bureau': None,
        'cout_construction_equipement': None,
        'cout_construction_equipement_prive': None,
        'taux_etudes_honoraires': 10,
        'taux_imprevus': 5,
        'taux_commercialisation': 3,
        'duree_construction': 2,
        'duree_commercialisation': 3,
        'taux_actualisation': 8,
        'repartition_construction': None,
        'repartition_ventes': None,
        'repartition_ventes_equipement': None,
        'repartition_ventes_equipement_prive': None,
        'surface_constructible': 8000,
        'surface_voie': 1000,
        'surface_espace_vert': 500,
        'has_appartement': True,
        'has_commerce': False,
        'has_bureau': False,
        'has_equipement': False,
        'has_equipement_prive': False,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestSurfaceVendable(SimpleTestCase):
    """Point 1 : nouvelle formule de surface vendable."""

    def test_formule_avec_taux_chute(self):
        p = _projet(cos=1.0, surface_constructible=8000, taux_chute=30)
        r = calculer_rentabilite_projet(p)
        # 1.0 * 8000 * (1 - 0.30) * 0.9 = 5040
        self.assertAlmostEqual(r['surfaces']['surface_vendable'], 5040.0, places=2)

    def test_taux_chute_module_la_surface(self):
        # taux de chute 0 -> 1.0 * 8000 * 1.0 * 0.9 = 7200
        r0 = calculer_rentabilite_projet(_projet(cos=1.0, surface_constructible=8000, taux_chute=0))
        self.assertAlmostEqual(r0['surfaces']['surface_vendable'], 7200.0, places=2)
        # taux de chute 50 -> 1.0 * 8000 * 0.5 * 0.9 = 3600
        r50 = calculer_rentabilite_projet(_projet(cos=1.0, surface_constructible=8000, taux_chute=50))
        self.assertAlmostEqual(r50['surfaces']['surface_vendable'], 3600.0, places=2)

    def test_fallback_sur_surface_brute_si_constructible_absent(self):
        p = _projet(surface_constructible=None, surface_souhaitee=10000, cos=1.0, taux_chute=30)
        r = calculer_rentabilite_projet(p)
        # fallback sur surface_brute = 10000 -> 1.0 * 10000 * 0.7 * 0.9 = 6300
        self.assertAlmostEqual(r['surfaces']['surface_vendable'], 6300.0, places=2)

    def test_shon_toujours_informatif(self):
        p = _projet(surface_souhaitee=10000, cos=1.0, surface_constructible=8000, taux_chute=30)
        r = calculer_rentabilite_projet(p)
        # shon non modifié : 10000 * 1.0
        self.assertAlmostEqual(r['surfaces']['shon'], 10000.0, places=2)

    def test_surfaces_voirie_espace_vert_exposees(self):
        # surface_voie=1000, espace_vert=500, taux_chute=30
        # surface_a_amenager = (1000+500) * 1.30 = 1950
        r = calculer_rentabilite_projet(_projet(surface_voie=1000, surface_espace_vert=500, taux_chute=30))
        self.assertAlmostEqual(r['surfaces']['surface_voie'], 1000.0, places=2)
        self.assertAlmostEqual(r['surfaces']['surface_espace_vert'], 500.0, places=2)
        self.assertAlmostEqual(r['surfaces']['surface_a_amenager'], 1950.0, places=2)


class TestChargeAmenagement(SimpleTestCase):
    """Point 3 : nouvelle charge d'aménagement."""

    def test_cout_amenagement_valeur(self):
        # surface_voie=1000, espace_vert=500, taux_chute=30
        # surface_a_amenager = (1000+500) * 1.30 = 1950
        # cout = 600 * 1950 * 1.1 = 1287000
        r = calculer_rentabilite_projet(_projet(surface_voie=1000, surface_espace_vert=500, taux_chute=30))
        expected = 600 * (1000 + 500) * 1.30 * 1.1
        self.assertAlmostEqual(r['charges']['amenagement'], expected, places=2)

    def test_taux_chute_affecte_amenagement(self):
        # Le même taux_chute impacte surface_a_amenager (remplace le 0.30).
        r0 = calculer_rentabilite_projet(_projet(surface_voie=1000, surface_espace_vert=500, taux_chute=0))
        r50 = calculer_rentabilite_projet(_projet(surface_voie=1000, surface_espace_vert=500, taux_chute=50))
        self.assertAlmostEqual(r0['charges']['amenagement'], 600 * 1500 * 1.0 * 1.1, places=2)
        self.assertAlmostEqual(r50['charges']['amenagement'], 600 * 1500 * 1.5 * 1.1, places=2)

    def test_amenagement_en_annee_0_seulement(self):
        r = calculer_rentabilite_projet(_projet(surface_voie=1000, surface_espace_vert=500, taux_chute=30))
        expected = 600 * (1000 + 500) * 1.30 * 1.1
        self.assertAlmostEqual(r['flux'][0]['amenagement'], expected, places=2)
        for f in r['flux'][1:]:
            self.assertEqual(f['amenagement'], 0.0)

    def test_charges_aucune_surface_est_nulle(self):
        r = calculer_rentabilite_projet(_projet(surface_voie=0, surface_espace_vert=0))
        self.assertEqual(r['charges']['amenagement'], 0.0)


class TestImpactAmenagementSurResultats(SimpleTestCase):
    """Point 5 : impact de cout_amenagement sur cout_total_projet et ROI/VAN/TRI."""

    def test_cout_total_projet_contient_amenagement(self):
        p = _projet(surface_voie=1000, surface_espace_vert=500, taux_chute=30)
        r = calculer_rentabilite_projet(p)
        expected_am = 600 * (1000 + 500) * 1.30 * 1.1
        # cout_construction_total = 5040 (surface vendable) * 4500 = 22680000
        # frais_etudes = 2268000 ; imprevus = 1134000
        # cout_acquisition = 10000*4000*1.07 = 42800000
        expected_total = (
            42800000
            + 22680000
            + 2268000
            + 1134000
            + expected_am
        )
        self.assertAlmostEqual(r['cout_total_projet'], expected_total, places=2)

    def test_roi_impacte_par_amenagement(self):
        # ROI = benefice_net / cout_total_projet * 100.
        with_am = calculer_rentabilite_projet(_projet(surface_voie=1000, surface_espace_vert=500, taux_chute=30))
        without_am = calculer_rentabilite_projet(_projet(surface_voie=0, surface_espace_vert=0, taux_chute=30))
        # avec aménagement le coût augmente -> ROI plus faible (ou VAN/TRI changent)
        self.assertIsNotNone(with_am['roi'])
        self.assertIsNotNone(without_am['roi'])
        self.assertLess(with_am['roi'], without_am['roi'])

    def test_flux_net_annee_0_reduit_par_amenagement(self):
        with_am = calculer_rentabilite_projet(_projet(surface_voie=1000, surface_espace_vert=500, taux_chute=30))
        without_am = calculer_rentabilite_projet(_projet(surface_voie=0, surface_espace_vert=0, taux_chute=30))
        self.assertLess(with_am['flux'][0]['flux_net'], without_am['flux'][0]['flux_net'])


class TestSurfaceTotale(SimpleTestCase):
    """La surface brute doit refléter la surface totale réelle du projet
    (parcelle/polygone), pas la surface souhaitée."""

    def test_surface_brute_priorise_surface_totale(self):
        # surface_totale fournie (parcelle réelle) -> surface brute = 3156
        r = calculer_rentabilite_projet(_projet(surface_souhaitee=10000, surface_totale=3156, cos=1.0, taux_chute=30))
        self.assertAlmostEqual(r['surfaces']['surface_brute'], 3156.0, places=2)

    def test_surface_brute_repli_surface_souhaitee(self):
        # surface_totale absente -> repli sur surface_souhaitee
        r = calculer_rentabilite_projet(_projet(surface_souhaitee=10000, surface_totale=None, cos=1.0, taux_chute=30))
        self.assertAlmostEqual(r['surfaces']['surface_brute'], 10000.0, places=2)

    def test_foncier_base_surface_totale(self):
        # Prix du foncier = prix/m² * surface brute (ici 3156)
        r = calculer_rentabilite_projet(_projet(surface_souhaitee=10000, surface_totale=3156, prix_foncier_m2=4000))
        self.assertAlmostEqual(r['acquisition']['prix_foncier'], 3156 * 4000.0, places=2)


class TestPAClassificationEtFallback(SimpleTestCase):
    """Vérifie la classification des désignations du PA et le fallback CUS.

    N'utilise pas la base de données : teste les fonctions pures de views.py.
    """

    def test_constructible_connu(self):
        from .views import _is_constructible_designation, _is_non_definie_designation
        for d in ('B2', 'B3', 'B4', 'C2', 'C4', 'D1', 'DS1', 'D5', 'IN2', 'ZPI', 'ZS'):
            self.assertTrue(_is_constructible_designation(d), d)
            self.assertFalse(_is_non_definie_designation(d), d)

    def test_categories_connues_pas_non_definie(self):
        # Équipement public/privé, voirie, espace vert, non constructible
        from .views import _is_non_definie_designation
        for d in ('A01', 'P97', 'E110', 'S33', 'SP41', 'M61', 'C07', 'G01', 'TE12', 'CP01', 'PS139', 'PL87', 'RP39', 'RN1', 'V191', 'RB', 'RS'):
            self.assertFalse(_is_non_definie_designation(d), d)

    def test_non_definie_exclue_comme_null(self):
        # NULL/vide + préfixes « Non définie » + codes non répertoriés
        from .views import _is_non_definie_designation
        for d in (None, '', 'AA', 'AAT', 'HA', 'MK', 'TA', 'SK', 'ME', 'ZZ9', 'inconnu'):
            self.assertTrue(_is_non_definie_designation(d), repr(d))

    def test_fallback_cus_par_designation(self):
        from .views import _cus_fallback
        self.assertEqual(_cus_fallback('B3', None), 0.75)
        self.assertEqual(_cus_fallback('C2', None), 0.40)
        self.assertEqual(_cus_fallback('C4', None), 0.35)
        self.assertEqual(_cus_fallback('D1', None), 0.30)
        self.assertEqual(_cus_fallback('D5', None), 0.20)
        self.assertIsNone(_cus_fallback('B2', None))

    def test_fallback_cus_ds1_selon_type(self):
        from .views import _cus_fallback
        self.assertEqual(_cus_fallback('DS1', 'villa isolée'), 0.30)
        self.assertEqual(_cus_fallback('DS1', 'demeure jumelée'), 0.40)
        self.assertEqual(_cus_fallback('DS1', 'lot en bande'), 0.50)
        self.assertEqual(_cus_fallback('DS1', None), 0.30)

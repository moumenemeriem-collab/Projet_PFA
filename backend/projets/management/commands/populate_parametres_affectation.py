import re
from django.core.management.base import BaseCommand
from django.db import connection
from projets.models import ParametreAffectation


DONNEES_BASE = [
    {
        'code': 'B2',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': 'Lotissement',
        'type_construction': 'Immeuble / Logement collectif',
        'definition': "Zone d'habitat collectif moyen standing",
        'cos': 'Libre',
        'cus': 'Libre avec cour de 16 m²',
        'hauteur_max': '11,50 m',
        'nombre_etages': 'R+2',
        'largeur_min': '8 m',
        'surface_min': '80 m²',
        'conditions': "Si voie d'aménagement >=20 m : 120 m² et façade >=12 m. Les règles de prospects/hauteur restent applicables.",
        'statut': 'VALIDÉ',
        'source': 'Règlement p.15-16, art. 1.B, 2-B, 3-B, 4-B',
    },
    {
        'code': 'B2',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': "Construction / groupe d'habitation",
        'type_construction': "Groupe d'habitation",
        'definition': "Zone d'habitat collectif moyen standing",
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '11,50 m',
        'nombre_etages': 'R+2',
        'largeur_min': '—',
        'surface_min': '70 m²/logement',
        'conditions': "Pour groupe d'habitation : COS/CES non fixés ; minimum habitable 70 m²/logement.",
        'statut': 'VALIDÉ',
        'source': 'Règlement p.16, art. 3-B et p.17, art. 4-B',
    },
    {
        'code': 'B3',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': 'Lotissement',
        'type_construction': 'Immeuble / Logement collectif',
        'definition': "Zone d'habitat collectif moyen standing R+3",
        'cos': 'Libre',
        'cus': '75 %',
        'hauteur_max': '14,50 m',
        'nombre_etages': 'R+3',
        'largeur_min': '10 m',
        'surface_min': '200 m²',
        'conditions': "Si voie d'aménagement >=20 m : surface min. 300 m² et façade >=15 m.",
        'statut': 'VALIDÉ',
        'source': 'Règlement p.15-16, art. 1.B, 3-B, 4-B',
    },
    {
        'code': 'B3',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': "Construction / groupe d'habitation",
        'type_construction': "Groupe d'habitation",
        'definition': "Zone d'habitat collectif moyen standing R+3",
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '14,50 m',
        'nombre_etages': 'R+3',
        'largeur_min': '—',
        'surface_min': '70 m²/logement',
        'conditions': "Pour groupe d'habitation : COS/CES non fixés ; minimum habitable 70 m²/logement.",
        'statut': 'VALIDÉ',
        'source': 'Règlement p.16-17, art. 3-B, 4-B',
    },
    {
        'code': 'B4',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': 'Lotissement',
        'type_construction': 'Immeuble / Logement collectif',
        'definition': "Zone d'habitat collectif moyen standing R+4",
        'cos': 'Libre',
        'cus': 'Libre',
        'hauteur_max': '17,50 m',
        'nombre_etages': 'R+4',
        'largeur_min': '12 m',
        'surface_min': '240 m²',
        'conditions': "Si voie d'aménagement >=20 m : surface min. 300 m² et façade >=15 m.",
        'statut': 'VALIDÉ',
        'source': 'Règlement p.15-16, art. 3-B, 4-B',
    },
    {
        'code': 'B4',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': "Construction / groupe d'habitation",
        'type_construction': "Groupe d'habitation",
        'definition': "Zone d'habitat collectif moyen standing R+4",
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '17,50 m',
        'nombre_etages': 'R+4',
        'largeur_min': '—',
        'surface_min': '70 m²/logement',
        'conditions': "Pour groupe d'habitation : COS/CES non fixés ; minimum habitable 70 m²/logement.",
        'statut': 'VALIDÉ',
        'source': 'Règlement p.16-17, art. 3-B, 4-B',
    },
    {
        'code': 'SB2',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': "Construction / groupe d'habitation",
        'type_construction': "Groupe d'habitation",
        'definition': "Secteur réservé aux groupes d'habitation R+2",
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '11,50 m',
        'nombre_etages': 'R+2',
        'largeur_min': '—',
        'surface_min': '70 m²/logement',
        'conditions': "Secteur destiné exclusivement aux groupes d'habitation. Lotissement interdit.",
        'statut': 'VALIDÉ – APPARTEMENT',
        'source': 'Règlement p.15-17, art. 1.B, 2-B, 3-B, 4-B (idem B2)',
    },
    {
        'code': 'SB4',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': "Construction / groupe d'habitation",
        'type_construction': "Groupe d'habitation",
        'definition': "Secteur réservé aux groupes d'habitation R+4",
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '17,50 m',
        'nombre_etages': 'R+4',
        'largeur_min': '—',
        'surface_min': '70 m²/logement',
        'conditions': "Secteur destiné exclusivement aux groupes d'habitation. Lotissement interdit.",
        'statut': 'VALIDÉ – APPARTEMENT',
        'source': 'Règlement p.15-18, art. 1.B, 2-B, 3-B, 4-B (idem B4)',
    },
    {
        'code': 'SB6',
        'zone': 'B',
        'categorie': 'Constructible',
        'type_operation': "Construction / groupe d'habitation",
        'type_construction': 'Groupe d\'habitation / Tertiaire',
        'definition': 'Secteur de haute densité R+6',
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '25 m',
        'nombre_etages': 'R+6',
        'largeur_min': '—',
        'surface_min': '70 m²/logement',
        'conditions': "RDC obligatoirement affecté à des commerces de haute gamme/services. Parcelles identifiées au graphique exclusivement tertiaires (commerce, services, bureaux, hôtellerie). Commerce donnant sur RN1 : min. 200 m² sur 50 m d'emprise.",
        'statut': 'VALIDÉ – CONDITIONNEL',
        'source': 'Règlement p.15-18, art. 1.B, 3-B, 4-B',
    },
    {
        'code': 'C2',
        'zone': 'C',
        'categorie': 'Constructible',
        'type_operation': "Construction / groupe d'habitation",
        'type_construction': 'Groupe d\'habitation / Activités',
        'definition': "Zone d'habitat continu et semi-collectif R+2",
        'cos': 'Libre',
        'cus': '40 %',
        'hauteur_max': '11,50 m',
        'nombre_etages': 'R+2',
        'largeur_min': '30 m',
        'surface_min': '2000 m²',
        'conditions': "Les projets de groupes d'habitation peuvent s'adjoindre commerces de proximité, bureaux et activités tertiaires.",
        'statut': 'VALIDÉ',
        'source': 'Règlement p.21-22, art. 1.C, 3.C, 4.C',
    },
    {
        'code': 'C4',
        'zone': 'C',
        'categorie': 'Constructible',
        'type_operation': "Construction / groupe d'habitation",
        'type_construction': 'Groupe d\'habitation / Activités',
        'definition': "Zone d'habitat continu et semi-collectif R+4",
        'cos': 'Libre',
        'cus': '35 %',
        'hauteur_max': '17,50 m',
        'nombre_etages': 'R+4',
        'largeur_min': '50 m',
        'surface_min': '5000 m²',
        'conditions': "Les projets de groupes d'habitation peuvent s'adjoindre commerces de proximité, bureaux et activités tertiaires. Parcelles TE12 signalées peuvent recevoir R+4 sous conditions graphiques.",
        'statut': 'VALIDÉ',
        'source': 'Règlement p.21-24, art. 1.C, 3.C, 4.C, 11.C',
    },
    {
        'code': 'D1',
        'zone': 'D',
        'categorie': 'Constructible',
        'type_operation': 'Lotissement villa isolée',
        'type_construction': 'Villa individuelle isolée',
        'definition': 'Zone résidentielle de villas isolées R+1',
        'cos': 'Libre',
        'cus': '30 %',
        'hauteur_max': '8,5 m',
        'nombre_etages': 'R+1',
        'largeur_min': '20 m',
        'surface_min': '400 m²',
        'conditions': "Zone destinée à la villa isolée. Exception commerciale/services/bureaux/tertiaire uniquement le long des axes TE01, TE05, TE06, TE31, TE34.",
        'statut': 'VALIDÉ – CONDITIONNEL SUR AXES',
        'source': 'Règlement p.24-26, art. 1.D-2.D-3.D (Art. 4-D)',
    },
    {
        'code': 'DS1',
        'zone': 'D',
        'categorie': 'Constructible',
        'type_operation': 'Lotissement villa',
        'type_construction': 'Villa individuelle (isolée / jumelée / bande)',
        'definition': 'Zone de villas individuelles',
        'cos': 'Libre',
        'cus': '30 % (isolée) / 40 % (jumelée) / 50 % (bande)',
        'hauteur_max': '8,5 m',
        'nombre_etages': 'R+1',
        'largeur_min': '20 m isolée / 15 m jumelée / 10 m bande',
        'surface_min': '400 m² isolée / 300 m² jumelée / 200 m² bande',
        'conditions': "Zone destinée aux logements individuels type villa. Commerce/services/bureaux/tertiaire incorporés à l'habitat interdits sauf le long des axes TE01, TE05, TE06, TE31, TE34.",
        'statut': 'VALIDÉ – COMMERCE/BUREAU CONDITIONNEL SUR AXES',
        'source': 'Règlement p.24-25, art. 1.D-2.D (Art. 4-D)',
    },
    {
        'code': 'D5',
        'zone': 'D',
        'categorie': 'Constructible',
        'type_operation': 'Lotissement villa isolée',
        'type_construction': 'Grande villa isolée',
        'definition': 'Zone résidentielle de grande villa',
        'cos': 'Libre',
        'cus': '20 %',
        'hauteur_max': '8,5 m',
        'nombre_etages': 'R+1',
        'largeur_min': '30 m',
        'surface_min': '1000 m²',
        'conditions': "Zone destinée à la villa isolée. Exception commerciale/services/bureaux/tertiaire uniquement le long des axes TE01, TE05, TE06, TE31, TE34.",
        'statut': 'VALIDÉ – CONDITIONNEL SUR AXES',
        'source': 'Règlement p.24-26, art. 1.D-2.D-3.D (Art. 4-D)',
    },
    {
        'code': 'D5',
        'zone': 'D',
        'categorie': 'Constructible',
        'type_operation': 'Construction',
        'type_construction': 'Construction de villas',
        'definition': 'Zone de villas de grande parcelle',
        'cos': 'Libre',
        'cus': '15 %',
        'hauteur_max': '8,5 m',
        'nombre_etages': 'R+1',
        'largeur_min': '30 m',
        'surface_min': '3000 m²',
        'conditions': "Construction de villas : 2 logements/parcelle, surface minimale de l'unité au sol 200 m². Les bureaux/commerces/activités tertiaires incorporés à l'habitat sont interdits hors axes expressément autorisés.",
        'statut': 'VALIDÉ – VILLA UNIQUEMENT',
        'source': 'Règlement p.25-26, art. 2.D-3.D-4.D',
    },
    {
        'code': 'IN2',
        'zone': 'IN',
        'categorie': 'Constructible',
        'type_operation': 'Construction / activité',
        'type_construction': 'Tertiaire / Bureaux / Équipement / Hôtellerie',
        'definition': "Zone d'activités économiques et de bureaux",
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '14 m',
        'nombre_etages': None,
        'largeur_min': '20 m',
        'surface_min': '500 m²',
        'conditions': "Activités non polluantes ; commerces, plateaux de bureaux, hôtellerie, enseignement, formation/recherche. Hauteurs ponctuelles admises si impératif technique. Habitat interdit, sauf logement de surveillance/gestion/direction.",
        'statut': 'VALIDÉ – BUREAU/COMMERCE',
        'source': 'Règlement p.29-30, art. 1.IN, 2.IN, 3.IN, 4.IN (Art. 3-IN)',
    },
    {
        'code': 'IN3',
        'zone': 'IN',
        'categorie': 'Constructible',
        'type_operation': 'Construction / activité',
        'type_construction': 'Artisanat / Commerce / Mixte',
        'definition': "Secteur d'activités artisanales et commerciales",
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '11,5 m',
        'nombre_etages': 'R+2',
        'largeur_min': '10 m',
        'surface_min': '120 m²',
        'conditions': "Secteur réservé aux activités artisanales et commerciales ; habitat autorisé aux étages. Habitat interdit au rez-de-chaussée.",
        'statut': 'VALIDÉ – COMMERCE + HABITAT AUX ÉTAGES',
        'source': 'Règlement p.29-30, art. 1.IN, 2.IN, 3.IN, 4.IN (Art. 3-IN)',
    },
    {
        'code': 'INS',
        'zone': 'INS',
        'categorie': 'Constructible',
        'type_operation': 'Construction / activité',
        'type_construction': 'Show-Room / Activités tertiaires / Commerces',
        'definition': 'Zone Show-Room',
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '14 m',
        'nombre_etages': None,
        'largeur_min': '40 m',
        'surface_min': '1000 m²',
        'conditions': "Zone Show-Room : bureaux, services, activités tertiaires, commerces et animations. Mezzanine autorisée. Habitat individuel ou collectif interdit.",
        'statut': 'VALIDÉ – BUREAU/COMMERCE',
        'source': 'Règlement p.32, art. 1.INS, 2.INS, 3.INS, 4.INS (Art. 4-INS)',
    },
    {
        'code': 'ZPI',
        'zone': 'ZPI',
        'categorie': 'Constructible',
        'type_operation': 'Projet intégré / construction',
        'type_construction': 'Pôle multifonctionnel / Tertiaire / Résidentiel',
        'definition': 'Zone de projet intégré multifonctionnel',
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '25 m',
        'nombre_etages': 'R+6',
        'largeur_min': 'Non fixé',
        'surface_min': 'Non fixé',
        'conditions': "Pôles multifonctionnels : activités administratives, tertiaires, socioculturelles et/ou résidentielles. Lotissement interdit. Composante résidentielle <=50 % de la surface plancher totale. Cahier de prescriptions obligatoire.",
        'statut': 'VALIDÉ – CONDITIONNEL',
        'source': 'Règlement p.28, art. 1-2 ZPI (Chap. IV Art. 2-ZPI)',
    },
    {
        'code': 'ZS',
        'zone': 'ZS',
        'categorie': 'Constructible',
        'type_operation': 'Construction sur projets autorisés',
        'type_construction': 'Projet autorisé / Commerce au RDC',
        'definition': 'Zone selon projets / cahiers des charges autorisés',
        'cos': 'Selon projet/cahier des charges',
        'cus': 'Selon projet/cahier des charges',
        'hauteur_max': 'Selon plans de masse',
        'nombre_etages': 'Selon plans de masse',
        'largeur_min': 'Non fixé',
        'surface_min': 'Non fixé',
        'conditions': "Selon plans de masse 'ne varietur' du projet. Commerces/services autorisés au RDC des immeubles avec façade sur TE105, uniquement sur le tronçon TE308–TE96, sous conditions. Régime des projets/cahiers des charges autorisés.",
        'statut': 'VALIDÉ – COMMERCE CONDITIONNEL',
        'source': 'Règlement p.28, chapitre V ZS (Chap. V)',
    },
    {
        'code': 'SR',
        'zone': 'SR',
        'categorie': 'Constructible (spécifique)',
        'type_operation': 'Secteurs à restructurer',
        'type_construction': 'Restructuration urbaine',
        'definition': 'Secteurs à restructurer',
        'cos': 'Non fixé',
        'cus': 'Non fixé',
        'hauteur_max': '11,50 m',
        'nombre_etages': 'R+2 max',
        'largeur_min': '—',
        'surface_min': '—',
        'conditions': '11,50 m (plafond, sauf cas particuliers). R+2 max.',
        'statut': 'VALIDÉ – SPÉCIFIQUE',
        'source': 'Titre III Chap. III',
    },
    {
        'code': 'RB',
        'zone': 'RB',
        'categorie': 'Non constructible',
        'type_operation': 'Non constructible',
        'type_construction': 'Non constructible',
        'definition': 'Réserve boisée / Zone naturelle protégée',
        'cos': '0',
        'cus': '0',
        'hauteur_max': '—',
        'nombre_etages': '—',
        'largeur_min': '—',
        'surface_min': '—',
        'conditions': 'Construction strictement interdite.',
        'statut': 'NON CONSTRUCTIBLE',
        'source': 'Règlement urbanisme - Zone non constructible',
    },
    {
        'code': 'RS',
        'zone': 'RS',
        'categorie': 'Non constructible',
        'type_operation': 'Non constructible',
        'type_construction': 'Non constructible',
        'definition': 'Zone de servitude / Non aedificandi',
        'cos': '0',
        'cus': '0',
        'hauteur_max': '—',
        'nombre_etages': '—',
        'largeur_min': '—',
        'surface_min': '—',
        'conditions': 'Urbanisation interdite.',
        'statut': 'NON CONSTRUCTIBLE',
        'source': 'Règlement urbanisme - Zone non constructible',
    },
    {
        'code': 'Non définie',
        'zone': 'Non définie',
        'categorie': 'Non définie',
        'type_operation': 'Non précisé',
        'type_construction': 'Non précisé',
        'definition': 'Affectation non définie au plan',
        'cos': '—',
        'cus': '—',
        'hauteur_max': '—',
        'nombre_etages': '—',
        'largeur_min': '—',
        'surface_min': '—',
        'conditions': 'Affectation non définie dans le plan d\'aménagement.',
        'statut': 'NON DÉFINIE',
        'source': 'Plan d\'aménagement',
    },
]


def classifier_designation(des: str, defn: str, tc: str, cos_val, cus_val, h_max, l_min, s_min) -> dict:
    des_raw = (des or '').strip()
    des_clean = des_raw.upper()
    defn_clean = (defn or '').strip()
    tc_clean = (tc or '').strip()

    # 1. Non définie
    if not des_clean or des_clean in ('NON DEFINIE', 'NON DÉFINIE', 'ND', 'AUCUNE', 'SANS', 'NON DEFINI', 'NON DÉFINI'):
        return {
            'code': des_raw or 'Non définie',
            'zone': 'Non définie',
            'categorie': 'Non définie',
            'type_operation': 'Non précisé',
            'type_construction': tc_clean or 'Non précisé',
            'definition': defn_clean or 'Affectation non définie',
            'cos': '—',
            'cus': '—',
            'hauteur_max': '—',
            'nombre_etages': '—',
            'largeur_min': '—',
            'surface_min': '—',
            'conditions': 'Affectation non définie au plan d\'aménagement.',
            'statut': 'NON DÉFINIE',
            'source': 'Plan d\'aménagement',
        }

    # 2. Voies
    if (
        re.match(r'^(ME|TE|RP|RN|V)\s*\d*', des_clean)
        or 'VOIE' in des_clean
        or 'ROUTE' in des_clean
        or 'EMPRISE' in des_clean
        or 'RUE' in des_clean
        or 'BOULEVARD' in des_clean
    ):
        return {
            'code': des_raw,
            'zone': 'Voirie',
            'categorie': 'Voie / Emprise publique',
            'type_operation': 'Voirie et circulation',
            'type_construction': tc_clean or 'Voie d\'aménagement',
            'definition': defn_clean or f'Emprise de voie publique ({des_raw})',
            'cos': '0',
            'cus': '0',
            'hauteur_max': '—',
            'nombre_etages': '—',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Emprise réservée au domaine public routier.',
            'statut': 'EMPRISE PUBLIQUE',
            'source': 'Plan d\'aménagement - Réseau viaire',
        }

    # 3. Espaces verts
    if (
        re.match(r'^(EV|ZV|J)\s*\d*', des_clean)
        or 'VERT' in des_clean
        or 'PARC' in des_clean
        or 'JARDIN' in des_clean
        or 'PAYSAGER' in des_clean
    ):
        return {
            'code': des_raw,
            'zone': 'Espaces verts',
            'categorie': 'Espace vert / Non constructible',
            'type_operation': 'Espace vert public',
            'type_construction': tc_clean or 'Parc / Jardin public / Espace paysager',
            'definition': defn_clean or f'Zone d\'espace vert ({des_raw})',
            'cos': '0',
            'cus': '0',
            'hauteur_max': '—',
            'nombre_etages': '—',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Zone réservée aux espaces verts et plantations. Construction interdite.',
            'statut': 'ESPACE VERT',
            'source': 'Plan d\'aménagement - Espaces verts',
        }

    # 4. Équipements administratifs (A..)
    if re.match(r'^A\s*\d+', des_clean) or des_clean == 'A' or 'ADMIN' in des_clean:
        return {
            'code': des_raw,
            'zone': 'Équipement',
            'categorie': 'Équipement public',
            'type_operation': 'Équipement administratif',
            'type_construction': tc_clean or 'Administration / Bureaux',
            'definition': defn_clean or f'Équipement administratif ({des_raw})',
            'cos': str(cos_val) if cos_val is not None else 'Non fixé',
            'cus': str(cus_val) if cus_val is not None else 'Non fixé',
            'hauteur_max': f'{h_max} m' if h_max else 'Selon projet',
            'nombre_etages': 'Selon projet',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Équipement d\'intérêt général réservé à l\'administration publique.',
            'statut': 'ÉQUIPEMENT PUBLIC',
            'source': 'Plan d\'aménagement - Équipements',
        }

    # 5. Enseignement / Éducation (E..)
    if re.match(r'^E\s*\d+', des_clean) or des_clean == 'E' or 'ECOLE' in des_clean or 'ÉCOLE' in des_clean or 'ENSEIGN' in des_clean or 'SCOLAIRE' in des_clean:
        is_prive = 'PRIVE' in des_clean or 'PRIVÉ' in des_clean or 'PRIVE' in defn_clean.upper() or 'PRIVÉ' in defn_clean.upper()
        return {
            'code': des_raw,
            'zone': 'Équipement',
            'categorie': 'Équipement privé' if is_prive else 'Équipement public',
            'type_operation': 'Équipement d\'enseignement',
            'type_construction': tc_clean or ('Établissement privé d\'enseignement' if is_prive else 'Établissement scolaire / Universitaire'),
            'definition': defn_clean or f'Équipement d\'enseignement ({des_raw})',
            'cos': str(cos_val) if cos_val is not None else 'Non fixé',
            'cus': str(cus_val) if cus_val is not None else 'Non fixé',
            'hauteur_max': f'{h_max} m' if h_max else 'Selon projet',
            'nombre_etages': 'Selon projet',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Réservé aux infrastructures scolaires et universitaires selon cahier des charges.',
            'statut': 'ÉQUIPEMENT PRIVÉ' if is_prive else 'ÉQUIPEMENT PUBLIC',
            'source': 'Plan d\'aménagement - Équipements',
        }

    # 6. Santé (S..)
    if re.match(r'^S\s*\d+', des_clean) or des_clean == 'S' or 'SANTE' in des_clean or 'SANTÉ' in des_clean or 'HOPITAL' in des_clean or 'HÔPITAL' in des_clean or 'CLINIQUE' in des_clean:
        is_prive = 'CLINIQUE' in defn_clean.upper() or 'PRIVE' in des_clean or 'PRIVÉ' in des_clean
        return {
            'code': des_raw,
            'zone': 'Équipement',
            'categorie': 'Équipement privé' if is_prive else 'Équipement public',
            'type_operation': 'Équipement sanitaire',
            'type_construction': tc_clean or 'Santé / Hôpital / Centre de santé',
            'definition': defn_clean or f'Équipement de santé ({des_raw})',
            'cos': str(cos_val) if cos_val is not None else 'Non fixé',
            'cus': str(cus_val) if cus_val is not None else 'Non fixé',
            'hauteur_max': f'{h_max} m' if h_max else 'Selon projet',
            'nombre_etages': 'Selon projet',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Réservé aux établissements hospitaliers et centres de soins.',
            'statut': 'ÉQUIPEMENT PRIVÉ' if is_prive else 'ÉQUIPEMENT PUBLIC',
            'source': 'Plan d\'aménagement - Équipements',
        }

    # 7. Sport / Jeunesse (SP..)
    if re.match(r'^SP\s*\d+', des_clean) or des_clean == 'SP' or 'SPORT' in des_clean or 'STADE' in des_clean:
        return {
            'code': des_raw,
            'zone': 'Équipement',
            'categorie': 'Équipement public',
            'type_operation': 'Équipement sportif',
            'type_construction': tc_clean or 'Terrain de sport / Complexe sportif',
            'definition': defn_clean or f'Équipement sportif ({des_raw})',
            'cos': str(cos_val) if cos_val is not None else 'Non fixé',
            'cus': str(cus_val) if cus_val is not None else 'Non fixé',
            'hauteur_max': f'{h_max} m' if h_max else 'Selon projet',
            'nombre_etages': 'Selon projet',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Réservé aux équipements sportifs et de jeunesse.',
            'statut': 'ÉQUIPEMENT PUBLIC',
            'source': 'Plan d\'aménagement - Équipements',
        }

    # 8. Mosquée / Culte (M..)
    if re.match(r'^M\s*\d+', des_clean) or des_clean == 'M' or 'MOSQUEE' in des_clean or 'MOSQUÉE' in des_clean or 'CULTE' in des_clean:
        return {
            'code': des_raw,
            'zone': 'Équipement',
            'categorie': 'Équipement public',
            'type_operation': 'Équipement cultuel',
            'type_construction': tc_clean or 'Mosquée / Centre religieux',
            'definition': defn_clean or f'Équipement cultuel ({des_raw})',
            'cos': str(cos_val) if cos_val is not None else 'Non fixé',
            'cus': str(cus_val) if cus_val is not None else 'Non fixé',
            'hauteur_max': f'{h_max} m' if h_max else 'Selon projet',
            'nombre_etages': 'Selon projet',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Réservé aux édifices du culte musulman.',
            'statut': 'ÉQUIPEMENT PUBLIC',
            'source': 'Plan d\'aménagement - Équipements',
        }

    # 9. Commercial / Marché (C..)
    if re.match(r'^C\s*\d+', des_clean) and des_clean not in ('C2', 'C4'):
        return {
            'code': des_raw,
            'zone': 'Équipement',
            'categorie': 'Équipement privé / public',
            'type_operation': 'Équipement commercial',
            'type_construction': tc_clean or 'Marché / Centre commercial',
            'definition': defn_clean or f'Équipement commercial ({des_raw})',
            'cos': str(cos_val) if cos_val is not None else 'Non fixé',
            'cus': str(cus_val) if cus_val is not None else 'Non fixé',
            'hauteur_max': f'{h_max} m' if h_max else 'Selon projet',
            'nombre_etages': 'Selon projet',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Réservé aux activités commerciales et services de proximité.',
            'statut': 'ÉQUIPEMENT COMMERCIAL',
            'source': 'Plan d\'aménagement - Équipements',
        }

    # 10. Parking / Transport (P.., G..)
    if re.match(r'^(P|G)\s*\d+', des_clean) or 'PARKING' in des_clean or 'GARE' in des_clean or 'STATIONNEMENT' in des_clean:
        return {
            'code': des_raw,
            'zone': 'Équipement',
            'categorie': 'Équipement public',
            'type_operation': 'Stationnement / Transport',
            'type_construction': tc_clean or 'Parking / Gare / Transport',
            'definition': defn_clean or f'Équipement de stationnement ou transport ({des_raw})',
            'cos': str(cos_val) if cos_val is not None else '0',
            'cus': str(cus_val) if cus_val is not None else '0',
            'hauteur_max': f'{h_max} m' if h_max else '—',
            'nombre_etages': '—',
            'largeur_min': f'{l_min} m' if l_min else '—',
            'surface_min': f'{s_min} m²' if s_min else '—',
            'conditions': 'Réservé au stationnement public ou aux infrastructures de transport.',
            'statut': 'ÉQUIPEMENT PUBLIC',
            'source': 'Plan d\'aménagement - Équipements',
        }

    # 11. Réserves et Servitudes (RB, RS, ZA, etc.)
    if des_clean in ('RB', 'RS', 'ZA', 'ZN', 'ZP') or 'RESERVE' in des_clean or 'RÉSERVE' in des_clean or 'SERVITUDE' in des_clean:
        return {
            'code': des_raw,
            'zone': des_clean,
            'categorie': 'Non constructible',
            'type_operation': 'Non constructible',
            'type_construction': tc_clean or 'Zone protégée / naturelle',
            'definition': defn_clean or f'Zone non constructible ({des_raw})',
            'cos': '0',
            'cus': '0',
            'hauteur_max': '—',
            'nombre_etages': '—',
            'largeur_min': '—',
            'surface_min': '—',
            'conditions': 'Zone protégée ou non aedificandi. Construction interdite.',
            'statut': 'NON CONSTRUCTIBLE',
            'source': 'Plan d\'aménagement - Servitudes et réserves',
        }

    # 12. Autres zones
    return {
        'code': des_raw,
        'zone': des_clean[:2] if len(des_clean) >= 2 else des_clean,
        'categorie': 'Zone spécifique / Mixte',
        'type_operation': 'Aménagement spécifique',
        'type_construction': tc_clean or 'Construction selon prescriptions',
        'definition': defn_clean or f'Affectation {des_raw}',
        'cos': str(cos_val) if cos_val is not None else 'Selon projet',
        'cus': str(cus_val) if cus_val is not None else 'Selon projet',
        'hauteur_max': f'{h_max} m' if h_max else 'Selon projet',
        'nombre_etages': 'Selon projet',
        'largeur_min': f'{l_min} m' if l_min else '—',
        'surface_min': f'{s_min} m²' if s_min else '—',
        'conditions': 'Soumis aux prescriptions du plan d\'aménagement et cahier des charges.',
        'statut': 'SPÉCIFIQUE',
        'source': 'Plan d\'aménagement',
    }


class Command(BaseCommand):
    help = "Peuple la table Paramètres affectation avec TOUTES les désignations du plan d'aménagement."

    def handle(self, *args, **options):
        self.stdout.write("Peuplement des paramètres d'affectation...")

        # 1. Insertion des règles de base
        nb_base = 0
        for d in DONNEES_BASE:
            ParametreAffectation.objects.update_or_create(
                code=d['code'],
                type_operation=d['type_operation'],
                defaults=d,
            )
            nb_base += 1
        self.stdout.write(f"  -> {nb_base} règles de base insérées / mises à jour.")

        # 2. Extraction et classification de toutes les désignations de couche_plan_amenagement
        try:
            with connection.cursor() as cur:
                cur.execute('''
                    SELECT 
                        COALESCE(TRIM(designation), '') as des,
                        COALESCE(TRIM(definition), '') as defn,
                        COALESCE(TRIM(type_construction), '') as tc,
                        cos, cus, hauteur_max, largeur_min, surface_min
                    FROM couche_plan_amenagement
                    GROUP BY 
                        COALESCE(TRIM(designation), ''),
                        COALESCE(TRIM(definition), ''),
                        COALESCE(TRIM(type_construction), ''),
                        cos, cus, hauteur_max, largeur_min, surface_min
                    ORDER BY des
                ''')
                rows = cur.fetchall()
        except Exception as exc:
            self.stderr.write(f"Impossible de lire couche_plan_amenagement : {exc}")
            rows = []

        nb_couche = 0
        for des, defn, tc, cos_val, cus_val, h_max, l_min, s_min in rows:
            if des in ('B2', 'B3', 'B4', 'SB2', 'SB4', 'SB6', 'C2', 'C4', 'D1', 'DS1', 'D5', 'IN2', 'IN3', 'INS', 'ZPI', 'ZS', 'SR', 'RB', 'RS'):
                continue

            item = classifier_designation(des, defn, tc, cos_val, cus_val, h_max, l_min, s_min)
            ParametreAffectation.objects.update_or_create(
                code=item['code'],
                type_operation=item['type_operation'],
                defaults=item,
            )
            nb_couche += 1

        total = ParametreAffectation.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f"Succès ! {nb_couche} affectations supplémentaires importées. Total en base : {total} paramètres d'affectation."
        ))

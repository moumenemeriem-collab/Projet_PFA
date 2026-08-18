from django.db import migrations

COUCHES = [
    {
        'nom': 'cadastre',
        'nom_affichage': 'Cadastre',
        'categorie': 'foncier',
        'description': 'Carte cadastrale officielle (Maille foncière) — parcelles et limites foncières',
        'type_geometrie': 'MultiPolygon',
        'attributs': [
            {'nom': 'id_parcelle', 'type': 'string'},
            {'nom': 'section', 'type': 'string'},
            {'nom': 'numero', 'type': 'string'},
            {'nom': 'superficie', 'type': 'number'},
            {'nom': 'commune', 'type': 'string'},
        ],
        'table_liee': 'couche_cadastre',
        'ordre': 1,
    },
    {
        'nom': 'plan_amenagement',
        'nom_affichage': "Plan d'aménagement",
        'categorie': 'urbanisme',
        'description': "Plan d'aménagement (PA) — zones et secteurs d'aménagement",
        'type_geometrie': 'MultiPolygon',
        'attributs': [
            {'nom': 'zone', 'type': 'string'},
            {'nom': 'secteur', 'type': 'string'},
            {'nom': 'superficie', 'type': 'number'},
            {'nom': 'coefficient', 'type': 'string'},
        ],
        'table_liee': 'couche_plan_amenagement',
        'ordre': 2,
    },
    {
        'nom': 'reglement_pa',
        'nom_affichage': 'Règlement PA',
        'categorie': 'urbanisme',
        'description': "Règlement du plan d'aménagement — servitudes et règles d'urbanisme",
        'type_geometrie': 'MultiPolygon',
        'attributs': [
            {'nom': 'zone', 'type': 'string'},
            {'nom': 'regle', 'type': 'string'},
            {'nom': 'description', 'type': 'string'},
        ],
        'table_liee': 'couche_reglement_pa',
        'ordre': 3,
    },
    {
        'nom': 'limites_admin',
        'nom_affichage': 'Limites administratives',
        'categorie': 'administratif',
        'description': 'Limites administratives — communes, provinces et régions',
        'type_geometrie': 'MultiPolygon',
        'attributs': [
            {'nom': 'nom', 'type': 'string'},
            {'nom': 'niveau', 'type': 'string'},
            {'nom': 'code', 'type': 'string'},
        ],
        'table_liee': 'couche_limites_admin',
        'ordre': 4,
    },
    {
        'nom': 'equipements_publics',
        'nom_affichage': 'Équipements publics',
        'categorie': 'equipements',
        'description': "Couche des équipements publics (EP + EPIG) — écoles, hôpitaux, administrations",
        'type_geometrie': 'Point',
        'attributs': [
            {'nom': 'nom', 'type': 'string'},
            {'nom': 'type', 'type': 'string'},
            {'nom': 'categorie', 'type': 'string'},
            {'nom': 'commune', 'type': 'string'},
        ],
        'table_liee': 'couche_equipements_publics',
        'ordre': 5,
    },
    {
        'nom': 'reseau_routier',
        'nom_affichage': 'Réseau routier',
        'categorie': 'infrastructure',
        'description': 'Réseau routier — routes principales et secondaires',
        'type_geometrie': 'MultiLineString',
        'attributs': [
            {'nom': 'nom', 'type': 'string'},
            {'nom': 'type', 'type': 'string'},
            {'nom': 'revetement', 'type': 'string'},
            {'nom': 'longueur_km', 'type': 'number'},
        ],
        'table_liee': 'couche_reseau_routier',
        'ordre': 6,
    },
    {
        'nom': 'mnt',
        'nom_affichage': 'MNT',
        'categorie': 'topographie',
        'description': 'Modèle Numérique de Terrain (MNT) — données altimétriques',
        'type_geometrie': 'MultiPolygon',
        'attributs': [],
        'table_liee': 'couche_mnt',
        'ordre': 7,
    },
    {
        'nom': 'prix_fonciers',
        'nom_affichage': 'Prix fonciers',
        'categorie': 'foncier',
        'description': 'Référentiel des prix fonciers — valeurs foncières par secteur',
        'type_geometrie': 'MultiPolygon',
        'attributs': [
            {'nom': 'secteur', 'type': 'string'},
            {'nom': 'prix_m2_min', 'type': 'number'},
            {'nom': 'prix_m2_max', 'type': 'number'},
            {'nom': 'prix_m2_moyen', 'type': 'number'},
            {'nom': 'annee', 'type': 'number'},
        ],
        'table_liee': 'couche_prix_fonciers',
        'ordre': 8,
    },
]


def forwards(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    for data in COUCHES:
        defaults = {k: v for k, v in data.items() if k != 'nom'}
        Couche.objects.update_or_create(nom=data['nom'], defaults=defaults)


def backwards(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    noms = [c['nom'] for c in COUCHES]
    Couche.objects.filter(nom__in=noms).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0006_complete_typeprojet'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

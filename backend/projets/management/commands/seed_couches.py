from django.core.management.base import BaseCommand

from projets.models import Couche

COUCHES = [
    {
        'nom': 'cadastre',
        'nom_affichage': 'Cadastre',
        'categorie': 'foncier',
        'description': "Carte cadastrale officielle (Maille foncière) — parcelles et limites foncières",
        'type_geometrie': 'MultiPolygon',
        'attributs': [{'nom': 'id_parcelle', 'type': 'string'}, {'nom': 'section', 'type': 'string'}, {'nom': 'numero', 'type': 'string'}, {'nom': 'superficie', 'type': 'number'}, {'nom': 'commune', 'type': 'string'}],
        'table_liee': 'couche_cadastre',
        'ordre': 1,
    },
    {
        'nom': 'plan_amenagement',
        'nom_affichage': "Plan d'aménagement",
        'categorie': 'urbanisme',
        'description': "Plan d'aménagement (PA) — zones et secteurs d'aménagement",
        'type_geometrie': 'MultiPolygon',
        'attributs': [{'nom': 'zone', 'type': 'string'}, {'nom': 'secteur', 'type': 'string'}, {'nom': 'superficie', 'type': 'number'}, {'nom': 'coefficient', 'type': 'string'}],
        'table_liee': 'couche_plan_amenagement',
        'ordre': 2,
    },
    {
        'nom': 'reglement_pa',
        'nom_affichage': "Règlement PA",
        'categorie': 'urbanisme',
        'description': "Règlement du plan d'aménagement — servitudes et règles d'urbanisme",
        'type_geometrie': 'MultiPolygon',
        'attributs': [{'nom': 'zone', 'type': 'string'}, {'nom': 'regle', 'type': 'string'}, {'nom': 'description', 'type': 'string'}],
        'table_liee': 'couche_reglement_pa',
        'ordre': 3,
    },
    {
        'nom': 'limites_admin',
        'nom_affichage': "Limites administratives",
        'categorie': 'administratif',
        'description': "Limites administratives — communes, provinces et régions",
        'type_geometrie': 'MultiPolygon',
        'attributs': [{'nom': 'nom', 'type': 'string'}, {'nom': 'niveau', 'type': 'string'}, {'nom': 'code', 'type': 'string'}],
        'table_liee': 'couche_limites_admin',
        'ordre': 4,
    },
    {
        'nom': 'equipements_publics',
        'nom_affichage': "Équipements publics",
        'categorie': 'equipements',
        'description': "Couche des équipements publics (EP + EPIG) — écoles, hôpitaux, administrations",
        'type_geometrie': 'Point',
        'attributs': [{'nom': 'nom', 'type': 'string'}, {'nom': 'type', 'type': 'string'}, {'nom': 'categorie', 'type': 'string'}, {'nom': 'commune', 'type': 'string'}],
        'table_liee': 'couche_equipements_publics',
        'ordre': 5,
    },
    {
        'nom': 'reseau_routier',
        'nom_affichage': "Réseau routier",
        'categorie': 'infrastructure',
        'description': "Réseau routier — routes principales et secondaires",
        'type_geometrie': 'MultiLineString',
        'attributs': [{'nom': 'nom', 'type': 'string'}, {'nom': 'type', 'type': 'string'}, {'nom': 'revetement', 'type': 'string'}, {'nom': 'longueur_km', 'type': 'number'}],
        'table_liee': 'couche_reseau_routier',
        'ordre': 6,
    },
    {
        'nom': 'mnt',
        'nom_affichage': 'MNT',
        'categorie': 'topographie',
        'description': "Modèle Numérique de Terrain (MNT) — données altimétriques",
        'type_geometrie': 'MultiPolygon',
        'attributs': [{'nom': 'altitude_min', 'type': 'number'}, {'nom': 'altitude_max', 'type': 'number'}, {'nom': 'pente_moyenne', 'type': 'number'}],
        'table_liee': 'couche_mnt',
        'ordre': 7,
    },
    {
        'nom': 'prix_fonciers',
        'nom_affichage': "Prix fonciers",
        'categorie': 'foncier',
        'description': "Référentiel des prix fonciers — valeurs foncières par secteur",
        'type_geometrie': 'MultiPolygon',
        'attributs': [{'nom': 'secteur', 'type': 'string'}, {'nom': 'prix_m2_min', 'type': 'number'}, {'nom': 'prix_m2_max', 'type': 'number'}, {'nom': 'prix_m2_moyen', 'type': 'number'}, {'nom': 'annee', 'type': 'number'}],
        'table_liee': 'couche_prix_fonciers',
        'ordre': 8,
    },
]


class Command(BaseCommand):
    help = 'Seed the couches with initial layer definitions'

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for data in COUCHES:
            defaults = {k: v for k, v in data.items() if k != 'nom'}
            obj, was_created = Couche.objects.update_or_create(nom=data['nom'], defaults=defaults)
            if was_created:
                created += 1
            else:
                updated += 1
            self.stdout.write(f'  {"Créé" if was_created else "Mis à jour"}: {obj.nom_affichage}')

        self.stdout.write(self.style.SUCCESS(f'\nTerminé : {created} couche(s) créée(s), {updated} mise(s) à jour'))

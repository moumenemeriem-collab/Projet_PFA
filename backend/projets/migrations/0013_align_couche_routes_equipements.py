from django.db import migrations

ATTRIBUTS_ROUTIER = [
    {'nom': 'full_id', 'type': 'string'},
    {'nom': 'osm_id', 'type': 'string'},
    {'nom': 'highway', 'type': 'string'},
    {'nom': 'name', 'type': 'string'},
    {'nom': 'surface', 'type': 'string'},
]

ATTRIBUTS_EQUIPEMENTS = [
    {'nom': 'full_id', 'type': 'string'},
    {'nom': 'osm_id', 'type': 'string'},
    {'nom': 'amenity', 'type': 'string'},
]

SQL_DROP = 'DROP TABLE IF EXISTS "couche_reseau_routier"; DROP TABLE IF EXISTS "couche_equipements_publics";'

SQL_CREATE = """
CREATE TABLE IF NOT EXISTS "couche_reseau_routier" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "full_id" TEXT,
    "osm_id" TEXT,
    "highway" TEXT,
    "name" TEXT,
    "surface" TEXT
);

CREATE TABLE IF NOT EXISTS "couche_equipements_publics" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "full_id" TEXT,
    "osm_id" TEXT,
    "amenity" TEXT
);
"""


def aligner(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    Couche.objects.filter(nom='reseau_routier').update(
        type_geometrie='MultiLineString',
        attributs=ATTRIBUTS_ROUTIER,
    )
    Couche.objects.filter(nom='equipements_publics').update(
        type_geometrie='Point',
        attributs=ATTRIBUTS_EQUIPEMENTS,
    )


def annuler(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    Couche.objects.filter(nom='reseau_routier').update(
        type_geometrie='MultiLineString',
        attributs=[
            {'nom': 'nom', 'type': 'string'},
            {'nom': 'type', 'type': 'string'},
            {'nom': 'revetement', 'type': 'string'},
            {'nom': 'longueur_km', 'type': 'number'},
        ],
    )
    Couche.objects.filter(nom='equipements_publics').update(
        type_geometrie='Point',
        attributs=[
            {'nom': 'nom', 'type': 'string'},
            {'nom': 'type', 'type': 'string'},
            {'nom': 'categorie', 'type': 'string'},
            {'nom': 'commune', 'type': 'string'},
        ],
    )


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0012_align_couche_cadastre'),
    ]

    operations = [
        migrations.RunPython(aligner, annuler),
        migrations.RunSQL(SQL_DROP),
        migrations.RunSQL(SQL_CREATE),
    ]

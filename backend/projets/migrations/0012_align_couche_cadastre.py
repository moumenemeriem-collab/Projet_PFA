from django.db import migrations

ATTRIBUTS_CADASTRE = [
    {'nom': 'id_parcelle', 'type': 'string'},
    {'nom': 'num_titre_foncier', 'type': 'string'},
    {'nom': 'type_immatriculation', 'type': 'string'},
    {'nom': 'nature_juridique', 'type': 'string'},
    {'nom': 'superficie_m2', 'type': 'number'},
    {'nom': 'commune', 'type': 'string'},
    {'nom': 'cercle', 'type': 'string'},
    {'nom': 'province', 'type': 'string'},
    {'nom': 'nature_occupation_code', 'type': 'string'},
    {'nom': 'nature_occupation_libelle', 'type': 'string'},
    {'nom': 'zone_amenagement', 'type': 'string'},
    {'nom': 'statut_foncier', 'type': 'string'},
    {'nom': 'origine', 'type': 'string'},
    {'nom': 'reference_plan', 'type': 'string'},
    {'nom': 'echelle_leve', 'type': 'string'},
    {'nom': 'date_creation', 'type': 'string'},
    {'nom': 'date_derniere_maj', 'type': 'string'},
]

SQL_DROP_CADASTRE = 'DROP TABLE IF EXISTS "couche_cadastre";'

SQL_CREATE_CADASTRE = """
CREATE TABLE IF NOT EXISTS "couche_cadastre" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "id_parcelle" TEXT,
    "num_titre_foncier" TEXT,
    "type_immatriculation" TEXT,
    "nature_juridique" TEXT,
    "superficie_m2" DOUBLE PRECISION,
    "commune" TEXT,
    "cercle" TEXT,
    "province" TEXT,
    "nature_occupation_code" TEXT,
    "nature_occupation_libelle" TEXT,
    "zone_amenagement" TEXT,
    "statut_foncier" TEXT,
    "origine" TEXT,
    "reference_plan" TEXT,
    "echelle_leve" TEXT,
    "date_creation" TEXT,
    "date_derniere_maj" TEXT
);
"""


def aligner_couche(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    Couche.objects.filter(nom='cadastre').update(
        type_geometrie='Polygon',
        attributs=ATTRIBUTS_CADASTRE,
    )


def annuler(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    Couche.objects.filter(nom='cadastre').update(
        type_geometrie='MultiPolygon',
        attributs=[
            {'nom': 'id_parcelle', 'type': 'string'},
            {'nom': 'section', 'type': 'string'},
            {'nom': 'numero', 'type': 'string'},
            {'nom': 'superficie', 'type': 'number'},
            {'nom': 'commune', 'type': 'string'},
        ],
    )


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0011_parcellecadastrale'),
    ]

    operations = [
        migrations.RunPython(aligner_couche, annuler),
        migrations.RunSQL(SQL_DROP_CADASTRE),
        migrations.RunSQL(SQL_CREATE_CADASTRE),
    ]

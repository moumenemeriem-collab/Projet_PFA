import json
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import migrations

try:
    from psycopg2.extras import execute_values
except ImportError:
    try:
        from django.db.backends.postgresql.psycopg_any import execute_values
    except ImportError:
        execute_values = None

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
FICHIER = 'CadGIS_Temara.geojson'
TABLE = 'couche_cadastre'
COLS = ['fid', 'indice', 'complement', 'Consistance', 'num', 'surface']

ATTRIBUTS_CADASTRE = [
    {'nom': 'fid', 'type': 'number'},
    {'nom': 'indice', 'type': 'string'},
    {'nom': 'complement', 'type': 'string'},
    {'nom': 'Consistance', 'type': 'string'},
    {'nom': 'num', 'type': 'string'},
    {'nom': 'surface', 'type': 'number'},
]

SQL_DROP_CADASTRE = 'DROP TABLE IF EXISTS "couche_cadastre";'

SQL_CREATE_CADASTRE = """
CREATE TABLE IF NOT EXISTS "couche_cadastre" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "fid" BIGINT,
    "indice" TEXT,
    "complement" TEXT,
    "Consistance" TEXT,
    "num" TEXT,
    "surface" DOUBLE PRECISION
);
"""


def aligner_couche(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    Couche.objects.filter(nom='cadastre').update(
        type_geometrie='Polygon',
        attributs=ATTRIBUTS_CADASTRE,
    )


def importer_cadastre(apps, schema_editor):
    conn = schema_editor.connection
    Couche = apps.get_model('projets', 'Couche')

    filepath = DATA_DIR / FICHIER
    if filepath.exists():
        with open(filepath, 'r', encoding='utf-8') as f:
            collection = json.load(f)
        features = collection.get('features', [])
        rows = []
        for feat in features:
            geom = json.dumps(feat.get('geometry'))
            props = feat.get('properties', {})
            row = [geom]
            for col in COLS:
                val = props.get(col)
                row.append(val if val is not None else None)
            rows.append(tuple(row))

        quoted_cols = ', '.join(f'"{c}"' for c in ['geometry'] + COLS)
        sql = f'INSERT INTO "{TABLE}" ({quoted_cols}) VALUES %s'

        with conn.cursor() as cur:
            cur.execute(f'TRUNCATE TABLE "{TABLE}" RESTART IDENTITY CASCADE')
            if execute_values:
                for i in range(0, len(rows), 500):
                    execute_values(cur, sql, rows[i:i + 500], page_size=500)
            else:
                placeholders = ', '.join(['%s'] * (len(COLS) + 1))
                for row in rows:
                    cur.execute(sql.replace('%s', '(' + placeholders + ')'), row)

        couche = Couche.objects.filter(nom='cadastre').first()
        if couche:
            with open(filepath, 'rb') as f:
                couche.fichier.save(FICHIER, ContentFile(f.read()), save=True)
            Couche.objects.filter(nom='cadastre').update(
                etat='importe', message_erreur='',
                taille_fichier=filepath.stat().st_size,
                format_fichier='GeoJSON',
            )


def annuler(apps, schema_editor):
    conn = schema_editor.connection
    Couche = apps.get_model('projets', 'Couche')
    with conn.cursor() as cur:
        cur.execute('TRUNCATE TABLE "couche_cadastre" RESTART IDENTITY CASCADE')
    Couche.objects.filter(nom='cadastre').update(
        type_geometrie='Polygon',
        attributs=[
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
        ],
        etat='non_importe', message_erreur='',
        taille_fichier=None, format_fichier='', fichier=None,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0018_resultatanalyse_reference_cadastrale'),
    ]

    operations = [
        migrations.RunPython(aligner_couche, annuler),
        migrations.RunSQL(SQL_DROP_CADASTRE),
        migrations.RunSQL(SQL_CREATE_CADASTRE),
        migrations.RunPython(importer_cadastre, annuler),
    ]

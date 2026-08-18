import json
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import migrations

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'

try:
    from psycopg2.extras import execute_values
except ImportError:
    try:
        from django.db.backends.postgresql.psycopg_any import execute_values
    except ImportError:
        execute_values = None


FICHIERS = [
    {
        'couche_nom': 'cadastre',
        'filename': 'cadastre_temara_realiste.geojson',
        'table': 'couche_cadastre',
        'cols': ['id_parcelle', 'num_titre_foncier', 'type_immatriculation', 'nature_juridique', 'superficie_m2',
                 'commune', 'cercle', 'province', 'nature_occupation_code', 'nature_occupation_libelle',
                 'zone_amenagement', 'statut_foncier', 'origine', 'reference_plan', 'echelle_leve',
                 'date_creation', 'date_derniere_maj'],
    },
    {
        'couche_nom': 'reseau_routier',
        'filename': 'highway_fusionne.geojson',
        'table': 'couche_reseau_routier',
        'cols': ['full_id', 'osm_id', 'highway', 'name', 'surface'],
    },
    {
        'couche_nom': 'equipements_publics',
        'filename': 'amenity.geojson',
        'table': 'couche_equipements_publics',
        'cols': ['full_id', 'osm_id', 'amenity'],
    },
]

MNT_FICHIER = 'MNT.gpkg'


def importer_geojson(apps, schema_editor):
    conn = schema_editor.connection
    Couche = apps.get_model('projets', 'Couche')

    for spec in FICHIERS:
        filepath = DATA_DIR / spec['filename']
        if not filepath.exists():
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            collection = json.load(f)
        features = collection.get('features', [])
        if not features:
            continue

        rows = []
        for feat in features:
            geom = json.dumps(feat.get('geometry'))
            props = feat.get('properties', {})
            row = [geom]
            for col in spec['cols']:
                val = props.get(col)
                row.append(val if val is not None else None)
            rows.append(tuple(row))

        quoted_cols = ', '.join(f'"{c}"' for c in ['geometry'] + spec['cols'])
        sql = f'INSERT INTO "{spec["table"]}" ({quoted_cols}) VALUES %s'

        with conn.cursor() as cur:
            cur.execute(f'TRUNCATE TABLE "{spec["table"]}" RESTART IDENTITY CASCADE')
            if execute_values:
                for i in range(0, len(rows), 500):
                    execute_values(cur, sql, rows[i:i + 500], page_size=500)
            else:
                placeholders = ', '.join(['%s'] * (len(spec['cols']) + 1))
                for row in rows:
                    cur.execute(sql.replace('%s', '(' + placeholders + ')'), row)

        Couche.objects.filter(nom=spec['couche_nom']).update(
            etat='importe', message_erreur='', taille_fichier=filepath.stat().st_size,
            format_fichier='GeoJSON',
        )


def stocker_mnt(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    filepath = DATA_DIR / MNT_FICHIER
    if not filepath.exists():
        return

    couche = Couche.objects.filter(nom='mnt').first()
    if not couche:
        return

    with open(filepath, 'rb') as f:
        couche.fichier.save(MNT_FICHIER, ContentFile(f.read()), save=True)

    Couche.objects.filter(nom='mnt').update(
        etat='importe', message_erreur='', taille_fichier=filepath.stat().st_size,
        format_fichier='GPKG',
    )


def annuler(apps, schema_editor):
    conn = schema_editor.connection
    Couche = apps.get_model('projets', 'Couche')
    with conn.cursor() as cur:
        for spec in FICHIERS:
            cur.execute(f'TRUNCATE TABLE "{spec["table"]}" RESTART IDENTITY CASCADE')
    Couche.objects.filter(nom__in=[s['couche_nom'] for s in FICHIERS]).update(
        etat='non_importe', message_erreur='', taille_fichier=None, format_fichier='',
    )
    Couche.objects.filter(nom='mnt').update(
        etat='non_importe', message_erreur='', taille_fichier=None, format_fichier='',
        fichier=None,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0013_align_couche_routes_equipements'),
    ]

    operations = [
        migrations.RunPython(importer_geojson, annuler),
        migrations.RunPython(stocker_mnt, annuler),
    ]

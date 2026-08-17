import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import connection

from projets.models import Couche

DATA_DIR = Path(__file__).resolve().parent.parent.parent / 'data'

DATA_FILES = {
    'cadastre': {
        'filename': 'CadGIS_Temara.geojson',
        'cols': ['fid', 'indice', 'complement', 'Consistance', 'num', 'surface'],
    },
    'reseau_routier': {
        'filename': 'highway_fusionne.geojson',
        'cols': ['full_id', 'osm_id', 'highway', 'name', 'surface'],
    },
    'equipements_publics': {
        'filename': 'amenity.geojson',
        'cols': ['full_id', 'osm_id', 'amenity'],
    },
}


class Command(BaseCommand):
    help = 'Create PostgreSQL tables for each couche based on their attributes'

    def handle(self, *args, **options):
        couches = Couche.objects.all()
        if not couches:
            self.stdout.write(self.style.WARNING('Aucune couche trouvée. Exécutez d\'abord seed_couches.'))
            return

        with connection.cursor() as cur:
            for couche in couches:
                table = couche.table_liee
                if not table:
                    self.stdout.write(self.style.WARNING(f'  Pas de table_liee pour {couche.nom}'))
                    continue

                cur.execute(f'DROP TABLE IF EXISTS "{table}"')

                sql = f'CREATE TABLE "{table}" (id BIGSERIAL PRIMARY KEY, geometry JSONB NOT NULL'
                for attr in couche.attributs:
                    nom = attr['nom']
                    atype = attr.get('type', 'string')
                    if atype == 'number':
                        sql += f', "{nom}" DOUBLE PRECISION'
                    elif atype == 'integer':
                        sql += f', "{nom}" INTEGER'
                    else:
                        sql += f', "{nom}" TEXT'
                sql += ')'

                try:
                    cur.execute(sql)
                    self.stdout.write(self.style.SUCCESS(f'  Table créée : {table}'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'  Erreur {table}: {e}'))
                    continue

                data_spec = DATA_FILES.get(couche.nom)
                if not data_spec:
                    continue

                filepath = DATA_DIR / data_spec['filename']
                if not filepath.exists():
                    self.stdout.write(self.style.WARNING(f'  Fichier introuvable : {filepath}'))
                    continue

                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        collection = json.load(f)
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'  Erreur lecture {data_spec["filename"]}: {e}'))
                    continue

                features = collection.get('features', [])
                if not features:
                    self.stdout.write(self.style.WARNING(f'  Aucune feature dans {data_spec["filename"]}'))
                    continue

                rows = []
                for feat in features:
                    geom = json.dumps(feat.get('geometry'))
                    props = feat.get('properties', {})
                    row = [geom]
                    for col in data_spec['cols']:
                        val = props.get(col)
                        row.append(val if val is not None else None)
                    rows.append(tuple(row))

                quoted_cols = ', '.join(f'"{c}"' for c in ['geometry'] + data_spec['cols'])
                insert_sql = f'INSERT INTO "{table}" ({quoted_cols}) VALUES (%s)'

                try:
                    with connection.cursor() as ins:
                        for row in rows:
                            ins.execute(insert_sql, row)
                    self.stdout.write(self.style.SUCCESS(f'  Données importées : {len(rows)} features → {table}'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'  Erreur import {table}: {e}'))

        self.stdout.write(self.style.SUCCESS('\nTerminé'))

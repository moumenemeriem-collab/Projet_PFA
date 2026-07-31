import json
from pathlib import Path

from django.db import migrations

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'

try:
    from psycopg2.extras import execute_values
except ImportError:
    try:
        from django.db.backends.postgresql.psycopg_any import execute_values
    except ImportError:
        execute_values = None


def run(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS "highway" (
                id BIGSERIAL PRIMARY KEY,
                geometry JSONB NOT NULL,
                "full_id" TEXT,
                "osm_id" TEXT,
                "highway" TEXT,
                "name" TEXT,
                "surface" TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS "amenity" (
                id BIGSERIAL PRIMARY KEY,
                geometry JSONB NOT NULL,
                "full_id" TEXT,
                "osm_id" TEXT,
                "amenity" TEXT
            )
        """)

    for filename, table, cols in [
        ('highway_fusionne.geojson', 'highway', ['full_id', 'osm_id', 'highway', 'name', 'surface']),
        ('amenity.geojson', 'amenity', ['full_id', 'osm_id', 'amenity']),
    ]:
        filepath = DATA_DIR / filename
        if not filepath.exists():
            continue
        with open(filepath, 'r', encoding='utf-8') as f:
            collection = json.load(f)
        features = collection.get('features', [])
        if not features:
            continue

        rows = []
        for feat in features:
            geom = json.dumps(feat['geometry'])
            props = feat['properties']
            row = [geom]
            for col in cols:
                row.append(props.get(col) or '')
            rows.append(tuple(row))

        quoted_cols = ', '.join(f'"{c}"' for c in ['geometry'] + cols)
        sql = f'INSERT INTO "{table}" ({quoted_cols}) VALUES %s'

        with conn.cursor() as cur:
            if execute_values:
                for i in range(0, len(rows), 500):
                    execute_values(cur, sql, rows[i:i + 500], page_size=500)
            else:
                for row in rows:
                    cur.execute(sql.replace('%s', '(' + ', '.join(['%s'] * len(row)) + ')'), row)


def revert(apps, schema_editor):
    with schema_editor.connection.cursor() as cur:
        cur.execute('DROP TABLE IF EXISTS "highway"')
        cur.execute('DROP TABLE IF EXISTS "amenity"')


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0008_init_couche_tables'),
    ]

    operations = [
        migrations.RunPython(run, revert),
    ]

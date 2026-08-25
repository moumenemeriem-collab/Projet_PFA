"""
Migration 0032 — Réimporte toutes les données SIG dans les tables couche_*.

Couche plan d'aménagement et équipements publics avaient des colonnes
incorrectes depuis les migrations initiales. Cette migration recrée
TOUTES les tables couche_* avec les bonnes colonnes et réimporte
les fichiers GeoJSON depuis data/.
"""
import json
from pathlib import Path

from django.db import migrations

try:
    from psycopg2.extras import execute_values
except ImportError:
    try:
        from django.db.backends.postgresql.psycopg_any import execute_values
    except ImportError:
        execute_values = None

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'

# ---------------------------------------------------------------------------
# 1. Schéma correct pour chaque table
# ---------------------------------------------------------------------------

TABLES = {
    'couche_cadastre': {
        'drop': 'DROP TABLE IF EXISTS "couche_cadastre";',
        'create': """
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
""",
        'cols': ['fid', 'indice', 'complement', 'Consistance', 'num', 'surface'],
        'attributs': [
            {'nom': 'fid', 'type': 'number'},
            {'nom': 'indice', 'type': 'string'},
            {'nom': 'complement', 'type': 'string'},
            {'nom': 'Consistance', 'type': 'string'},
            {'nom': 'num', 'type': 'string'},
            {'nom': 'surface', 'type': 'number'},
        ],
    },
    'couche_plan_amenagement': {
        'drop': 'DROP TABLE IF EXISTS "couche_plan_amenagement";',
        'create': """
CREATE TABLE IF NOT EXISTS "couche_plan_amenagement" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "ville" TEXT,
    "designation" TEXT,
    "definition" TEXT,
    "surface_min" DOUBLE PRECISION,
    "largeur_min" DOUBLE PRECISION,
    "hauteur_max" DOUBLE PRECISION,
    "cos" DOUBLE PRECISION,
    "cus" DOUBLE PRECISION,
    "type_construction" TEXT,
    "Surface" DOUBLE PRECISION
);
""",
        'cols': ['ville', 'designation', 'definition', 'surface_min', 'largeur_min',
                 'hauteur_max', 'cos', 'cus', 'type_construction', 'Surface'],
        'attributs': [
            {'nom': 'ville', 'type': 'string'},
            {'nom': 'designation', 'type': 'string'},
            {'nom': 'definition', 'type': 'string'},
            {'nom': 'surface_min', 'type': 'number'},
            {'nom': 'largeur_min', 'type': 'number'},
            {'nom': 'hauteur_max', 'type': 'number'},
            {'nom': 'cos', 'type': 'number'},
            {'nom': 'cus', 'type': 'number'},
            {'nom': 'type_construction', 'type': 'string'},
            {'nom': 'Surface', 'type': 'number'},
        ],
    },
    'couche_equipements_publics': {
        'drop': 'DROP TABLE IF EXISTS "couche_equipements_publics";',
        'create': """
CREATE TABLE IF NOT EXISTS "couche_equipements_publics" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "ville" TEXT,
    "designation" TEXT,
    "definition" TEXT,
    "type_construction" TEXT,
    "Surface" DOUBLE PRECISION
);
""",
        'cols': ['ville', 'designation', 'definition', 'type_construction', 'Surface'],
        'attributs': [
            {'nom': 'ville', 'type': 'string'},
            {'nom': 'designation', 'type': 'string'},
            {'nom': 'definition', 'type': 'string'},
            {'nom': 'type_construction', 'type': 'string'},
            {'nom': 'Surface', 'type': 'number'},
        ],
    },
    'couche_reseau_routier': {
        'drop': 'DROP TABLE IF EXISTS "couche_reseau_routier";',
        'create': """
CREATE TABLE IF NOT EXISTS "couche_reseau_routier" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "full_id" TEXT,
    "osm_id" TEXT,
    "highway" TEXT,
    "name" TEXT,
    "surface" TEXT
);
""",
        'cols': ['full_id', 'osm_id', 'highway', 'name', 'surface'],
        'attributs': [
            {'nom': 'full_id', 'type': 'string'},
            {'nom': 'osm_id', 'type': 'string'},
            {'nom': 'highway', 'type': 'string'},
            {'nom': 'name', 'type': 'string'},
            {'nom': 'surface', 'type': 'string'},
        ],
    },
}

# ---------------------------------------------------------------------------
# 2. Fichiers source → table cible
# ---------------------------------------------------------------------------

DATA_SOURCES = [
    {
        'table': 'couche_cadastre',
        'couche_nom': 'cadastre',
        'candidates': ['CadGIS_temara_test.geojson', 'CadGIS_Temara.geojson'],
        'subdir': 'cadastre',
    },
    {
        'table': 'couche_plan_amenagement',
        'couche_nom': 'plan_amenagement',
        'candidates': ['PA-Temara-final.geojson'],
        'subdir': 'plan_amenagement',
    },
    {
        'table': 'couche_equipements_publics',
        'couche_nom': 'equipements_publics',
        'candidates': ['Equipements.geojson', 'amenity.geojson'],
        'subdir': 'equipements',
    },
    {
        'table': 'couche_reseau_routier',
        'couche_nom': 'reseau_routier',
        'candidates': ['Routes.geojson', 'highway_fusionne.geojson'],
        'subdir': 'Routes',
    },
]


def _resolve_file(spec):
    candidates = spec['candidates']
    subdir = spec.get('subdir', '')
    search_bases = [
        DATA_DIR / subdir,
        DATA_DIR,
        DATA_DIR.parent / 'backend' / 'data',
    ]
    for base in search_bases:
        for name in candidates:
            p = base / name
            if p.exists():
                return p
    return None


def _build_rows(filepath, cols):
    with open(filepath, 'r', encoding='utf-8') as f:
        collection = json.load(f)
    features = collection.get('features', [])
    rows = []
    for feat in features:
        geom = feat.get('geometry')
        if not geom:
            continue
        props = feat.get('properties', {}) or {}
        row = [json.dumps(geom)]
        for col in cols:
            val = props.get(col)
            row.append(val if val is not None else None)
        rows.append(tuple(row))
    return rows


def _import_table(cursor, table, cols, rows):
    quoted_cols = ', '.join(f'"{c}"' for c in ['geometry'] + cols)
    sql = f'INSERT INTO "{table}" ({quoted_cols}) VALUES %s'
    if execute_values:
        for i in range(0, len(rows), 500):
            execute_values(cursor, sql, rows[i:i + 500], page_size=500)
    else:
        placeholders = ', '.join(['%s'] * len(rows[0]))
        for row in rows:
            cursor.execute(sql.replace('%s', '(' + placeholders + ')'), row)


# ---------------------------------------------------------------------------
# 3. Forward & reverse
# ---------------------------------------------------------------------------

def importer(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    conn = schema_editor.connection

    # 3a. Recréer toutes les tables avec le bon schéma
    with conn.cursor() as cur:
        for table_name, spec in TABLES.items():
            cur.execute(spec['drop'])
            cur.execute(spec['create'])

    # 3b. Mettre à jour les attributs Couche (metadata)
    for table_name, spec in TABLES.items():
        for src in DATA_SOURCES:
            if src['table'] == table_name:
                Couche.objects.filter(nom=src['couche_nom']).update(
                    attributs=spec['attributs'],
                )
                break

    # 3c. Importer les données
    with conn.cursor() as cur:
        for src in DATA_SOURCES:
            filepath = _resolve_file(src)
            if not filepath:
                continue
            cols = TABLES[src['table']]['cols']
            rows = _build_rows(filepath, cols)
            if rows:
                _import_table(cur, src['table'], cols, rows)

            # Mettre à jour l'état de la couche
            Couche.objects.filter(nom=src['couche_nom']).update(
                etat='importe',
                message_erreur='',
                taille_fichier=filepath.stat().st_size,
                format_fichier='GeoJSON',
            )

    # 3d. Ajouter des index
    with conn.cursor() as cur:
        for idx_spec in [
            ('idx_cc_num', 'couche_cadastre', 'num'),
            ('idx_cpa_designation', 'couche_plan_amenagement', 'designation'),
            ('idx_cep_type', 'couche_equipements_publics', 'type_construction'),
            ('idx_crr_highway', 'couche_reseau_routier', 'highway'),
        ]:
            idx_name, table, col = idx_spec
            try:
                cur.execute(
                    f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{table}" ("{col}")'
                )
            except Exception:
                pass


def annuler(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cur:
        for table_name in TABLES:
            cur.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY CASCADE')


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0031_projet_cout_construction_equipement_and_more'),
    ]

    operations = [
        migrations.RunPython(importer, annuler),
    ]

"""
Migration 0036 — Importe la couche « limites administratives » (commune de Témara)
dans la table ``couche_limites_admin``.

La table existe déjà (créée par la migration 0008) et est déclarée dans le
référentiel ``Couche`` (nom='limites_admin'), mais elle n'avait jamais été
remplie. Cette migration lit le GeoJSON livré (Commune_Temara.geojson) et
insère les entités (geometry + nom/niveau/code) pour que la logique de
localisation (determiner_localisation) puisse s'appuyer sur la limite
communale stockée en base, au même titre que les autres couches SIG.
"""
import json
from pathlib import Path

from django.db import migrations

# backend/ = parent.parent.parent du fichier (.../projets/migrations/xxx.py)
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_PROJECTS_DIR = _BACKEND_DIR / 'projets'
_PROJECT_ROOT = _BACKEND_DIR.parent

DATA_SEARCH_PATHS = [
    _PROJECT_ROOT / 'data',        # <racine>/data/            (dev local)
    _BACKEND_DIR / 'data',         # backend/data/             (Docker)
    _PROJECTS_DIR / 'data',        # backend/projets/data/     (livraison GeoJSON)
]

TABLE = 'couche_limites_admin'


def _resolve_file():
    candidates = ['Commune_Temara.geojson']
    for base in DATA_SEARCH_PATHS:
        for name in candidates:
            p = base / name
            if p.exists():
                return p
    return None


def _build_rows(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        collection = json.load(f)
    rows = []
    for feat in collection.get('features', []):
        geom = feat.get('geometry')
        if not geom:
            continue
        props = feat.get('properties', {}) or {}
        nom = props.get('nom_fr') or props.get('nom_ar') or ''
        niveau = props.get('niveau') or 'commune'
        code = props.get('ISO') or props.get('code') or ''
        rows.append((json.dumps(geom), nom, niveau, code))
    return rows


def importer(apps, schema_editor):
    conn = schema_editor.connection
    filepath = _resolve_file()

    with conn.cursor() as cur:
        cur.execute(f'TRUNCATE TABLE "{TABLE}" RESTART IDENTITY CASCADE')
        if filepath:
            for geometry, nom, niveau, code in _build_rows(filepath):
                cur.execute(
                    f'INSERT INTO "{TABLE}" (geometry, "nom", "niveau", "code") '
                    'VALUES (%s, %s, %s, %s)',
                    [geometry, nom, niveau, code],
                )

    # Mettre à jour l'état de la couche dans le référentiel
    Couche = apps.get_model('projets', 'Couche')
    Couche.objects.filter(nom='limites_admin').update(
        etat='importe',
        message_erreur='',
        format_fichier='GeoJSON',
        attributs=[
            {'nom': 'nom', 'type': 'string'},
            {'nom': 'niveau', 'type': 'string'},
            {'nom': 'code', 'type': 'string'},
        ],
    )


def annuler(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cur:
        cur.execute(f'TRUNCATE TABLE "{TABLE}" RESTART IDENTITY CASCADE')


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0035_rename_pente_to_altitude'),
    ]

    operations = [
        migrations.RunPython(importer, annuler),
    ]

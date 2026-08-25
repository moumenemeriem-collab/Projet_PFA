import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import connection

from projets.models import Couche

# Répertoire principal du backend (ou chemins alternatifs)
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent   # backend/
_PROJECT_ROOT = _BACKEND_DIR.parent                                    # racine du projet

DATA_SEARCH_PATHS = [
    _BACKEND_DIR / 'data',           # backend/data/ (inclus dans Docker)
    _PROJECT_ROOT / 'data',          # data/ (développement local)
]


def _find_file(*candidates) -> Path | None:
    """Retourne le premier chemin existant parmi les candidats."""
    for p in candidates:
        if p and p.exists():
            return p
    return None


DATA_FILES = {
    'cadastre': {
        'candidates': ['CadGIS_temara_test.geojson', 'CadGIS_Temara.geojson'],
        'subdir': 'cadastre',
        'cols': ['fid', 'indice', 'complement', 'Consistance', 'num', 'surface'],
    },
    'reseau_routier': {
        'candidates': ['Routes.geojson', 'highway_fusionne.geojson'],
        'subdir': 'Routes',
        'cols': ['full_id', 'osm_id', 'highway', 'name', 'surface'],
    },
    'equipements_publics': {
        'candidates': ['Equipements.geojson', 'amenity.geojson'],
        'subdir': 'equipements',
        'cols': ['ville', 'designation', 'definition', 'type_construction', 'Surface'],
    },
    'plan_amenagement': {
        'candidates': ['PA-Temara-final.geojson'],
        'subdir': 'plan_amenagement',
        'cols': ['ville', 'designation', 'definition', 'surface_min', 'largeur_min',
                 'hauteur_max', 'cos', 'cus', 'type_construction', 'Surface'],
    },
}


def _resolve_data_file(spec: dict) -> Path | None:
    """Cherche le fichier de données dans tous les chemins connus."""
    subdir = spec.get('subdir', '')
    candidates_names = spec['candidates']
    for base in DATA_SEARCH_PATHS:
        for name in candidates_names:
            # Avec sous-dossier (data/cadastre/CadGIS_temara_test.geojson)
            p = base / subdir / name
            if p.exists():
                return p
            # Sans sous-dossier (backend/data/CadGIS_temara_test.geojson)
            p = base / name
            if p.exists():
                return p
    return None


class Command(BaseCommand):
    help = 'Crée et remplit les tables PostgreSQL pour chaque couche SIG depuis les fichiers data/'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force', action='store_true',
            help='Vider et réimporter les tables existantes avec données',
        )
        parser.add_argument(
            '--couche', type=str, default=None,
            help='Traiter uniquement cette couche (ex: cadastre)',
        )

    def _table_exists(self, cursor, table: str) -> bool:
        cursor.execute(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s)",
            [table],
        )
        return cursor.fetchone()[0]

    def _table_has_data(self, cursor, table: str) -> bool:
        try:
            cursor.execute(f'SELECT COUNT(*) FROM "{table}" LIMIT 1')
            return (cursor.fetchone()[0] or 0) > 0
        except Exception:
            return False

    def _drop_table(self, cursor, table: str):
        cursor.execute(f'DROP TABLE IF EXISTS "{table}"')

    def _create_table(self, cursor, table: str, couche):
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
        cursor.execute(sql)

    def _add_indexes(self, cursor, table: str, couche):
        """Ajoute des index sur les colonnes fréquemment filtrées."""
        index_cols = {
            'cadastre': ['num'],
            'plan_amenagement': ['designation', 'ville'],
            'equipements_publics': ['type_construction', 'ville'],
            'reseau_routier': ['highway'],
        }
        cols = index_cols.get(couche.nom, [])
        for col in cols:
            idx_name = f'idx_{table}_{col}'
            try:
                cursor.execute(
                    f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{table}" ("{col}")'
                )
            except Exception:
                pass

    def handle(self, *args, **options):
        force = options['force']
        only = options['couche']

        self.stdout.write(f'\n[init_couche_tables] Chemins de recherche :')
        for p in DATA_SEARCH_PATHS:
            self.stdout.write(f'  - {p}  {"OK existe" if p.exists() else "ERREUR absent"}')

        couches = Couche.objects.all()
        if not couches:
            self.stdout.write(self.style.WARNING("Aucune couche trouvée. Exécutez d'abord seed_couches."))
            return

        with connection.cursor() as cur:
            for couche in couches:
                if only and couche.nom != only:
                    continue

                table = couche.table_liee
                if not table:
                    self.stdout.write(self.style.WARNING(f'  Pas de table_liee pour {couche.nom}'))
                    continue

                # --- Gestion de la table ---
                table_exists = self._table_exists(cur, table)
                has_data = table_exists and self._table_has_data(cur, table)

                if table_exists and has_data and not force:
                    self.stdout.write(self.style.SUCCESS(
                        f'  OK {table} : {couche.nom} — déjà remplie (utilisez --force pour réimporter)'
                    ))
                    continue

                if table_exists and force:
                    self._drop_table(cur, table)
                    self.stdout.write(f'  >> Table supprimée (--force) : {table}')

                if not self._table_exists(cur, table):
                    try:
                        self._create_table(cur, table, couche)
                        self.stdout.write(self.style.SUCCESS(f'  + Table créée : {table}'))
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'  ERREUR Erreur création {table}: {e}'))
                        continue

                # --- Résolution du fichier source ---
                data_spec = DATA_FILES.get(couche.nom)
                if not data_spec:
                    self.stdout.write(f'  — Aucun fichier source défini pour {couche.nom} (table créée vide)')
                    continue

                filepath = _resolve_data_file(data_spec)
                if not filepath:
                    tried = [
                        f'{base}/{spec}' for base in DATA_SEARCH_PATHS
                        for spec in [f"{data_spec.get('subdir', '')}/{c}" for c in data_spec['candidates']]
                    ]
                    self.stdout.write(self.style.WARNING(
                        f'  !! Fichier introuvable pour {couche.nom}. Essayé : {tried[:3]}'
                    ))
                    continue

                self.stdout.write(f'  -> Lecture : {filepath}')

                # --- Chargement et insertion ---
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        collection = json.load(f)
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'  ERREUR Erreur lecture {filepath.name}: {e}'))
                    continue

                features = collection.get('features', [])
                if not features:
                    self.stdout.write(self.style.WARNING(f'  !! Aucune feature dans {filepath.name}'))
                    continue

                cols = data_spec['cols']
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

                if not rows:
                    self.stdout.write(self.style.WARNING(f'  !! Aucune ligne valide pour {couche.nom}'))
                    continue

                quoted_cols = ', '.join(f'"{c}"' for c in ['geometry'] + cols)
                placeholders = ', '.join(['%s'] * (1 + len(cols)))
                insert_sql = f'INSERT INTO "{table}" ({quoted_cols}) VALUES ({placeholders})'

                try:
                    with connection.cursor() as ins:
                        ins.executemany(insert_sql, rows)
                    self.stdout.write(self.style.SUCCESS(
                        f'  OK {len(rows)} features importées -> {table}'
                    ))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'  ERREUR Erreur import {table}: {e}'))
                    continue

                # --- Index ---
                try:
                    self._add_indexes(cur, table, couche)
                    self.stdout.write(f'  OK Index créés pour {table}')
                except Exception:
                    pass

        self.stdout.write(self.style.SUCCESS('\nOK init_couche_tables terminé'))

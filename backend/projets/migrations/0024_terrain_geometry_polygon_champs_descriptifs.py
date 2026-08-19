import json

import django.contrib.gis.db.models.fields as gis_fields
from django.db import migrations, models


def _activer_postgis(apps, schema_editor):
    """Active l'extension PostGIS lorsque la base est PostgreSQL (sinon no-op)."""
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        with connection.cursor() as cur:
            try:
                cur.execute('CREATE EXTENSION IF NOT EXISTS postgis')
            except Exception:
                pass


def _convertir_geometry_avant(apps, schema_editor):
    """Convertit l'ancienne colonne `geometry` (texte GeoJSON) vers un vrai
    polygone PostGIS tout en préservant les données existantes.

    - Les lignes dont `geometry` est vide / NULL / non parsable / non `Polygon`
      (Point, LineString, MultiPolygon, ...) passent à NULL : elles n'avaient
      pas de polygone exploitable.
    - Les lignes valides (type `Polygon`) sont transformées en
      `geometry(Polygon,4326)` via `ST_GeomFromGeoJSON`.
    """
    connection = schema_editor.connection
    if connection.vendor != 'postgresql':
        return

    with connection.cursor() as cur:
        # Inclut les lignes '' (ancien défaut de colonne) : ST_GeomFromGeoJSON
        # échouerait sur une chaîne vide lors de l'ALTER ci-dessous.
        cur.execute("SELECT id, geometry FROM terrain WHERE geometry IS NOT NULL")
        rows = cur.fetchall()

        polygon_ids = []
        autres_ids = []
        for rid, geom in rows:
            try:
                g = json.loads(geom)
                valide = isinstance(g, dict) and g.get('type') == 'Polygon'
            except Exception:
                valide = False
            (polygon_ids if valide else autres_ids).append(rid)

        # Les lignes sans polygone exploitable (texte GeoJSON vide/invalide ou
        # type différent de Polygon) passent à NULL : elles sont signalées comme
        # impactées au retour de la migration.
        if autres_ids:
            cur.execute('UPDATE terrain SET geometry = NULL WHERE id = ANY(%s)', [autres_ids])

        cur.execute(
            'ALTER TABLE terrain ALTER COLUMN geometry TYPE geometry(Polygon,4326) '
            'USING ST_GeomFromGeoJSON(geometry)::geometry(Polygon,4326)'
        )
        cur.execute('ALTER TABLE terrain ALTER COLUMN geometry DROP DEFAULT')


def _convertir_geometry_arriere(apps, schema_editor):
    """Retour arrière : re-sérialise le polygone en GeoJSON texte."""
    connection = schema_editor.connection
    if connection.vendor != 'postgresql':
        return

    with connection.cursor() as cur:
        cur.execute(
            "ALTER TABLE terrain ALTER COLUMN geometry TYPE text "
            "USING COALESCE(ST_AsGeoJSON(geometry), '')"
        )
        cur.execute("ALTER TABLE terrain ALTER COLUMN geometry SET DEFAULT ''")


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0023_update_typeprojet_images'),
    ]

    operations = [
        migrations.RunPython(_activer_postgis, migrations.RunPython.noop),
        migrations.AddField(
            model_name='terrain',
            name='num_titre_foncier',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='terrain',
            name='statut_juridique',
            field=models.CharField(
                blank=True,
                choices=[
                    ('titre', 'Titré'),
                    ('requisition', 'Réquisition en cours'),
                    ('non_immatricule', 'Non immatriculé'),
                    ('collectif', 'Collectif'),
                ],
                default='',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='terrain',
            name='prix_demande',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True),
        ),
        migrations.AddField(
            model_name='terrain',
            name='zonage',
            field=models.CharField(
                blank=True,
                choices=[
                    ('residentiel', 'Résidentiel'),
                    ('commercial', 'Commercial'),
                    ('industriel', 'Industriel'),
                    ('agricole', 'Agricole'),
                    ('mixte', 'Mixte'),
                ],
                default='',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='terrain',
            name='cos',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='terrain',
            name='cus',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='terrain',
            name='hauteur_maximale',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='terrain',
            name='equipements',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(
            _convertir_geometry_avant,
            reverse_code=_convertir_geometry_arriere,
        ),
        migrations.AlterField(
            model_name='terrain',
            name='geometry',
            field=gis_fields.PolygonField(blank=True, null=True, srid=4326),
        ),
    ]
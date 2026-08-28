import json
import os

from django.contrib.gis.geos import GEOSGeometry
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from projets.models import Couche, Terrain


class Command(BaseCommand):
    help = (
        'Importe un fichier GeoJSON cadastral dans la couche cadastre '
        'et crée des terrains pour un projet.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--fichier', required=True,
            help='Chemin du fichier GeoJSON cadastral',
        )
        parser.add_argument(
            '--projet', type=int, required=True,
            help='ID du projet pour créer les terrains',
        )
        parser.add_argument(
            '--remplacer', action='store_true',
            help='Supprimer les terrains existants du projet avant import',
        )

    def handle(self, *args, **options):
        chemin = options['fichier']
        projet_id = options['projet']
        remplacer = options['remplacer']

        if not os.path.exists(chemin):
            raise CommandError(f'Fichier introuvable : {chemin}')

        from projets.models import Projet
        try:
            projet = Projet.objects.get(pk=projet_id)
        except Projet.DoesNotExist:
            raise CommandError(f'Projet #{projet_id} introuvable.')

        with open(chemin, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as exc:
                raise CommandError(f'GeoJSON invalide : {exc}')

        features = data.get('features') or []
        if not features:
            raise CommandError('Aucune entité trouvée dans le fichier.')

        self._importer_couche_cadastre(features, chemin)
        nb = self._creer_terrains(features, projet, remplacer)

        self.stdout.write(self.style.SUCCESS(
            f'Import terminé : {nb} terrain(s) créés pour le projet "{projet.nom}".'
        ))

    def _importer_couche_cadastre(self, features, chemin):
        """Importe les features dans la table couche_cadastre."""
        try:
            couche = Couche.objects.get(nom='cadastre')
        except Couche.DoesNotExist:
            self.stdout.write(self.style.WARNING(
                'Couche "cadastre" introuvable — import couche ignoré.'
            ))
            return

        table = couche.table_liee
        if not table:
            self.stdout.write(self.style.WARNING(
                'Aucune table liée pour la couche cadastre — import couche ignoré.'
            ))
            return

        attributs = [a['nom'] for a in couche.attributs] if couche.attributs else []

        with connection.cursor() as cur:
            cur.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
            sql = f'CREATE TABLE "{table}" (id BIGSERIAL PRIMARY KEY, geometry JSONB NOT NULL'
            for attr in couche.attributs:
                nom_col = attr['nom']
                atype = attr.get('type', 'string')
                if atype == 'number':
                    sql += f', "{nom_col}" DOUBLE PRECISION'
                elif atype == 'integer':
                    sql += f', "{nom_col}" INTEGER'
                else:
                    sql += f', "{nom_col}" TEXT'
            sql += ')'
            cur.execute(sql)

            for feature in features:
                geom_feature = json.dumps(feature.get('geometry'))
                props_feature = feature.get('properties', {})

                colonnes = ['geometry']
                valeurs = [geom_feature]
                for attr_nom in attributs:
                    colonnes.append(f'"{attr_nom}"')
                    valeurs.append(props_feature.get(attr_nom))

                placeholders = ', '.join(['%s'] * len(colonnes))
                cols = ', '.join(colonnes)
                cur.execute(
                    f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders})',
                    valeurs,
                )

        couche.etat = 'importe'
        couche.type_geometrie = 'Polygon'
        from datetime import datetime
        from django.core.files.base import ContentFile
        nom_sauvegarde = f'{couche.nom}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.geojson'
        with open(chemin, 'rb') as f:
            contenu = f.read()
        couche.fichier.save(nom_sauvegarde, ContentFile(contenu), save=False)
        couche.taille_fichier = len(contenu)
        couche.format_fichier = 'GeoJSON'
        couche.save()

        self.stdout.write(f'  Couche cadastre : {len(features)} enregistrement(s) importé(s).')

    def _creer_terrains(self, features, projet, remplacer):
        """Crée des Terrain objects à partir des features GeoJSON."""
        if remplacer:
            deleted = Terrain.objects.filter(projet=projet).delete()
            self.stdout.write(f'  Terrains existants supprimés : {deleted[0]}')

        terrains = []
        for i, feature in enumerate(features):
            props = feature.get('properties') or {}
            geom_data = feature.get('geometry')

            if not geom_data:
                continue

            try:
                geom = GEOSGeometry(json.dumps(geom_data))
            except Exception:
                self.stdout.write(self.style.WARNING(
                    f'  Feature #{i}: géométrie invalide — ignorée.'
                ))
                continue

            if geom is None or not geom.valid:
                try:
                    geom = geom.make_valid()
                except Exception:
                    self.stdout.write(self.style.WARNING(
                        f'  Feature #{i}: géométrie non réparable — ignorée.'
                    ))
                    continue

            geom.srid = 4326

            centroid = geom.centroid
            num = props.get('num') or props.get('NUM') or ''
            surface = props.get('surface') or props.get('SURFACE') or 0
            try:
                surface = round(float(surface), 2)
            except (TypeError, ValueError):
                surface = 0

            ind = (props.get('indice') or props.get('INDICE') or '').strip()
            if num and ind and not num.endswith(f'/{ind}') and '/' not in num:
                nom = f'Parcelle {num}/{ind}'
            elif num:
                nom = f'Parcelle {num}'
            else:
                nom = f'Parcelle {i + 1}'

            terrains.append(Terrain(
                projet=projet,
                nom=nom,
                superficie=surface,
                lat=round(centroid.y, 6),
                lng=round(centroid.x, 6),
                num_parcelle=num,
                num_titre_foncier=num,
                fid=props.get('fid'),
                indice=props.get('indice') or '',
                complement=props.get('complement') or '',
                consistance=props.get('Consistance') or '',
                geometry=geom,
            ))

        created = Terrain.objects.bulk_create(terrains, batch_size=100)
        self.stdout.write(f'  Terrains créés : {len(created)}')
        return len(created)

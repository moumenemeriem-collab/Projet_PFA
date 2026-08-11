import json
import os
from datetime import datetime

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from projets.models import Couche, ImportCouche


class Command(BaseCommand):
    help = 'Importe un fichier GeoJSON dans une couche (BDD + fichier média).'

    def add_arguments(self, parser):
        parser.add_argument('--couche', required=True, help="Nom de la couche (ex : plan_amenagement)")
        parser.add_argument('--fichier', required=True, help='Chemin du fichier GeoJSON')

    def handle(self, *args, **options):
        nom = options['couche']
        chemin = options['fichier']

        try:
            couche = Couche.objects.get(nom=nom)
        except Couche.DoesNotExist:
            raise CommandError(f"Couche '{nom}' introuvable. Exécutez d'abord seed_couches.")

        if not os.path.exists(chemin):
            raise CommandError(f'Fichier introuvable : {chemin}')

        with open(chemin, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as exc:
                raise CommandError(f'GeoJSON invalide : {exc}')

        features = data.get('features') or []
        if not features:
            raise CommandError('Aucune entité trouvée dans le fichier')

        premiere = features[0]
        geom = premiere.get('geometry')
        props = premiere.get('properties', {})

        if not geom:
            raise CommandError('Format différent : aucune géométrie trouvée')

        type_geom = geom['type']
        if couche.type_geometrie and couche.type_geometrie != type_geom:
            raise CommandError(
                f'Format différent : le type de géométrie attendu est "{couche.type_geometrie}" '
                f'mais le fichier fourni a "{type_geom}"'
            )

        attributs_attendus = [a['nom'] for a in couche.attributs] if couche.attributs else []
        attributs_fichier = list(props.keys())

        if attributs_attendus:
            manquants = [a for a in attributs_attendus if a not in attributs_fichier]
            en_trop = [a for a in attributs_fichier if a not in attributs_attendus]
            erreurs = []
            if manquants:
                erreurs.append(f'Attributs non définis : {", ".join(manquants)}')
            if en_trop:
                erreurs.append(f'Attributs inattendus : {", ".join(en_trop)}')
            if erreurs:
                raise CommandError('; '.join(erreurs))

        table = couche.table_liee
        if not table:
            raise CommandError('Aucune table liée configurée pour cette couche')

        nom_fichier = os.path.basename(chemin)

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
                for attr in attributs_attendus:
                    colonnes.append(f'"{attr}"')
                    valeurs.append(props_feature.get(attr))

                placeholders = ', '.join(['%s'] * len(colonnes))
                cols = ', '.join(colonnes)
                cur.execute(f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders})', valeurs)

        nb = len(features)

        ImportCouche.objects.create(
            couche=couche,
            fichier=nom_fichier,
            statut='succes',
            message=f'Import réussi : {nb} enregistrement(s)',
            nb_enregistrements=nb,
        )

        couche.etat = 'importe'
        couche.message_erreur = ''
        couche.type_geometrie = type_geom

        with open(chemin, 'rb') as f:
            contenu = f.read()
        nom_sauvegarde = f'{couche.nom}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.geojson'
        couche.fichier.save(nom_sauvegarde, ContentFile(contenu), save=False)
        couche.taille_fichier = len(contenu)
        couche.format_fichier = 'GeoJSON'
        couche.save()

        self.stdout.write(self.style.SUCCESS(
            f'Import réussi : {nb} enregistrement(s) dans "{table}" pour la couche "{couche.nom_affichage}"'
        ))

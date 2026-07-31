from django.core.management.base import BaseCommand
from django.db import connection

from projets.models import Couche


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

                sql = f'CREATE TABLE IF NOT EXISTS "{table}" (id BIGSERIAL PRIMARY KEY, geometry JSONB NOT NULL'
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

        self.stdout.write(self.style.SUCCESS('\nTerminé'))

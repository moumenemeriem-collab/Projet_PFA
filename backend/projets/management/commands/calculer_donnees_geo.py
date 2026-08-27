import datetime
import json
import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection

from projets.analyse import (
    MNTAltitudeIndex,
    _load_commune_limite,
    determiner_altitude,
    determiner_localisation,
)
from projets.models import Terrain


class Command(BaseCommand):
    help = (
        "Calcule et persiste zone_localisation_calculee et altitude_calculee pour tous les "
        "terrains disposant d'une géométrie. À relancer après mise à jour de la limite "
        "communale ou du MNT (force le recalcul)."
    )

    def handle(self, *args, **options):
        terrains = Terrain.objects.exclude(geometry__isnull=True)
        limite_commune = _load_commune_limite()

        mnt_index = None
        with connection.cursor() as cur:
            cur.execute("SELECT fichier FROM couche WHERE nom='mnt'")
            row = cur.fetchone()
        if row and row[0]:
            mnt_path = os.path.join(settings.MEDIA_ROOT, row[0])
            if os.path.exists(mnt_path):
                try:
                    mnt_index = MNTAltitudeIndex(mnt_path)
                except Exception:
                    mnt_index = None

        now = datetime.datetime.now()
        count = 0
        for t in terrains:
            geom = None
            try:
                if t.geometry:
                    geom = json.loads(t.geometry.geojson)
            except Exception:
                geom = None
            if geom is None:
                continue

            zone = determiner_localisation(geom, limite_commune)
            altitude = determiner_altitude(geom, mnt_index) if mnt_index else None

            t.zone_localisation_calculee = zone or ''
            t.altitude_calculee = altitude
            t.derniere_maj_geo = now
            t.save(update_fields=[
                'zone_localisation_calculee', 'altitude_calculee', 'derniere_maj_geo',
            ])
            count += 1

        self.stdout.write(self.style.SUCCESS(f'{count} terrain(s) mis à jour.'))

from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import IntegrityError, transaction


class Command(BaseCommand):
    help = 'Importe les donnees depuis un fixture JSON (ignore les conflits)'

    FIXTURE_PATH = Path(__file__).resolve().parent.parent.parent.parent / 'data' / 'fixtures' / 'initial_data.json'

    def add_arguments(self, parser):
        parser.add_argument('--input', '-i', type=str, help="Fichier d'entree")

    def handle(self, *args, **options):
        from django.core import serializers

        fixture_path = Path(options['input']) if options['input'] else self.FIXTURE_PATH
        if not fixture_path.exists():
            self.stderr.write(self.style.ERROR(f"Fichier introuvable : {fixture_path}"))
            self.stderr.write(self.style.NOTICE(
                "Utilisez d'abord 'python manage.py dump_project_data' pour creer le fixture"
            ))
            return

        self.stdout.write(self.style.NOTICE(f"Chargement de {fixture_path}..."))

        with open(fixture_path, 'r', encoding='utf-8') as f:
            raw = f.read()

        objects = serializers.deserialize('json', raw, use_natural_foreign_keys=True)

        total = 0
        errors = 0
        for obj in objects:
            try:
                with transaction.atomic():
                    obj.save()
                total += 1
            except IntegrityError:
                errors += 1

        self.stdout.write(self.style.SUCCESS(
            f"{total} objet(s) importe(s), {errors} conflit(s) ignore(s)"
        ))

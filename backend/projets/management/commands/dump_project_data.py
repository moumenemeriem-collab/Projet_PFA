from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Exporte les donnees utilisateur (hors seed data) en fixture JSON'

    FIXTURE_DIR = Path(__file__).resolve().parent.parent.parent.parent / 'data' / 'fixtures'

    SEED_MODELS = {
        'TypeProjet', 'Couche', 'ImportCouche', 'KnowledgeEntry',
    }

    def add_arguments(self, parser):
        parser.add_argument('--output', '-o', type=str, help='Fichier de sortie')
        parser.add_argument('--indent', type=int, default=2, help='Indentation JSON')
        parser.add_argument('--include-seed', action='store_true', help='Inclure aussi les donnees de seed')

    def handle(self, *args, **options):
        from django.core import serializers

        output_path = Path(options['output']) if options['output'] else self.FIXTURE_DIR / 'initial_data.json'
        output_path.parent.mkdir(parents=True, exist_ok=True)

        exclude = set() if options['include_seed'] else self.SEED_MODELS

        objects = []
        for app_label in ['accounts', 'projets', 'messagerie', 'chatbot']:
            app_config = self._get_app_config(app_label)
            if not app_config:
                continue
            for model in app_config.get_models():
                if model._meta.object_name in exclude:
                    continue
                qs = model.objects.all()
                count = qs.count()
                if count == 0:
                    continue
                for obj in qs:
                    objects.append(obj)

        if not objects:
            self.stdout.write(self.style.WARNING("Aucune donnee a exporter"))
            return

        data = serializers.serialize('json', objects, indent=options['indent'],
                                     use_natural_primary_keys=True,
                                     use_natural_foreign_keys=True)
        output_path.write_text(data, encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(
            f"{len(objects)} objet(s) exporte(s) vers {output_path}"
        ))

    def _get_app_config(self, app_label):
        from django.apps import apps
        try:
            return apps.get_app_config(app_label)
        except LookupError:
            return None

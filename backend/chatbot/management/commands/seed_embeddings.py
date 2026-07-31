import json
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Charge les connaissances foncières et génère les embeddings'

    def handle(self, *args, **options):
        from sentence_transformers import SentenceTransformer
        from chatbot.models import KnowledgeEntry

        json_path = Path(__file__).resolve().parent.parent.parent.parent / 'connaissances_foncier_maroc.json'
        if not json_path.exists():
            self.stderr.write(self.style.ERROR(f"Fichier non trouvé : {json_path}"))
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            entries = json.load(f)

        self.stdout.write(self.style.NOTICE(f"Chargement de {len(entries)} entrées..."))
        self.stdout.write(self.style.NOTICE("Chargement du modèle d'embedding (première fois = lent)..."))

        model = SentenceTransformer('all-MiniLM-L6-v2')

        for entry_data in entries:
            text = f"{entry_data['titre']}. {entry_data['contenu']}"
            embedding = model.encode(text).tolist()

            obj, created = KnowledgeEntry.objects.update_or_create(
                slug=entry_data['id'],
                defaults={
                    'categorie': entry_data['categorie'],
                    'titre': entry_data['titre'],
                    'contenu': entry_data['contenu'],
                    'embedding': embedding,
                },
            )
            self.stdout.write(f"  [{'OK' if created else 'MAJ'}] {entry_data['id']}: {entry_data['titre']}")

        self.stdout.write(self.style.SUCCESS(f"\n{len(entries)} entrées chargées avec succès."))

import json
from pathlib import Path

from django.db import migrations

JSON_PATH = Path(__file__).resolve().parent.parent.parent / 'connaissances_foncier_maroc.json'


def forwards(apps, schema_editor):
    KnowledgeEntry = apps.get_model('chatbot', 'KnowledgeEntry')
    if not JSON_PATH.exists():
        return
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    for entry in entries:
        KnowledgeEntry.objects.update_or_create(
            slug=entry['id'],
            defaults={
                'categorie': entry['categorie'],
                'titre': entry['titre'],
                'contenu': entry['contenu'],
            },
        )


def backwards(apps, schema_editor):
    KnowledgeEntry = apps.get_model('chatbot', 'KnowledgeEntry')
    if not JSON_PATH.exists():
        return
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    slugs = [entry['id'] for entry in entries]
    KnowledgeEntry.objects.filter(slug__in=slugs).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('chatbot', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

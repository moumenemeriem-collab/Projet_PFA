from django.db import migrations

TYPES_A_CONSERVER = ['Résidentiel', 'Bureaux', 'Commercial']


def forwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    TypeProjet.objects.filter(nom='Bureaux et services').update(nom='Bureaux')
    TypeProjet.objects.exclude(nom__in=TYPES_A_CONSERVER).update(actif=False)
    TypeProjet.objects.filter(nom__in=TYPES_A_CONSERVER).update(actif=True)


def backwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    TypeProjet.objects.filter(nom='Bureaux').update(nom='Bureaux et services')
    TypeProjet.objects.update(actif=True)


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0041_alter_parametreaffectation_categorie_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

from django.db import migrations


def clear_mnt_attributs(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    Couche.objects.filter(nom='mnt').update(attributs=[])


def reverse(apps, schema_editor):
    Couche = apps.get_model('projets', 'Couche')
    Couche.objects.filter(nom='mnt').update(attributs=[
        {'nom': 'altitude_min', 'type': 'number'},
        {'nom': 'altitude_max', 'type': 'number'},
        {'nom': 'pente_moyenne', 'type': 'number'},
    ])


class Migration(migrations.Migration):
    dependencies = [
        ('projets', '0023_update_typeprojet_images'),
    ]

    operations = [
        migrations.RunPython(clear_mnt_attributs, reverse),
    ]

# Generated manually for full population of parametres_affectation

from django.db import migrations


def populate_all_parametres(apps, schema_editor):
    from projets.management.commands.populate_parametres_affectation import Command
    cmd = Command()
    cmd.handle()


def rollback_all_parametres(apps, schema_editor):
    ParametreAffectation = apps.get_model('projets', 'ParametreAffectation')
    ParametreAffectation.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0040_populate_all_designations'),
    ]

    operations = [
        migrations.RunPython(populate_all_parametres, rollback_all_parametres),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0034_terrain_derniere_maj_geo_terrain_pente_calculee_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='terrain',
            old_name='pente_calculee',
            new_name='altitude_calculee',
        ),
        migrations.RenameField(
            model_name='ponderationpreference',
            old_name='preferences_pente',
            new_name='preferences_altitude',
        ),
        migrations.AlterField(
            model_name='ponderationpreference',
            name='preferences_altitude',
            field=models.JSONField(default=list, help_text='["lt100", "100_300", "gt300"]'),
        ),
    ]

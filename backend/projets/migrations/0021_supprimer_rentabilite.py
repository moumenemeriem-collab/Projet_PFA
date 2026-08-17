from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0020_terrain_complement_terrain_consistance_terrain_fid_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            'DROP VIEW IF EXISTS v_rentabilite; DROP TABLE IF EXISTS rentabilite;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

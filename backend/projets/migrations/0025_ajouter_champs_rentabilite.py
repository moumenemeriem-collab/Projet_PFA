from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('projets', '0024_clear_mnt_attributs'),
    ]

    operations = [
        migrations.AddField(
            model_name='projet',
            name='prix_foncier_m2',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='frais_acquisition',
            field=models.DecimalField(decimal_places=2, default=7, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='taux_chute',
            field=models.DecimalField(decimal_places=2, default=30, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='cos',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='cus',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='has_appartement',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='has_commerce',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='projet',
            name='has_bureau',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='projet',
            name='quote_part_appartement',
            field=models.DecimalField(decimal_places=2, default=100, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='quote_part_commerce',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='quote_part_bureau',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='prix_vente_appartement',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='prix_vente_commerce',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='prix_vente_bureau',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='cout_construction_appartement',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='cout_construction_commerce',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='cout_construction_bureau',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='taux_etudes_honoraires',
            field=models.DecimalField(decimal_places=2, default=10, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='taux_imprevus',
            field=models.DecimalField(decimal_places=2, default=5, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='taux_commercialisation',
            field=models.DecimalField(decimal_places=2, default=3, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='duree_construction',
            field=models.IntegerField(default=2),
        ),
        migrations.AddField(
            model_name='projet',
            name='duree_commercialisation',
            field=models.IntegerField(default=3),
        ),
        migrations.AddField(
            model_name='projet',
            name='taux_actualisation',
            field=models.DecimalField(decimal_places=2, default=8, max_digits=5),
        ),
        migrations.AddField(
            model_name='projet',
            name='repartition_construction',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='projet',
            name='repartition_ventes',
            field=models.JSONField(blank=True, null=True),
        ),
    ]

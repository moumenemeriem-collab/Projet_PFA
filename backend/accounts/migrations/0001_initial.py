# Generated manually for WebSIG auth

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Utilisateur',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prenom', models.CharField(max_length=100)),
                ('nom', models.CharField(max_length=100)),
                ('email', models.EmailField(max_length=150, unique=True, validators=[django.core.validators.EmailValidator()])),
                ('telephone', models.CharField(blank=True, max_length=20, null=True)),
                ('mot_de_passe_hash', models.CharField(max_length=255)),
                ('role', models.CharField(choices=[('investisseur', 'Investisseur'), ('admin', 'Admin')], default='investisseur', max_length=20)),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'utilisateur',
                'ordering': ['-date_creation'],
            },
        ),
    ]

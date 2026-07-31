from django.db import migrations


TYPE_PROJETS = [
    {
        'nom': 'Résidentiel',
        'description': 'Projets de logements collectifs, maisons individuelles ou résidences services.',
    },
    {
        'nom': 'Commercial',
        'description': 'Centres commerciaux, boutiques, espaces de vente et commerces de proximité.',
    },
    {
        'nom': 'Industriel',
        'description': "Zones d'activités, entrepôts, unités de production et logistique.",
    },
    {
        'nom': 'Touristique',
        'description': "Hôtels, résidences de tourisme, infrastructures d'accueil et loisirs.",
    },
    {
        'nom': 'Équipements publics',
        'description': 'Écoles, centres de santé, équipements sportifs et culturels.',
    },
    {
        'nom': 'Bureaux et services',
        'description': "Immeubles de bureaux, espaces de coworking et centres d'affaires.",
    },
]


def forwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    for tp in TYPE_PROJETS:
        TypeProjet.objects.get_or_create(
            nom=tp['nom'],
            defaults={'description': tp['description'], 'actif': True},
        )


def backwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    noms = [tp['nom'] for tp in TYPE_PROJETS]
    TypeProjet.objects.filter(nom__in=noms).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0002_terrain'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

from django.db import migrations

TYPE_PROJETS_COMPLEMENT = [
    {
        'nom': 'Mixte',
        'description': 'Projet combinant plusieurs usages tels que résidentiel, commercial ou bureaux.',
    },
    {
        'nom': 'Administratif',
        'description': 'Projet destiné aux bâtiments administratifs ou aux services publics.',
    },
    {
        'nom': 'Éducatif',
        'description': 'Établissements scolaires, universités, centres de formation ou instituts.',
    },
    {
        'nom': 'Sanitaire',
        'description': 'Hôpitaux, cliniques, centres de santé ou laboratoires médicaux.',
    },
    {
        'nom': 'Logistique',
        'description': 'Plateformes logistiques, centres de distribution ou zones de stockage.',
    },
    {
        'nom': 'Sportif et loisirs',
        'description': 'Complexes sportifs, stades, salles de sport, parcs ou espaces de loisirs.',
    },
]


def forwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    for tp in TYPE_PROJETS_COMPLEMENT:
        TypeProjet.objects.get_or_create(
            nom=tp['nom'],
            defaults={'description': tp['description'], 'actif': True},
        )


def backwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    noms = [tp['nom'] for tp in TYPE_PROJETS_COMPLEMENT]
    TypeProjet.objects.filter(nom__in=noms).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0005_couche_categorie'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

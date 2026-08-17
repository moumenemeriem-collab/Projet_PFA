from django.db import migrations


TYPE_PROJETS = [
    {
        'nom': 'Résidentiel',
        'description': "Projet destiné à la construction de logements individuels ou collectifs.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQGCQl6RwWTvDxnSSMsObsuy0GHaC5T-HRlbNV1E26R8w&s=10',
    },
    {
        'nom': 'Commercial',
        'description': "Projet destiné aux commerces, centres commerciaux, bureaux ou espaces de services.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQVCEN2c5IbV4pOyuQO2Qkh3uu61Eh7uSJPmMONhMIhEw&s=10',
    },
    {
        'nom': 'Industriel',
        'description': "Projet destiné aux activités industrielles, usines ou entrepôts.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS9khYd1K_LcQ5DIvU5jl_pLunoa1Ct4L8cxP_9wYN-3Q&s=10',
    },
    {
        'nom': 'Touristique',
        'description': "Projet destiné aux hôtels, complexes touristiques, résidences de vacances ou loisirs.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZGFMKNgk7PXOoZrJUVrhK_zfG0ypLSEuowInU0oEowQ&s=10',
    },
    {
        'nom': 'Mixte',
        'description': "Projet combinant plusieurs usages tels que résidentiel, commercial ou bureaux.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSeTP94liLJ4M0ErK51oBXfRR3FaafQBIPqhgmOa3RB4A&s=10',
    },
    {
        'nom': 'Administratif',
        'description': "Projet destiné aux bâtiments administratifs ou aux services publics.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-tANISw5H6sMZCZ7g-Mf3oz0K81zej7mOfnkTDJbwGA&s=10',
    },
    {
        'nom': 'Éducatif',
        'description': "Établissements scolaires, universités, centres de formation ou instituts.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQaO-CvuETdPCtOUqwPLd6CAk9WXGqQRvFy3GiiZNdMmQ&s=10',
    },
    {
        'nom': 'Sanitaire',
        'description': "Hôpitaux, cliniques, centres de santé ou laboratoires médicaux.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9be-yXHYh6UvZNLP2K-HYO8d9EtXnzQ9OyBnS7RH98Q&s=10',
    },
    {
        'nom': 'Logistique',
        'description': "Plateformes logistiques, centres de distribution ou zones de stockage.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREe7R3SCZ1hs8gAiy95aenq5VM4B6aQgNJt6Y4y2-VqA&s=10',
    },
    {
        'nom': 'Sportif et loisirs',
        'description': "Complexes sportifs, stades, salles de sport, parcs ou espaces de loisirs.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjlGnId3NCLh-4gAQ7dTOIhVAe_h6KEXl6FlwzpAzxKw&s=10',
    },
    {
        'nom': 'Équipements publics',
        'description': "Écoles, centres de santé, équipements sportifs et culturels.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRncwsDA6rTn1dwJdSie9fJsKjh9cTzKSjOFPAsu9xTDQ&s=10',
    },
    {
        'nom': 'Bureaux et services',
        'description': "Immeubles de bureaux, espaces de coworking et centres d'affaires.",
        'image_defaut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSx8jE2TRVwQvXK3V78-fyfoXzyxe6FpXk2iY3JuucOsA&s=10',
    },
]


def forwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    for tp in TYPE_PROJETS:
        TypeProjet.objects.get_or_create(
            nom=tp['nom'],
            defaults={
                'description': tp['description'],
                'image_defaut': tp['image_defaut'],
                'actif': True,
            },
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
    
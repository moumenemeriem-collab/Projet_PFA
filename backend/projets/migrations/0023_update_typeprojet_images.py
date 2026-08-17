from django.db import migrations

TYPE_PROJETS_IMAGES = {
    'Résidentiel': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQGCQl6RwWTvDxnSSMsObsuy0GHaC5T-HRlbNV1E26R8w&s=10',
    'Commercial': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQVCEN2c5IbV4pOyuQO2Qkh3uu61Eh7uSJPmMONhMIhEw&s=10',
    'Industriel': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS9khYd1K_LcQ5DIvU5jl_pLunoa1Ct4L8cxP_9wYN-3Q&s=10',
    'Touristique': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZGFMKNgk7PXOoZrJUVrhK_zfG0ypLSEuowInU0oEowQ&s=10',
    'Mixte': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSeTP94liLJ4M0ErK51oBXfRR3FaafQBIPqhgmOa3RB4A&s=10',
    'Administratif': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-tANISw5H6sMZCZ7g-Mf3oz0K81zej7mOfnkTDJbwGA&s=10',
    'Éducatif': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQaO-CvuETdPCtOUqwPLd6CAk9WXGqQRvFy3GiiZNdMmQ&s=10',
    'Sanitaire': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9be-yXHYh6UvZNLP2K-HYO8d9EtXnzQ9OyBnS7RH98Q&s=10',
    'Logistique': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREe7R3SCZ1hs8gAiy95aenq5VM4B6aQgNJt6Y4y2-VqA&s=10',
    'Sportif et loisirs': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjlGnId3NCLh-4gAQ7dTOIhVAe_h6KEXl6FlwzpAzxKw&s=10',
    'Équipements publics': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRncwsDA6rTn1dwJdSie9fJsKjh9cTzKSjOFPAsu9xTDQ&s=10',
    'Bureaux et services': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSx8jE2TRVwQvXK3V78-fyfoXzyxe6FpXk2iY3JuucOsA&s=10',
}


def forwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    for nom, image_defaut in TYPE_PROJETS_IMAGES.items():
        TypeProjet.objects.filter(nom=nom).update(image_defaut=image_defaut)


def backwards(apps, schema_editor):
    TypeProjet = apps.get_model('projets', 'TypeProjet')
    for nom in TYPE_PROJETS_IMAGES:
        TypeProjet.objects.filter(nom=nom).update(image_defaut=None)


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0022_changer_poids_analyse'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

import os
import django

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from projets.models import TypeProjet

types_data = [
    ('Résidentiel', 'Projet destiné à la construction de logements individuels ou collectifs.'),
    ('Commercial', 'Projet destiné aux commerces, centres commerciaux, bureaux ou espaces de services.'),
    ('Industriel', 'Projet destiné aux activités industrielles, usines ou entrepôts.'),
    ('Touristique', 'Projet destiné aux hôtels, complexes touristiques, résidences de vacances ou loisirs.'),
    ('Mixte', 'Projet combinant plusieurs usages tels que résidentiel, commercial ou bureaux.'),
    ('Administratif', 'Projet destiné aux bâtiments administratifs ou aux services publics.'),
    ('Éducatif', 'Établissements scolaires, universités, centres de formation ou instituts.'),
    ('Sanitaire', 'Hôpitaux, cliniques, centres de santé ou laboratoires médicaux.'),
    ('Logistique', 'Plateformes logistiques, centres de distribution ou zones de stockage.'),
    ('Sportif et loisirs', 'Complexes sportifs, stades, salles de sport, parcs ou espaces de loisirs.'),
]

for nom, desc in types_data:
    obj, created = TypeProjet.objects.get_or_create(nom=nom, defaults={'description': desc})
    status = 'CREATED' if created else 'EXISTS'
    print(f'  [{status}] {nom}')

print(f'\nTotal: {TypeProjet.objects.count()} types de projet')

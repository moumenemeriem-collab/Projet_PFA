#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERREUR : DATABASE_URL n'est pas défini. Sur Railway :"
  echo "  1. Crée une base PostgreSQL : New -> Database -> PostgreSQL"
  echo "  2. Sur le service Web, ajoute la variable : DATABASE_URL = \${{Postgres.DATABASE_URL}}"
  echo "  3. Redéploie."
  exit 1
fi

echo "==> Migrations..."
python manage.py migrate --noinput

echo "==> Seed des couches SIG..."
python manage.py seed_couches

echo "==> Création des tables des couches (PostgreSQL)..."
python manage.py init_couche_tables

echo "==> Seed des types de projet..."
python manage.py shell -c "from projets.models import TypeProjet; TypeProjet.objects.get_or_create(nom='Résidentiel', defaults={'code':'residentiel'}); TypeProjet.objects.get_or_create(nom='Commercial', defaults={'code':'commercial'}); TypeProjet.objects.get_or_create(nom='Industriel', defaults={'code':'industriel'}); TypeProjet.objects.get_or_create(nom='Mixte', defaults={'code':'mixte'}); print('Types de projet OK')" || echo "(seed_types ignoré)"

echo "==> Import des données (si fixtures présentes)..."
python manage.py load_project_data || echo "(load_project_data ignoré)"

echo "==> Statistiques tableau de bord..."
python manage.py refresh_dashboard_stats || echo "(refresh_dashboard_stats ignoré)"

echo "==> Collectstatic..."
python manage.py collectstatic --noinput

if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "==> Création du superutilisateur..."
  python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
U = get_user_model()
u = os.environ.get('DJANGO_SUPERUSER_USERNAME')
if not U.objects.filter(username=u).exists():
    U.objects.create_superuser(username=u, email=os.environ.get('DJANGO_SUPERUSER_EMAIL', ''), password=os.environ.get('DJANGO_SUPERUSER_PASSWORD'))
    print('Superutilisateur créé :', u)
else:
    print('Superutilisateur existant :', u)
"
fi

echo "==> Lancement de Gunicorn..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:"${PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile -

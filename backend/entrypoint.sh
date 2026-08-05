#!/bin/sh
set -e

echo "==> Migrations..."
python manage.py migrate --noinput

echo "==> Seed des couches SIG..."
python manage.py seed_couches || echo "(seed_couches ignoré)"

echo "==> Création des tables des couches (PostgreSQL)..."
python manage.py init_couche_tables || echo "(init_couche_tables ignoré)"

echo "==> Seed des types de projet..."
python seed_types.py || echo "(seed_types ignoré)"

echo "==> Import des données (si fixtures présentes)..."
python manage.py load_project_data || echo "(load_project_data ignoré)"

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

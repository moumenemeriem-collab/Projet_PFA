# WebSIG — Potentiel Foncier

Géoportail de potentiel foncier : React (Vite) + Django REST + PostgreSQL.

## Déploiement en ligne (Railway) — pour un accès public via une URL

Tout le monde pourra ouvrir l'application avec un simple navigateur, sans rien installer.

### 1. Prérequis
- Un compte sur [railway.app](https://railway.app) (gratuit) ;
- Le projet poussé sur GitHub (ou Railway Direct).

### 2. Créer le projet sur Railway
1. **New Project → Deploy from GitHub repo** → sélectionner ce dépôt (à la racine).
2. Railway détecte le `Dockerfile` (build du frontend + backend automatiquement).
3. Ajouter une base PostgreSQL : **New → Database → PostgreSQL**.
4. Dans les variables du service web, définir :
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (**obligatoire** — sélectionne `Postgres` dans le sélecteur de variable)
   - `DJANGO_DEBUG` = `False`
   - `DJANGO_SECRET_KEY` = une longue chaîne aléatoire
   - `USE_SQLITE` = `False`
   - `DJANGO_SUPERUSER_USERNAME` et `DJANGO_SUPERUSER_PASSWORD` (compte admin créé au démarrage)
   - `CORS_ALLOWED_ORIGINS` = `https://<ton-domaine>.up.railway.app`
   - `GUNICORN_WORKERS` = `2` (le chatbot est lourd en mémoire)

> Le conteneur refuse de démarrer si `DATABASE_URL` est absent (message d'erreur explicite) : l'application nécessite PostgreSQL.
5. Au démarrage, `entrypoint.sh` exécute automatiquement : `migrate`, seeds des couches SIG / types de projet, `collectstatic`, création du superutilisateur, puis lance Gunicorn.

### 3. Récupérer l'URL publique
Onglet **Settings → Networking → Generate Domain** → l'URL `https://xxx.up.railway.app` est à partager. Le visiteur n'a besoin que de cette adresse.

### 4. Données de ton application (projets, parcelles...)
Les données ne sont pas dans le dépôt. Deux façons :
- Importer depuis ta base locale :
  ```
  python manage.py dump_project_data            # génère data/fixtures/initial_data.json
  ```
  puis le déployer → il sera chargé automatiquement au démarrage ;
- Ou les saisir après déploiement via `/admin/`.

## Mode production local (test)

```
cd frontend && npm run build
Copy-Item -Recurse -Force frontend\dist\* backend\frontend_dist\
cd backend
$env:DJANGO_DEBUG="False"
$env:DJANGO_ALLOWED_HOSTS="localhost"
python manage.py migrate
python manage.py seed_couches
python manage.py init_couche_tables
python seed_types.py
python manage.py collectstatic
python manage.py runserver
```

## Mode développement

```
docker compose up -d        # PostgreSQL (optionnel, SQLite par défaut)
cd backend && python manage.py runserver
cd frontend && npm run dev  # proxy /api -> 127.0.0.1:8000
```

## Variables d'environnement (backend/.env)

| Variable | Défaut | Description |
|---|---|---|
| `DJANGO_DEBUG` | `True` | `False` en production |
| `DJANGO_SECRET_KEY` | dev | Clé secrète |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Domaines autorisés |
| `USE_SQLITE` | `True` | `False` pour PostgreSQL |
| `DATABASE_URL` | — | URL PostgreSQL (Railway la fournit) |
| `POSTGRES_*` | — | Identifiants PostgreSQL si pas de `DATABASE_URL` |
| `CORS_ALLOWED_ORIGINS` | localhost:5173 | Origines frontend autorisées |
| `DJANGO_MEDIA_ROOT` | `backend/media` | Dossier uploads |
| `DJANGO_SUPERUSER_*` | — | Compte admin créé au démarrage (prod) |

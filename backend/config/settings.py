"""
Django settings for config project.
"""

import os

import os

if os.name == 'nt':
    OSGEO4W = r"C:\Users\hp\AppData\Local\Programs\OSGeo4W"
    os.environ['OSGEO4W_ROOT'] = OSGEO4W
    os.environ['GDAL_DATA'] = OSGEO4W + r"\share\gdal"
    os.environ['PROJ_LIB'] = OSGEO4W + r"\share\proj"
    os.environ['PATH'] = OSGEO4W + r"\bin;" + os.environ['PATH']

    GDAL_LIBRARY_PATH = r"C:\Users\hp\AppData\Local\Programs\OSGeo4W\bin\gdal313.dll"
    GEOS_LIBRARY_PATH = r"C:\Users\hp\AppData\Local\Programs\OSGeo4W\bin\geos_c.dll"


from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY',
    'django-insecure-*)88!d7a46w*3(dqiv!$&$3d1!cz)by(o_oe#s=ahkp*_9m&n1',
)

DEBUG = os.getenv('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [h for h in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h]
ALLOWED_HOSTS += [d for d in (os.getenv('RAILWAY_PUBLIC_DOMAIN'), os.getenv('RAILWAY_PRIVATE_DOMAIN')) if d]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'accounts',
    'messagerie',
    'projets',
    'chatbot',
    'dashboard',
]

MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.getenv('DJANGO_MEDIA_ROOT', str(BASE_DIR / 'media')))

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

USE_SQLITE = os.getenv('USE_SQLITE', 'True').lower() in ('true', '1', 'yes')
DATABASE_URL = os.getenv('DATABASE_URL')

# Le modèle Terrain utilise un PolygonField : les moteurs doivent être des
# moteurs GeoDjango. Postgres nécessite l'extension `postgis` (voir
# docker-compose.yml et la migration 0024) ; SpatiaLite est nécessaire pour
# l'exécution en SQLite de développement.
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600),
    }
    DATABASES['default']['ENGINE'] = 'django.contrib.gis.db.backends.postgis'
elif USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.spatialite',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': os.getenv('POSTGRES_DB', 'websig'),
            'USER': os.getenv('POSTGRES_USER', 'websig'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'websig_secret'),
            'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Casablanca'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = Path(os.getenv('DJANGO_STATIC_ROOT', str(BASE_DIR / 'staticfiles')))

FRONTEND_DIST_DIR = Path(os.getenv('FRONTEND_DIST_DIR', str(BASE_DIR / 'frontend_dist')))
if (FRONTEND_DIST_DIR / 'index.html').exists():
    STATICFILES_DIRS = [str(FRONTEND_DIST_DIR)]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'accounts.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_CLAIM': 'user_id',
    'TOKEN_TYPE_CLAIM': 'token_type',
}

CORS_ALLOWED_ORIGINS = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173',
).split(',')
CORS_ALLOW_CREDENTIALS = True

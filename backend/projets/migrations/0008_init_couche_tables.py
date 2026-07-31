from django.db import migrations

SQL_CREATE_TABLES = """

CREATE TABLE IF NOT EXISTS "couche_cadastre" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "id_parcelle" TEXT,
    "section" TEXT,
    "numero" TEXT,
    "superficie" DOUBLE PRECISION,
    "commune" TEXT
);

CREATE TABLE IF NOT EXISTS "couche_plan_amenagement" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "zone" TEXT,
    "secteur" TEXT,
    "superficie" DOUBLE PRECISION,
    "coefficient" TEXT
);

CREATE TABLE IF NOT EXISTS "couche_reglement_pa" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "zone" TEXT,
    "regle" TEXT,
    "description" TEXT
);

CREATE TABLE IF NOT EXISTS "couche_limites_admin" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "nom" TEXT,
    "niveau" TEXT,
    "code" TEXT
);

CREATE TABLE IF NOT EXISTS "couche_equipements_publics" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "nom" TEXT,
    "type" TEXT,
    "categorie" TEXT,
    "commune" TEXT
);

CREATE TABLE IF NOT EXISTS "couche_reseau_routier" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "nom" TEXT,
    "type" TEXT,
    "revetement" TEXT,
    "longueur_km" DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS "couche_mnt" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "altitude_min" DOUBLE PRECISION,
    "altitude_max" DOUBLE PRECISION,
    "pente_moyenne" DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS "couche_prix_fonciers" (
    id BIGSERIAL PRIMARY KEY,
    geometry JSONB NOT NULL,
    "secteur" TEXT,
    "prix_m2_min" DOUBLE PRECISION,
    "prix_m2_max" DOUBLE PRECISION,
    "prix_m2_moyen" DOUBLE PRECISION,
    "annee" DOUBLE PRECISION
);
"""

SQL_DROP_TABLES = """

DROP TABLE IF EXISTS "couche_cadastre";
DROP TABLE IF EXISTS "couche_plan_amenagement";
DROP TABLE IF EXISTS "couche_reglement_pa";
DROP TABLE IF EXISTS "couche_limites_admin";
DROP TABLE IF EXISTS "couche_equipements_publics";
DROP TABLE IF EXISTS "couche_reseau_routier";
DROP TABLE IF EXISTS "couche_mnt";
DROP TABLE IF EXISTS "couche_prix_fonciers";
"""


class Migration(migrations.Migration):

    dependencies = [
        ('projets', '0007_seed_couches'),
    ]

    operations = [
        migrations.RunSQL(SQL_CREATE_TABLES, SQL_DROP_TABLES),
    ]

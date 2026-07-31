-- Table terrain_cadastral : données cadastrales permanentes
-- Nécessite l'extension PostGIS (CREATE EXTENSION IF NOT EXISTS postgis;)
-- SRID 4326 = WGS84 (latitude/longitude)

CREATE TABLE IF NOT EXISTS terrain_cadastral (
    id_terrain         BIGSERIAL       PRIMARY KEY,
    reference_cadastrale VARCHAR(50)   NOT NULL UNIQUE,
    titre_foncier       VARCHAR(100),
    superficie_m2       NUMERIC(12,2)  NOT NULL CHECK (superficie_m2 > 0),
    perimetre_m         NUMERIC(12,2)  NOT NULL CHECK (perimetre_m > 0),
    commune             VARCHAR(100)   NOT NULL,
    province_prefecture VARCHAR(100)   NOT NULL,
    region              VARCHAR(100)   NOT NULL,
    type_propriete      VARCHAR(50)    NOT NULL,
    statut_foncier      VARCHAR(50)    NOT NULL,
    occupation_sol      VARCHAR(100)   NOT NULL,
    adresse_localisation TEXT,
    geometrie           GEOMETRY(MultiPolygon, 4326) NOT NULL,
    date_importation    TIMESTAMP      NOT NULL DEFAULT now()
);

-- Index spatial GiST pour accélérer les requêtes géographiques
CREATE INDEX IF NOT EXISTS idx_terrain_cadastral_geometrie
    ON terrain_cadastral
    USING GIST (geometrie);

-- Index sur les colonnes de recherche courantes
CREATE INDEX IF NOT EXISTS idx_terrain_cadastral_commune
    ON terrain_cadastral (commune);

CREATE INDEX IF NOT EXISTS idx_terrain_cadastral_region
    ON terrain_cadastral (region);

CREATE INDEX IF NOT EXISTS idx_terrain_cadastral_statut
    ON terrain_cadastral (statut_foncier);

-- Commentaire sur la table
COMMENT ON TABLE terrain_cadastral IS
    'Données cadastrales permanentes des terrains. Ne contient aucun résultat d''analyse multicritère.';

COMMENT ON COLUMN terrain_cadastral.reference_cadastrale IS
    'Identifiant unique issu du plan cadastral (ex: 123/456)';

COMMENT ON COLUMN terrain_cadastral.titre_foncier IS
    'Numéro du titre foncier (optionnel, peut être NULL)';

COMMENT ON COLUMN terrain_cadastral.superficie_m2 IS
    'Superficie calculée depuis la géométrie (ST_Area) ou issue du cadastre';

COMMENT ON COLUMN terrain_cadastral.perimetre_m IS
    'Périmètre calculé depuis la géométrie (ST_Perimeter)';

COMMENT ON COLUMN terrain_cadastral.geometrie IS
    'Emprise du terrain en géographie WGS84 (EPSG:4326), MultiPolygon';

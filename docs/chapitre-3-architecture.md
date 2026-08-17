# Chapitre 3 : Architecture technique de la plateforme WebSIG « GEO INVEST »

Ce chapitre décrit l'architecture technique de la plateforme WebSIG **GEO INVEST**, dédiée à l'analyse du potentiel foncier dans la région de Rabat-Témara. Chaque affirmation s'appuie exclusivement sur les fichiers sources du projet livré : aucun composant ou technologie non présent dans le code n'est décrit, et les écarts éventuels entre le discours documentaire et l'implémentation réelle sont signalés explicitement.

## 3.1 Architecture générale

### 3.1.1 Vue d'ensemble

La plateforme adopte une **architecture web classique à trois tiers** :

1. **Client léger** : une application web monopage (SPA) développée en React (TypeScript), chargée dans le navigateur et servie statiquement par le serveur applicatif lui-même ;
2. **Serveur applicatif** : une API REST développée avec Django et le Django REST Framework (DRF), qui expose également l'interface (fichiers statiques du frontend compilé) et les fichiers média ;
3. **Serveur de données** : un système de gestion de base de données PostgreSQL, complété par des fichiers géographiques (GeoJSON, GPKG) stockés dans le dossier média de l'application.

Le tout est conteneurisé (Docker) et déployé sur la plateforme **Railway**, qui fournit la base PostgreSQL en environnement de production.

```
┌─────────────────────┐      HTTP / HTTPS       ┌──────────────────────┐
│    Navigateur       │  ┌───────────────────┐  │      Django / DRF    │
│  SPA React (Vite)   │──│ API REST (JSON)   │──│  (Gunicorn, WSGI)    │
│  Leaflet (CDN)      │  └───────────────────┘  │  Apps métier (5)     │
└─────────────────────┘                         └──────────┬───────────┘
                                                           │
                                                ┌──────────┴───────────┐
                                                │  PostgreSQL (JSONB)  │
                                                │  + fichiers GeoJSON/  │
                                                │  GPKG (media/couches) │
                                                └──────────────────────┘
```

### 3.1.2 Choix technologiques

Les choix technologiques observés dans le dépôt sont résumés dans le tableau suivant :

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 7 | Interface web monopage |
| Cartographie | Leaflet 1.9.4 (via CDN) | Visualisation cartographique |
| Géométrie client | @turf/intersect | Intersections parcelle / zone |
| Backend | Django 6, Django REST Framework, simplejwt | API REST, authentification JWT |
| Analyse spatiale | NumPy (Python) | Calculs géométriques et scoring |
| IA | sentence-transformers (all-MiniLM-L6-v2), Groq (llama-3.1-8b-instant) | Chatbot à base de connaissances (RAG) |
| Base de données | PostgreSQL 16 (Railway / docker-compose) | Persistance |
| Stockage géographique | JSONB (PostgreSQL) + fichiers GeoJSON / GPKG | Géométries des couches SIG |
| Déploiement | Docker multi-étapes, Gunicorn, WhiteNoise, Railway | Production |

### 3.1.3 Écart entre le discours documentaire et l'implémentation réelle

Deux points méritent d'être signalés avec rigueur, car ils constituent des écarts entre le discours commercial/documentaire et le code réel :

1. **PostGIS n'est pas utilisé au moment de l'exécution.** Le dépôt contient bien un script SQL activant l'extension PostGIS (`backend/sql/create_terrain_cadastral.sql` : table `terrain_cadastral` en `GEOMETRY(MultiPolygon, 4326)` avec index GiST), et le module `docker-compose.yml` utilise une image `postgres:16-alpine`. En revanche, le moteur d'analyse en production lit les géométries stockées en **JSONB** et effectue tous les calculs en **Python/NumPy**. Ce choix est explicité dans le code de `backend/projets/analyse.py` :

   > « Aucun besoin de PostGIS : les géométries GeoJSON (JSONB) sont lues en Python et les calculs de distances sont effectués avec numpy (approximation équirectangulaire locale, suffisante à l'échelle d'une commune). »

2. **GeoServer et les services OGC (WMS/WFS) ne font pas partie de l'architecture réelle.** Une entrée de la base de connaissances du chatbot évoque une diffusion des couches via « GeoServer » et les standards OGC, mais aucun code serveur correspondant n'existe : le dossier `geoserver/` du dépôt ne contient qu'un fichier texte vide (et est même exclu de l'image Docker via `.dockerignore`). En réalité, les couches sont diffusées à la carte directement par l'API Django (`/api/projets/couches/.../geojson/`). Cette mention relève du contenu rédactionnel du corpus de connaissances, non de l'implémentation.

De même, aucun outil de préparation des données (QGIS ou autre) n'est référencé dans le code ; les données sont présentes dans le dépôt sous forme de fichiers prêts à l'emploi (GeoJSON extraits du cadastre « CadGIS Témara », export OpenStreetMap pour le réseau routier et les équipements, et raster MNT au format GPKG), puis importées via l'interface d'administration. La chaîne de préparation en amont (production de ces fichiers) reste donc hors périmètre du code livré.

## 3.2 Architecture du backend

### 3.2.1 Organisation modulaire

Le backend Django est organisé en **cinq applications métier**, chacune responsable d'un domaine fonctionnel :

| Application | Responsabilité | Modèles principaux |
|---|---|---|
| `accounts` | Gestion des utilisateurs et de l'authentification | `Utilisateur`, tokens JWT |
| `projets` | Cœur du métier : projets d'investissement, terrains, couches SIG, analyses multicritères | `Projet`, `Terrain`, `TypeProjet`, `Couche`, `Analyse`, `ResultatAnalyse`, `ImportCouche` |
| `messagerie` | Messagerie interne et notifications | `Message`, `Reponse`, `Notification` |
| `dashboard` | Statistiques du tableau de bord administrateur et journalisation d'activité | `Activite`, `DashboardStats` |
| `chatbot` | Assistant conversationnel à base de connaissances | `KnowledgeEntry` |

Cette modularité suit le principe de séparation des responsabilités propre à Django : chaque domaine possède ses propres modèles, sérialiseurs, vues et URLs. Les dépendances entre applications restent orientées (par exemple `projets` référence `accounts.Utilisateur` comme investisseur ; `messagerie` et `projets` écrivent des traces dans `dashboard.Activite`).

### 3.2.2 Modèle de données métier

Le modèle de données reflète le cycle de vie d'une étude de potentiel foncier :

- **`TypeProjet`** : typologie des projets d'investissement (résidentiel, commercial…), référencée par les projets ;
- **`Projet`** : intitulé, description, type, surface souhaitée, budget total, données financières (prix du terrain, coût de construction, prix de vente unitaire, revenu estimé…) et lien vers l'investisseur (`Utilisateur`). Une méthode `calculer_rentabilite()` applique les formules de rentabilité (ROI, marge, seuil d'unités) ;
- **`Terrain`** : terrains candidats rattachés à un projet (superficie, latitude/longitude, notes d'accessibilité, de positionnement et de topographie sur une échelle de 1 à 10). Le score global est recalculé automatiquement à l'enregistrement (moyenne des trois notes) ;
- **`Couche`** : métadonnées d'une couche SIG (nom, nom d'affichage, catégorie, type de géométrie attendu, attributs déclaratifs en JSON, table associée en base, fichier source, état d'import) ;
- **`Analyse`** / **`ResultatAnalyse`** : exécutions sauvegardées de l'analyse multicritère ; une analyse enregistre ses filtres, les pondérations (AMC 0,70 / rentabilité 0,30 par défaut) et ses résultats par parcelle (scores, rentabilité, critères, points forts/faibles, rang) ;
- **`ImportCouche`** : historique des imports de fichiers géographiques (statut, message, nombre d'enregistrements).

### 3.2.3 Authentification et autorisation

Le modèle d'utilisateur est un **modèle personnalisé** (`accounts.models.Utilisateur`) défini sur une table dédiée `utilisateur` : il ne dérive pas d'`AbstractUser` de Django, mais reçoit les champs prénom, nom, email, téléphone, `mot_de_passe_hash` et le rôle (`investisseur` ou `admin`). Les méthodes `set_password` / `check_password` assurent le hachage des mots de passe.

L'authentification repose sur **JWT** (bibliothèque `djangorestframework-simplejwt`), adaptée par deux classes personnalisées :

- `accounts.authentication.JWTAuthentication`, sous-classe de l'authentification simplejwt, qui lit l'identifiant de l'utilisateur dans le champ `user_id` du jeton — configuré via `SIMPLE_JWT['USER_ID_CLAIM']` ;
- `accounts.authentication.JWTOptionalAuthentication`, variante **optionnelle** : les requêtes sont acceptées même sans jeton, mais l'utilisateur est alors anonyme. Ce mécanisme permet de servir des endpoints en accès libre (consultation de projets, analyse) tout en réservant les opérations d'écriture aux utilisateurs connectés.

La permission `accounts.permissions.IsAdmin` restreint les opérations d'administration. Par défaut, DRF impose l'authentification sur l'ensemble de l'API (`DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]`), les vues publiques la relâchant explicitement via `AllowAny` + `JWTOptionalAuthentication`. Les paramètres des jetons sont : accès 30 minutes, rafraîchissement 7 jours, rotation des jetons de rafraîchissement activée.

### 3.2.4 Gestion des données géospatiales et des couches SIG

**Stockage.** Les huit couches thématiques du projet (cadastre, plan d'aménagement, règlement PA, limites administratives, équipements publics, réseau routier, MNT, prix fonciers) sont décrites par la commande `projets/seed_couches`. Pour chacune, une **table PostgreSQL dédiée** est créée par la commande `init_couche_tables` avec le schéma suivant :

- une colonne `geometry JSONB NOT NULL` qui stocke la géométrie au format **GeoJSON** ;
- une colonne typée par attribut déclaré (`DOUBLE PRECISION` pour les numériques, `INTEGER` pour les entiers, `TEXT` pour les chaînes).

Ce choix du JSONB (plutôt que de types spatiaux PostGIS) simplifie l'import et le rend indépendant de l'extension spatiale, au prix de calculs effectués côté application.

**Import.** Le endpoint `importer_couche` (vues `projets/views.py`) applique un contrôle strict : seul le format **GeoJSON (.geojson)** est accepté, le type de géométrie du fichier doit correspondre à celui attendu par la couche, et les attributs du fichier doivent correspondre exactement à ceux déclarés (ni manquant, ni en surplus). Après validation, la table liée est tronquée, les enregistrements sont insérés via SQL brut, une copie horodatée du fichier est archivée dans `media/couches/<nom>/`, et l'import est journalisé. Le endpoint `telecharger_couche` régénère un fichier GeoJSON à partir de la base si aucun fichier n'est archivé.

**Lecture par le moteur d'analyse.** Les couches utilisées par l'analyse (cadastre, réseau routier, équipements publics, MNT) sont lues depuis ces tables au moyen de requêtes SQL, les géométries GeoJSON étant désérialisées en dictionnaires Python.

### 3.2.5 Moteur d'analyse multicritère (NumPy)

Le module `backend/projets/analyse.py` implémente le cœur décisionnel de la plateforme. Il réalise l'analyse multicritère des parcelles cadastrales d'un projet, sans dépendance à PostGIS :

- **Accessibilité routière** : les segments du réseau routier sont aplatis en tableaux NumPy ; la distance minimale point→segment est calculée de façon **vectorisée** pour chaque parcelle (approximation locale équirectangulaire : mètres par degré de latitude `LAT_M = 111320`). Le scoring par distance utilise des bandes prédéfinies (`DISTANCE_BANDS`) avec interpolation linéaire ;
- **Positionnement** : distance de la parcelle aux équipements publics (hôpitaux, écoles, commerces, transports…), agrégée par groupe d'équipements ;
- **Topographie (MNT)** : la classe `MNTAltitudeIndex` lit le raster numérique de terrain au format **GPKG** (tuiles GeoTIFF float32 compressées LZW) en interrogeant directement le fichier SQLite sous-jacent, puis en décodant manuellement les tuiles (lecture de l'IFD, décompression LZW, conversion en `np.ndarray`). L'altitude, la pente et le dénivelé sont estimés par échantillonnage local ;
- **Superficie** : adéquation entre la surface de la parcelle et la surface souhaitée du projet ;
- **Rentabilité** : le ROI est recalculé avec le prix du terrain de la parcelle lorsqu'il est connu (« personnalisée »), sinon repris d'une référence par type de projet (« benchmark »), puis normalisé dans [0, 100].

Le **score AMC** est une moyenne pondérée des sous-scores (accessibilité, positionnement, topographie, superficie), et le **score final** combine l'AMC et la rentabilité selon les pondérations du projet (`POIDS_AMC = 0.70`, `POIDS_RENTABILITE = 0.30`). Le module produit, pour chaque parcelle, la liste des critères avec leur valeur mesurée et leur conformité aux filtres demandés, ainsi que les points forts et les points faibles. Les parcelles sont ensuite classées par score décroissant.

### 3.2.6 Exposition des services (API REST)

Toutes les vues de l'application `projets` sont des **classes `APIView`** de DRF (il n'y a aucun `ViewSet` dans le projet) ou des vues fonctionnelles décorées (`@api_view`). Les endpoints principaux sont regroupés sous `/api/projets/` :

- projets : liste/recherche/pagination, détail, création, modification, suppression ;
- terrains : liste, création, suppression ;
- analyses : analyse multicritère des parcelles (`POST /api/projets/<id>/analyse-parcelles/`), analyse « terrain » simplifiée, historique des analyses sauvegardées, détails et résultats ;
- couches : liste (résumé ou détaillée), détail, import GeoJSON, téléchargement.

Les vues appliquent une logique de contrôle d'accès cohérente : la consultation est ouverte à tous, la création/modification/suppression est réservée à l'investisseur propriétaire du projet ou à un administrateur, et chaque opération d'écriture est journalisée dans `Activite`.

### 3.2.7 Tableau de bord administratif

L'application `dashboard` maintient un singleton `DashboardStats` (clé primaire 1) regroupant l'ensemble des indicateurs : effectifs et répartition des utilisateurs par rôle, évolution mensuelle (agrégation `TruncMonth` sur 12 mois), couches (créées/modifiées/supprimées), analyses, nombre de parcelles cadastrales (décomptées en lisant le dernier fichier GeoJSON du cadastre), messages, notifications non lues, journal d'activité. 

Les statistiques sont **pré-calculées** puis mises en cache : elles sont rafraîchies si elles sont absentes ou âgées de plus de 5 minutes (`STALE_SECONDS = 300`). Deux mécanismes d'actualisation coexistent : un recalcul complet (`refresh_dashboard_stats`, également invoqué par une commande de gestion) et une mise à jour incrémentale déclenchée par un **signal** (`dashboard/signals.py`, enregistré dans `ready()` de l'AppConfig) à chaque entrée de journal `Activite`.

### 3.2.8 Assistant conversationnel (chatbot RAG)

L'application `chatbot` implémente un assistant à base de **recherche augmentée (RAG)** :

- un corpus `connaissances_foncier_maroc.json` (foncier, urbanisme, fiscalité immobilière marocaine) est vectorisé par le modèle **sentence-transformers `all-MiniLM-L6-v2`** (command `seed_embeddings`) ; les vecteurs sont stockés dans le champ JSON `embedding` de `KnowledgeEntry` ;
- à chaque question, la requête est encodée et comparée à la matrice des embeddings (produit scalaire avec des vecteurs normalisés) ; les trois extraits les plus proches (seuil de similarité 0,15) forment le contexte ;
- le prompt système, l'historique (10 derniers messages) et le contexte sont transmis au modèle **`llama-3.1-8b-instant`** de **Groq** ; la réponse est **streamée en temps réel** au navigateur via une réponse HTTP `text/event-stream` (`StreamingHttpResponse`), chaque jeton étant envoyé au format SSE. La clé API est lue depuis les variables d'environnement (`GROQ_API_KEY`).

### 3.2.9 Configuration et déploiement

La configuration (`config/settings.py`) est pilotée par variables d'environnement :

- la base de données est initialisée par **`dj-database-url`** à partir de `DATABASE_URL` (obligatoire en production) ; à défaut, une base SQLite ou une configuration PostgreSQL explicite peut être utilisée en développement ;
- `ALLOWED_HOSTS` s'enrichit automatiquement des domaines fournis par Railway (`RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PRIVATE_DOMAIN`) ;
- le middleware **WhiteNoise** sert les fichiers statiques, y compris le build du frontend (`frontend_dist`) lorsqu'il est présent ;
- CORS est configuré pour le serveur de développement Vite (`localhost:5173`).

Le **Dockerfile multi-étapes** compile d'abord le frontend dans une image `node:22-alpine` (`npm ci && npm run build`), puis assemble l'environnement d'exécution `python:3.12-slim` en copiant le build. Le script `backend/entrypoint.sh` orchestre le démarrage : migration de la base, rafraîchissement des statistiques, seed des couches, création des tables de couches, seed des types de projet et des données, collecte des fichiers statiques, création éventuelle du superutilisateur, puis lancement de **Gunicorn** (`config.wsgi:application`). En production, les routes non-API sont renvoyées vers `index.html` de la SPA (`config.views.spa_index`), et les médias sont servis par `config.views.media_serve`.

## 3.3 Architecture du frontend

### 3.3.1 Organisation de la SPA

Le frontend est une **application monopage React 19 en TypeScript**, construite avec **Vite 8**. L'arborescence `frontend/src` distingue clairement les responsabilités :

```
src/
├── api/            # Services d'appel à l'API REST (auth, projets, analyses,
│                   # couches, terrains, dashboard, admin, messagerie, profile)
├── components/     # Composants réutilisables (DashboardLayout, ChatbotWidget, icons…)
├── pages/          # Pages de l'application (home, about, login, register, projects,
│                   # create-project, ranking-projects, classement, geoportal,
│                   # messages, profile, admin/*)
├── utils/          # Utilitaires métier (pdfPlan, affectations, terrainDims,
│                   # attributeLabels…)
└── i18n/           # Gestion du multilinguisme (fr, en, ar)
```

Le routage est assuré par **React Router 7** (`BrowserRouter`) dans `App.tsx`. Deux composants de garde contrôlent l'accès aux pages : `GuestGuard` (pages publiques accessibles aux visiteurs non connectés) et `AuthGuard` (pages réservées aux utilisateurs authentifiés). Après connexion, la redirection est adaptée au rôle via la fonction `getPostAuthRedirect` (investisseur vers son espace, administrateur vers le tableau de bord).

### 3.3.2 Gestion de session et appels API

Le projet n'utilise pas de contexte React global ni de bibliothèque de gestion d'état : la session est gérée par une couche de services dans `src/api/`. Le module `auth.ts` encapsule l'appel HTTP (`fetch`), gère les **jetons JWT stockés dans `localStorage`** (access et refresh), attache l'en-tête `Authorization: Bearer …`, tente le **rafraîchissement automatique** du jeton lors d'une réponse 401, et normalise les erreurs dans une classe `ApiError` (dont les messages sont formulés en français). Chaque domaine dispose de son module de services (projets, analyses, couches, terrains, dashboard, admin, messagerie, profile) avec des interfaces TypeScript typées.

### 3.3.3 Visualisation cartographique (Leaflet)

La page « Géoportail » (`src/pages/geoportal.tsx`) constitue le cœur WebSIG de l'interface. Elle repose sur **Leaflet 1.9.4 chargé par CDN** (feuille de style et script dans `index.html`) et exploité via la variable globale `L` — Leaflet n'apparaît pas dans `package.json` :

```ts
const map = L.map(mapEl, { center: [33.88, -6.98], zoom: 12 })
```

La carte propose plusieurs fonds (OpenStreetMap, satellite, topographique), l'affichage des **couches SIG** (récupérées via `fetchCoucheGeoJSON`, qui interroge l'API Django), les parcelles cadastrales, et la sélection de parcelles pour l'analyse. Les opérations géométriques côté client (intersections parcelle / zone, calcul des affectations) sont réalisées avec **@turf/intersect** (package npm) dans `src/utils/affectations.ts`.

### 3.3.4 Traitements métier côté client

Plusieurs utilitaires réalisent des calculs métier directement dans le navigateur :

- `utils/pdfPlan.ts` : génération **manuelle** d'un document PDF (projection **EPSG:26191** — Lambert Maroc — implémentée en dur, sans bibliothèque tierce) pour l'édition d'un plan ;
- `utils/terrainDims.ts` : dimensionnement de terrains ;
- `utils/attributeLabels.ts` : libellés des attributs cadastraux ;
- `pages/admin/dashboard.tsx` : tableaux de bord construits en **SVG pur** (donut charts) à partir des statistiques de l'API, avec rafraîchissement périodique ;
- `pages/classement.tsx` : classement des parcelles avec seuils de notation (score élevé ≥ 70, moyen ≥ 40, faible sinon) et badges de conformité.

### 3.3.5 Internationalisation

L'application est **trilingue** (français, anglais, arabe). Le module `src/i18n/index.ts` charge les dictionnaires par langue et persiste la préférence dans `localStorage` (clé `lang`). La langue **arabe est rendue en droite-à-gauche (RTL)**, ce qui permet d'adapter l'interface aux utilisateurs marocains. Le composant `ChatbotWidget` conserve par ailleurs l'historique des conversations dans `localStorage`.

## 3.4 Synthèse

L'architecture de « GEO INVEST » combine une **SPA React/TypeScript** à une **API Django REST**, le tout reposant sur **PostgreSQL**. Trois enseignements se dégagent de l'analyse du code :

1. **Un WebSIG cohérent et réaliste** : la chaîne complète — stockage des couches (GeoJSON/JSONB), import contrôlé, moteur d'analyse multicritère, classement des parcelles, visualisation Leaflet — est présente et fonctionnelle, avec un volume de code conséquent et structuré.

2. **Des choix techniques volontairement simplifiés et documentés** : l'analyse spatiale est effectuée en **Python/NumPy** sur des géométries JSONB plutôt qu'avec PostGIS, et la cartographie client repose sur **Leaflet via CDN** plutôt que sur un package npm. Ces choix, explicites dans le code, réduisent les dépendances système et l'empreinte de déploiement, au prix de performances spatiales moindres à très grande échelle.

3. **Des écarts entre le discours documentaire et l'implémentation** qu'il convient d'être honnête dans le rapport : **PostGIS** est préparé par un script SQL mais non utilisé en production, et **GeoServer / WMS / WFS** ne sont évoqués que dans le corpus de connaissances du chatbot sans aucune implémentation réelle — les couches étant diffusées par l'API Django elle-même.

Sur le plan de l'évolution, les points d'extension naturels identifiés sont : le basculement éventuel vers des types spatiaux PostGIS et les opérateurs géométriques du SGBD pour les très grands volumes, l'indexation spatiale GiST déjà préparée dans le script SQL, et la parallélisation des calculs d'analyse (actuellement séquentiels sur l'ensemble des parcelles).

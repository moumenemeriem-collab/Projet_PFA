"""Analyse multicritère réelle basée sur les couches SIG.

Couches utilisées :
- ``couche_cadastre``            : unités d'analyse (parcelles cadastrales)
- ``couche_reseau_routier``      : accessibilité routière
- ``couche_equipements_publics`` : positionnement (équipements publics)
- ``couche_mnt`` (raster GPKG)   : topographie (altitude, pente, dénivelé)

Aucun besoin de PostGIS : les géométries GeoJSON (JSONB) sont lues en Python
et les calculs de distances sont effectués avec numpy (approximation
équirectangulaire locale, suffisante à l'échelle d'une commune).
"""

import json
import math
import os
import sqlite3
import struct

import numpy as np
from django.conf import settings
from django.db import connection



LAT_M = 111320.0  # mètres par degré de latitude


def _coslat(lat: float) -> float:
    return max(0.0, math.cos(math.radians(lat)))


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance en mètres entre deux points (WGS84)."""
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000.0 * math.asin(math.sqrt(a))


def _polygon_rings(geometry: dict):
    """Renvoie la liste des anneaux (listes de [lng, lat]) d'un Polygon/MultiPolygon."""
    gtype = geometry.get('type')
    coords = geometry.get('coordinates') or []
    if gtype == 'Polygon':
        return list(coords)
    if gtype == 'MultiPolygon':
        rings = []
        for poly in coords:
            rings.extend(poly)
        return rings
    return []


def polygon_centroid(geometry: dict):
    """Centre de gravité (lat, lng) de la plus grande enveloppe d'un polygone."""
    best = None
    best_area = -1.0
    for ring in _polygon_rings(geometry):
        if len(ring) < 3:
            continue
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        cosl = _coslat(sum(ys) / len(ys))
        area = 0.0
        cx = cy = 0.0
        for i in range(len(ring) - 1):
            x1, y1 = xs[i], ys[i]
            x2, y2 = xs[i + 1], ys[i + 1]
            cross = (x1 * cosl) * y2 - (x2 * cosl) * y1
            area += cross
            cx += (x1 + x2) * cosl * cross
            cy += (y1 + y2) * cross
        area = area / 2.0
        if abs(area) < 1e-12:
            continue
        if abs(area) > best_area:
            best_area = abs(area)
            lat = cy / (6 * area)
            lng = cx / (6 * area * cosl)
            best = (lat, lng)
    return best


def polygon_perimeter_m(geometry: dict) -> float:
    total = 0.0
    for ring in _polygon_rings(geometry):
        for i in range(len(ring) - 1):
            lng1, lat1 = ring[i]
            lng2, lat2 = ring[i + 1]
            total += haversine(lat1, lng1, lat2, lng2)
    return total


# ---------------------------------------------------------------------------
# Plan d'aménagement : localisation (point dans polygone)
# ---------------------------------------------------------------------------

def _point_in_ring(lat, lng, ring):
    """Ray casting point-in-polygon pour un anneau (liste de [lng, lat])."""
    n = len(ring)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def point_in_polygon(lat, lng, geometry):
    """Retourne True si (lat, lng) est contenu dans le polygone (Polygon/MultiPolygon)."""
    gtype = (geometry or {}).get('type')
    if gtype == 'Polygon':
        rings = geometry.get('coordinates') or []
        if not rings or not _point_in_ring(lat, lng, rings[0]):
            return False
        for hole in rings[1:]:
            if _point_in_ring(lat, lng, hole):
                return False
        return True
    if gtype == 'MultiPolygon':
        for poly in geometry.get('coordinates') or []:
            rings = poly
            if not rings or not _point_in_ring(lat, lng, rings[0]):
                continue
            inside = True
            for hole in rings[1:]:
                if _point_in_ring(lat, lng, hole):
                    inside = False
                    break
            if inside:
                return True
    return False


# Mapping STRICT : seuls les polygones explicitement classés produisent une
# catégorie. Les codes réels de l'attribut `affectation` du plan d'aménagement
# doivent être ajoutés ici. Le jeu de données actuel ne contient que des codes
# de parcelle dans `designation` -> la plupart des terrains seront donc
# 'zone_indeterminee' (None) jusqu'à ce que le mapping soit complété.
def _load_commune_limite():
    """Charge la géométrie (Multi/Polygon GeoJSON) de la limite communale de Témara.

    Sert de référence administrative pour classer un terrain en 'centre_ville'
    (centroïde dans la commune) ou 'periurbaine' (centroïde hors commune).

    Source prioritaire : la couche SIG ``limites_admin`` (table
    ``couche_limites_admin``) importée en base. Repli sur le fichier GeoJSON
    livré si la couche n'est pas encore peuplée.
    """
    # 1) Couche SIG en base (table couche_limites_admin)
    try:
        with connection.cursor() as cur:
            cur.execute('SELECT geometry, "nom" FROM couche_limites_admin')
            rows = cur.fetchall()
        if rows:
            chosen = None
            for geometry, nom in rows:
                if nom and 'temara' in str(nom).lower():
                    chosen = geometry
                    break
            if chosen is None:
                chosen = rows[0][0]
            if isinstance(chosen, str):
                try:
                    return json.loads(chosen)
                except Exception:
                    return None
            return chosen
    except Exception:
        pass

    # 2) Repli sur le fichier GeoJSON livré
    geojson_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'data', 'Commune_Temara.geojson',
    )
    if not os.path.exists(geojson_path):
        return None
    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return None
    features = data.get('features') or []
    if not features:
        return None
    return features[0].get('geometry')


def determiner_localisation(terrain_geom, limite_commune):
    """Retourne la catégorie de localisation du terrain ('centre_ville' ou
    'periurbaine') en testant le centroïde du terrain contre la limite
    administrative de la commune de Témara (point dans polygone).

    Si la géométrie du terrain est invalide, retourne None (score 0).
    """
    if not terrain_geom or not limite_commune:
        return None
    centroid = polygon_centroid(terrain_geom)
    if centroid is None:
        return None
    lat, lng = centroid
    if point_in_polygon(lat, lng, limite_commune):
        return 'centre_ville'
    return 'periurbaine'


def _seg_distances_m(plat: float, plon: float,
                     s_lat: np.ndarray, s_lon: np.ndarray,
                     e_lat: np.ndarray, e_lon: np.ndarray,
                     coslat: float) -> np.ndarray:
    """Distances point→segment (en mètres) vectorisées (approximation locale)."""
    lon_m = LAT_M * coslat
    x0 = plon * lon_m
    y0 = plat * LAT_M
    x1 = s_lon * lon_m
    y1 = s_lat * LAT_M
    x2 = e_lon * lon_m
    y2 = e_lat * LAT_M
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx * dx + dy * dy
    t = np.zeros_like(x1)
    nz = l2 > 0
    if np.any(nz):
        t[nz] = ((x0 - x1[nz]) * dx[nz] + (y0 - y1[nz]) * dy[nz]) / l2[nz]
    t = np.clip(t, 0.0, 1.0)
    px = x1 + t * dx
    py = y1 + t * dy
    return np.sqrt((x0 - px) ** 2 + (y0 - py) ** 2)


# ---------------------------------------------------------------------------
# MNT : lecture du raster GPKG (tuiles GeoTIFF, float32, compression LZW)
# ---------------------------------------------------------------------------

class MNTAltitudeIndex:
    """Index des altitudes issu du raster MNT (GPKG gridded tiles)."""

    _TILE = 256

    def __init__(self, gpkg_path: str, zoom: int = 3):
        self.path = gpkg_path
        self.zoom = zoom
        self._cache = {}
        conn = sqlite3.connect(gpkg_path)
        try:
            row = conn.execute(
                'SELECT min_x, min_y, max_x, max_y FROM gpkg_tile_matrix_set LIMIT 1'
            ).fetchone()
            self.min_lng, self.min_lat, self.max_lng, self.max_lat = row
            self.available = set(
                conn.execute(
                    'SELECT tile_column, tile_row FROM MNT WHERE zoom_level=?',
                    (zoom,),
                ).fetchall()
            )
        finally:
            conn.close()
        self.n = 2 ** zoom
        self.tile_w = (self.max_lng - self.min_lng) / self.n
        self.tile_h = (self.max_lat - self.min_lat) / self.n

    def _decode_tile(self, col: int, row: int) -> np.ndarray:
        key = (col, row)
        if key in self._cache:
            return self._cache[key]
        conn = sqlite3.connect(self.path)
        try:
            blob = conn.execute(
                'SELECT tile_data FROM MNT WHERE zoom_level=? AND tile_column=? AND tile_row=?',
                (self.zoom, col, row),
            ).fetchone()
        finally:
            conn.close()
        if not blob:
            arr = np.full((self._TILE, self._TILE), -9999.0, dtype='<f4')
            self._cache[key] = arr
            return arr
        arr = _decode_geotiff_float32(blob[0])
        self._cache[key] = arr
        return arr

    def altitude_at(self, lat: float, lng: float):
        """Altitude (m) au point donné, ou None si hors couverture / nodata."""
        if not (self.min_lng <= lng <= self.max_lng and self.min_lat <= lat <= self.max_lat):
            return None
        col = int((lng - self.min_lng) // self.tile_w)
        row = int((self.max_lat - lat) // self.tile_h)
        col = max(0, min(col, self.n - 1))
        row = max(0, min(row, self.n - 1))
        if (col, row) not in self.available:
            return None
        arr = self._decode_tile(col, row)
        fx = ((lng - self.min_lng) - col * self.tile_w) / self.tile_w
        fy = ((self.max_lat - lat) - row * self.tile_h) / self.tile_h
        px = max(0, min(int(fx * self._TILE), self._TILE - 1))
        py = max(0, min(int(fy * self._TILE), self._TILE - 1))
        v = float(arr[py, px])
        if v <= -9990.0:
            return None
        return v

    def pixel_resolution_m(self, lat: float):
        """Résolution réelle d'un pixel du MNT en mètres (lat, lng) à la latitude lat.

        Déduite des métadonnées de la matrice de tuiles (gpkg_tile_matrix_set) :
        l'emprise est couverte par ``n = 2**zoom`` tuiles de ``_TILE`` pixels de côté.
        """
        lat_span = (self.max_lat - self.min_lat) or 1.0
        lng_span = (self.max_lng - self.min_lng) or 1.0
        px_per_deg_lat = (self._TILE * self.n) / lat_span
        px_per_deg_lng = (self._TILE * self.n) / lng_span
        res_lat_m = LAT_M / px_per_deg_lat
        res_lng_m = (LAT_M * _coslat(lat)) / px_per_deg_lng
        return res_lat_m, res_lng_m


def determiner_altitude(terrain_geom, mnt_index, max_points=250):
    """Altitude (m) zonale d'un terrain : médiane des altitudes lues sur une grille
    d'échantillons couvrant le polygone (résolution réelle du MNT).

    La médiane est utilisée comme statistique robuste. Retourne None si le MNT
    est absent ou ne couvre pas le terrain (AUCUN fallback fictif).
    """
    if mnt_index is None or not terrain_geom:
        return None
    centroid = polygon_centroid(terrain_geom)
    if centroid is None:
        return None
    lat0, lng0 = centroid
    res_lat_m, res_lng_m = mnt_index.pixel_resolution_m(lat0)
    if res_lat_m <= 0 or res_lng_m <= 0:
        return None

    min_lat, min_lng, max_lat, max_lng = 1e9, 1e9, -1e9, -1e9
    for ring in _polygon_rings(terrain_geom):
        for lng, lat in ring:
            min_lat = min(min_lat, lat)
            max_lat = max(max_lat, lat)
            min_lng = min(min_lng, lng)
            max_lng = max(max_lng, lng)
    if max_lat < min_lat or max_lng < min_lng:
        return None

    dlat_deg = res_lat_m / LAT_M
    dlng_deg = res_lng_m / (LAT_M * _coslat(lat0))
    n_lat = max(1, int((max_lat - min_lat) / dlat_deg))
    n_lng = max(1, int((max_lng - min_lng) / dlng_deg))
    total = n_lat * n_lng
    if total > max_points:
        scale = math.sqrt(max_points / total)
        n_lat = max(1, int(n_lat * scale))
        n_lng = max(1, int(n_lng * scale))

    altitudes = []
    for i in range(n_lat):
        la = min_lat + (i + 0.5) * (max_lat - min_lat) / n_lat
        for j in range(n_lng):
            lo = min_lng + (j + 0.5) * (max_lng - min_lng) / n_lng
            if point_in_polygon(la, lo, terrain_geom):
                v = mnt_index.altitude_at(la, lo)
                if v is not None:
                    altitudes.append(v)
    if not altitudes:
        return None
    altitudes.sort()
    n = len(altitudes)
    median = altitudes[n // 2] if n % 2 == 1 else (altitudes[n // 2 - 1] + altitudes[n // 2]) / 2.0
    return round(median, 1)


def _lzw_decode(data: bytes) -> bytes:
    out = bytearray()
    code_len = 9
    table = {i: bytes([i]) for i in range(256)}
    table[256] = b''
    table[257] = b''
    next_code = 258
    bit_buf = 0
    bit_cnt = 0
    prev = None
    nbytes = len(data)
    i = 0
    while True:
        while bit_cnt < code_len:
            if i >= nbytes:
                return bytes(out)
            bit_buf = (bit_buf << 8) | data[i]
            i += 1
            bit_cnt += 8
        bit_cnt -= code_len
        code = (bit_buf >> bit_cnt) & ((1 << code_len) - 1)
        if code == 256:
            table = {i: bytes([i]) for i in range(256)}
            table[256] = b''
            table[257] = b''
            next_code = 258
            code_len = 9
            prev = None
            continue
        if code == 257:
            return bytes(out)
        if code in table:
            entry = table[code]
        elif prev is not None:
            entry = prev + prev[:1]
        else:
            return bytes(out)
        out.extend(entry)
        if prev is not None and next_code < 4096:
            table[next_code] = prev + entry[:1]
            next_code += 1
            if next_code == 511 and code_len == 9:
                code_len = 10
            elif next_code == 1023 and code_len == 10:
                code_len = 11
            elif next_code == 2047 and code_len == 11:
                code_len = 12
        prev = entry
    return bytes(out)


def _decode_geotiff_float32(data: bytes) -> np.ndarray:
    byteorder = '<' if data[:2] == b'II' else '>'
    ifd = struct.unpack(byteorder + 'I', data[4:8])[0]
    n = struct.unpack(byteorder + 'H', data[ifd:ifd + 2])[0]

    def get(tag, default=None):
        for i in range(n):
            e = ifd + 2 + i * 12
            t = struct.unpack(byteorder + 'H', data[e:e + 2])[0]
            if t != tag:
                continue
            typ = struct.unpack(byteorder + 'H', data[e + 2:e + 4])[0]
            cnt = struct.unpack(byteorder + 'I', data[e + 4:e + 8])[0]
            val = data[e + 8:e + 12]
            if typ == 3:
                return struct.unpack(byteorder + 'H', val[:2])[0]
            if typ == 4:
                return struct.unpack(byteorder + 'I', val[:4])[0]
            if typ == 1:
                return val[0]
        return default

    width = get(256, 256)
    height = get(257, 256)
    strip_off = get(273, 0)
    strip_bytes = get(279, 0)
    count = width * height
    raw = _lzw_decode(data[strip_off:strip_off + strip_bytes])
    if len(raw) < count * 4:
        raw = raw + b'\x00' * (count * 4 - len(raw))
    return np.frombuffer(raw[:count * 4], dtype='<f4').reshape(height, width)


# ---------------------------------------------------------------------------
# Chargement des couches
# ---------------------------------------------------------------------------

def _load_parcels() -> list:
    cols = [
        'id', 'geometry', 'fid', 'indice', 'complement', 'Consistance', 'num', 'surface',
    ]
    query = (
        'SELECT id, geometry, fid, indice, complement, "Consistance", num, surface '
        'FROM couche_cadastre ORDER BY id'
    )
    parcels = []
    with connection.cursor() as cur:
        cur.execute(query)
        for row in cur.fetchall():
            d = dict(zip(cols, row))
            if isinstance(d['geometry'], str):
                d['geometry'] = json.loads(d['geometry'])
            centroid = polygon_centroid(d['geometry'])
            if centroid is None:
                continue
            parcels.append({
                **d,
                'lat': centroid[0],
                'lng': centroid[1],
                'perimetre': polygon_perimeter_m(d['geometry']),
            })
    return parcels


def _load_routes():
    """Segments routiers aplatis (numpy) avec leur classe et leur nom."""
    with connection.cursor() as cur:
        cur.execute(
            'SELECT geometry, highway, name FROM couche_reseau_routier'
        )
        rows = cur.fetchall()

    s_lat, s_lon, e_lat, e_lon = [], [], [], []
    highway, names = [], []
    for geometry, hway, name in rows:
        if isinstance(geometry, str):
            geometry = json.loads(geometry)
        coords = geometry.get('coordinates') or []
        for line in coords:
            for i in range(len(line) - 1):
                lng1, lat1 = line[i]
                lng2, lat2 = line[i + 1]
                s_lon.append(lng1)
                s_lat.append(lat1)
                e_lon.append(lng2)
                e_lat.append(lat2)
                highway.append(hway or '')
                names.append(name or '')
    return {
        's_lat': np.array(s_lat, dtype='f8'),
        's_lon': np.array(s_lon, dtype='f8'),
        'e_lat': np.array(e_lat, dtype='f8'),
        'e_lon': np.array(e_lon, dtype='f8'),
        'highway': highway,
        'name': names,
    }


# Correspondance type_construction (PA Temara) → catégorie de scoring
_TYPE_CONSTRUCTION_TO_AMENITY = {
    # Santé
    'Santé': 'hospital',
    'sante': 'hospital',
    'Hôpital': 'hospital',
    'Clinique': 'clinic',
    'Pharmacie': 'pharmacy',
    # Éducation
    'Éducation': 'school',
    'education': 'school',
    'Ecole': 'school',
    'École': 'school',
    'Lycée': 'school',
    'Collège': 'college',
    'Université': 'university',
    # Administrations
    'Administrations': 'townhall',
    'administrations': 'townhall',
    'Administration': 'townhall',
    'Commune': 'townhall',
    'Gendarmerie': 'police',
    'Police': 'police',
    'Poste': 'post_office',
    # Commerce / marché
    'Commerce': 'supermarket',
    'commerce': 'supermarket',
    'Marché': 'marketplace',
    # Sportif / culturel → on les ignore pour le scoring de base
    'Sports et loisirs': 'sports_centre',
    'Culte': 'place_of_worship',
    # Transport
    'Transport': 'bus_station',
}


def _normalise_amenity(type_construction: str, definition: str) -> str:
    """Retourne un identifiant 'amenity' normalisé pour le scoring."""
    if type_construction:
        for key, val in _TYPE_CONSTRUCTION_TO_AMENITY.items():
            if key.lower() in type_construction.lower():
                return val
    if definition:
        defl = definition.lower()
        if any(w in defl for w in ('hôpital', 'hopital', 'médical', 'medical', 'dispensaire')):
            return 'hospital'
        if any(w in defl for w in ('clinique', 'soin')):
            return 'clinic'
        if any(w in defl for w in ('école', 'ecole', 'scolaire', 'collège', 'lycée')):
            return 'school'
        if any(w in defl for w in ('université', 'faculté')):
            return 'university'
        if any(w in defl for w in ('police', 'sûreté', 'gendarm')):
            return 'police'
        if any(w in defl for w in ('commune', 'mairie', 'arrondissement', 'wilaya', 'caïdat')):
            return 'townhall'
        if any(w in defl for w in ('marché', 'commerce', 'supermarché')):
            return 'marketplace'
        if any(w in defl for w in ('bus', 'transport', 'gare')):
            return 'bus_station'
    return 'other'


def _load_equipment() -> list:
    with connection.cursor() as cur:
        # Tente d'abord la nouvelle structure (PA Temara)
        try:
            cur.execute(
                'SELECT geometry, ville, designation, definition, type_construction, "Surface"'
                ' FROM couche_equipements_publics'
            )
            rows = cur.fetchall()
            items = []
            for geometry, ville, designation, definition, type_const, surface in rows:
                if isinstance(geometry, str):
                    geometry = json.loads(geometry)
                coords = geometry.get('coordinates')
                if not coords:
                    continue
                lng, lat = coords[0], coords[1]
                amenity = _normalise_amenity(type_const, definition)
                items.append({
                    'lat': lat, 'lng': lng,
                    'amenity': amenity,
                    'type_construction': type_const or '',
                    'definition': definition or '',
                    'ville': ville or '',
                })
            return items
        except Exception:
            pass
        # Fallback : ancienne structure OSM (amenity)
        try:
            cur.execute('SELECT geometry, amenity FROM couche_equipements_publics')
            rows = cur.fetchall()
        except Exception:
            return []
    items = []
    for geometry, amenity in rows:
        if isinstance(geometry, str):
            geometry = json.loads(geometry)
        coords = geometry.get('coordinates')
        if not coords:
            continue
        lng, lat = coords[0], coords[1]
        items.append({'lat': lat, 'lng': lng, 'amenity': amenity or '', 'type_construction': '', 'definition': '', 'ville': ''})
    return items


# ---------------------------------------------------------------------------
# Modèle de scoring
# ---------------------------------------------------------------------------

DISTANCE_BANDS = [(0, 100), (250, 90), (500, 80), (1000, 65), (2000, 45),
                  (3000, 30), (5000, 15), (10000, 5)]


def _piecewise(d, bands):
    d = max(float(d), 0.0)
    for i in range(len(bands) - 1):
        (d0, s0), (d1, s1) = bands[i], bands[i + 1]
        if d <= d1:
            if d1 == d0:
                return s1
            return s0 + (s1 - s0) * (d - d0) / (d1 - d0)
    return bands[-1][1]


def _distance_score(d) -> float:
    if d is None:
        return 0.0
    return _piecewise(d, DISTANCE_BANDS)


# Ratio superficie parcelle / surface souhaitée du projet
SUPERFICIE_BANDS = [
    (0.0, 15), (0.2, 40), (0.5, 70), (0.8, 100),
    (1.2, 100), (2.0, 70), (4.0, 40), (8.0, 15),
]


def _score_superficie(superficie_m2, souhaitee):
    if not souhaitee:
        return None
    return _piecewise(superficie_m2 / souhaitee, SUPERFICIE_BANDS)


# ---------------------------------------------------------------------------
# Classement par critères — 25 % Accessibilité, 25 % Positionnement,
# 25 % Topographie (altitude), 25 % Surface
# Seuls les critères définis par l'utilisateur sont considérés.
# ---------------------------------------------------------------------------

POIDS_RENTABILITE = 0.0
POIDS_AMC = 0.0
POIDS_SURFACE = 0.0

ROI_MIN, ROI_MAX = -100.0, 100.0


def _normaliser_roi(roi):
    """Normalise un ROI (%) dans [0, 100] : -100 → 0, 0 → 50, +100 → 100."""
    if roi is None:
        return None
    if roi <= ROI_MIN:
        return 0.0
    if roi >= ROI_MAX:
        return 100.0
    if roi <= 0.0:
        return 50.0 * (roi - ROI_MIN) / (0.0 - ROI_MIN)
    return 50.0 + 50.0 * roi / ROI_MAX


def _match_distance(actual: float | None, target: float) -> float:
    """Pourcentage de conformité distance (0-100).
    100 % si actual == target, 0 % si actual >= 2× target."""
    if actual is None or target <= 0:
        return None
    ratio = min(actual / target, 2.0)
    return round(max(0.0, (1.0 - ratio / 2.0) * 100.0), 1)


def _match_altitude(actual: float | None, cibles: list[str]) -> float:
    """Pourcentage de conformité altitude (0-100).
    100 % si l'altitude tombe dans la plage choisie, dégression si hors plage."""
    if actual is None or not cibles:
        return None
    plages = {
        'lt100': (0, 100), '100_300': (100, 300), 'gt300': (300, 1000),
    }
    dans_plage = False
    for v in cibles:
        lo, hi = plages.get(v, (0, 1000))
        if lo <= actual <= hi:
            dans_plage = True
            break
    if dans_plage:
        return 100.0
    min_dist = min(abs(actual - lo) for v, (lo, hi) in plages.items() if v in cibles)
    return round(max(0.0, 100.0 - min_dist * 0.1), 1)


def _match_superficie(actual: float | None, souhaitee: float) -> float:
    """Pourcentage de conformité superficie (0-100).
    100 % si ratio = 1.0, dégradation symétrique."""
    if not actual or not souhaitee or souhaitee <= 0:
        return None
    ratio = actual / souhaitee
    return round(min(1.0, 1.0 / max(ratio, 1.0 / ratio)) * 100.0, 1)


def _charger_criteres_projet(projet_pk: int) -> dict:
    with connection.cursor() as cur:
        cur.execute(
            'SELECT surface_souhaitee, budget_total, nombre_unites, surface_construite, '
            'prix_terrain, cout_construction, autres_charges, prix_vente_unitaire, '
            'revenu_estime, id_type FROM projet WHERE id=%s',
            [projet_pk],
        )
        row = cur.fetchone()
    if not row:
        return {}
    return {
        'surface_souhaitee': float(row[0] or 0),
        'budget_total': float(row[1] or 0),
        'nombre_unites': row[2],
        'surface_construite': float(row[3] or 0),
        'prix_terrain': float(row[4]) if row[4] is not None else None,
        'cout_construction': float(row[5]) if row[5] is not None else None,
        'autres_charges': float(row[6]) if row[6] is not None else None,
        'prix_vente_unitaire': float(row[7]) if row[7] is not None else None,
        'revenu_estime': float(row[8]) if row[8] is not None else None,
        'id_type': row[9],
    }


CLASSES_ROUTE = {
    'route_nationale': ['motorway', 'trunk'],
    'route_regionale': ['primary'],
    'route_provinciale': ['secondary'],
    'route_locale': ['tertiary'],
}
CLASSE_LABEL = {
    'route_nationale': 'Route nationale',
    'route_regionale': 'Route régionale',
    'route_provinciale': 'Route provinciale',
    'route_locale': 'Route locale',
    'peu_importe': 'Route',
}
CLASSE_CRITERE = {
    'route_nationale': 'une route nationale',
    'route_regionale': 'une route régionale',
    'route_provinciale': 'une route provinciale',
    'route_locale': 'une route locale',
    'peu_importe': 'la route la plus proche',
}

AMENITY_LABEL = {
    'pharmacy': 'Pharmacie', 'hospital': 'Hôpital', 'clinic': 'Clinique',
    'doctors': 'Cabinet médical', 'dentist': 'Cabinet dentaire',
    'school': 'École', 'kindergarten': 'École maternelle',
    'prep_school': 'École préparatoire', 'college': 'Collège',
    'university': 'Université', 'cafe': 'Café', 'fast_food': 'Restauration rapide',
    'restaurant': 'Restaurant', 'bar': 'Bar', 'supermarket': 'Supermarché',
    'marketplace': 'Marché', 'mall': 'Centre commercial',
    'bus_station': 'Gare routière', 'fuel': 'Station-service',
    'taxi': 'Station de taxi', 'charging_station': 'Borne de recharge',
    'bank': 'Banque', 'post_office': 'Bureau de poste', 'police': 'Poste de police',
    'courthouse': 'Tribunal', 'townhall': 'Commune', 'atm': 'Distributeur',
    'money_transfer': 'Transfert d’argent', 'parking': 'Parking',
}

GROUPES_EQUIPEMENTS = {
    'sante': ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy'],
    'education': ['school', 'kindergarten', 'prep_school', 'college', 'university'],
    'commerce': ['supermarket', 'marketplace', 'mall', 'restaurant', 'cafe', 'fast_food', 'bar'],
    'transport': ['bus_station', 'fuel', 'taxi', 'charging_station'],
    'services': ['bank', 'post_office', 'police', 'courthouse', 'townhall', 'atm', 'money_transfer'],
}

FILTRE_AMENITY = {
    'health': {'hopital': ['hospital'], 'clinique': ['clinic', 'doctors']},
    'education': {'ecole': ['school', 'prep_school'], 'lycee': ['school'], 'universite': ['university']},
    'commerce': {'centre_commercial': ['mall', 'supermarket'], 'marche': ['marketplace']},
    'transport': {'gare_routiere': ['bus_station'], 'arret_bus': ['bus_station']},
    'admin': {'commune': ['townhall'], 'poste': ['post_office'], 'police': ['police']},
}

FILTRE_LABEL = {
    'health': {'hopital': 'Hôpital', 'clinique': 'Clinique'},
    'education': {'ecole': 'École', 'lycee': 'Lycée', 'universite': 'Université'},
    'commerce': {'centre_commercial': 'Centre commercial', 'marche': 'Marché'},
    'transport': {'gare_routiere': 'Gare routière', 'arret_bus': 'Arrêt de bus'},
    'admin': {'commune': 'la commune', 'poste': 'la poste', 'police': 'le commissariat'},
}


# ---------------------------------------------------------------------------
# Analyse
# ---------------------------------------------------------------------------

def analyser_parcelles(projet_pk: int, filtres: dict) -> dict:
    """Analyse multicritère des parcelles cadastrales."""
    parcels = _load_parcels()
    if not parcels:
        raise ValueError('Aucune parcelle cadastrale à analyser.')

    routes = _load_routes()
    equipments = _load_equipment()
    projet = _charger_criteres_projet(projet_pk)
    surface_souhaitee = projet.get('surface_souhaitee') or 0

    # chemin du fichier MNT stocké sur la couche 'mnt'
    mnt_path = None
    with connection.cursor() as cur:
        cur.execute("SELECT fichier FROM couche WHERE nom='mnt'")
        row = cur.fetchone()
        if row and row[0]:
            mnt_path = os.path.join(settings.MEDIA_ROOT, row[0])

    mnt_index = None
    if mnt_path and os.path.exists(mnt_path):
        try:
            mnt_index = MNTAltitudeIndex(mnt_path)
        except Exception:
            mnt_index = None

    limite_commune = _load_commune_limite()

    # préparer les distances routes (toutes classes confondues + par classe)
    seg_count = len(routes['s_lat'])
    class_ids = {
        cls: np.zeros(seg_count, dtype=bool)
        for cls in CLASSES_ROUTE
    }
    for i, hw in enumerate(routes['highway']):
        for cls, hs in CLASSES_ROUTE.items():
            if hw in hs:
                class_ids[cls][i] = True
    class_ids['peu_importe'] = np.ones(seg_count, dtype=bool)

    # équipements : groupes de scoring
    amenity_list = [e['amenity'] for e in equipments]
    equip_lat = np.array([e['lat'] for e in equipments], dtype='f8')
    equip_lon = np.array([e['lng'] for e in equipments], dtype='f8')

    resultats = []
    coslat_ref = _coslat(33.88)

    for parcelle in parcels:
        plat = parcelle['lat']
        plon = parcelle['lng']

        # --- accessibilité routière -------------------------------------------------
        dists = _seg_distances_m(
            plat, plon, routes['s_lat'], routes['s_lon'],
            routes['e_lat'], routes['e_lon'], coslat_ref,
        )
        dist_routes = {'peu_importe': float(dists.min())}
        class_nearest_name = {}
        nearest_all = int(dists.argmin())
        nearest_name = routes['name'][nearest_all]
        for cls, mask in class_ids.items():
            if cls == 'peu_importe':
                continue
            if mask.any():
                sub = dists[mask]
                local_min = int(sub.argmin())
                global_idx = int(np.nonzero(mask)[0][local_min])
                dist_routes[cls] = float(sub[local_min])
                class_nearest_name[cls] = routes['name'][global_idx] or CLASSE_LABEL[cls]
        score_access = _distance_score(dist_routes['peu_importe'])

        # --- positionnement (équipements) ------------------------------------------
        dlat = (equip_lat - plat) * LAT_M
        dlon = (equip_lon - plon) * (LAT_M * coslat_ref)
        equip_dists = np.sqrt(dlat ** 2 + dlon ** 2)
        dist_by_amenity = {}
        for e, d in zip(equipments, equip_dists):
            key = e['amenity']
            if key not in dist_by_amenity or d < dist_by_amenity[key]:
                dist_by_amenity[key] = float(d)

        group_scores = []
        for group, keys in GROUPES_EQUIPEMENTS.items():
            present = [k for k in keys if k in dist_by_amenity]
            if not present:
                continue
            group_scores.append(_distance_score(min(dist_by_amenity[k] for k in present)))
        score_pos = round(sum(group_scores) / len(group_scores)) if group_scores else 0.0

        # --- topographie (MNT) — altitude zonale -------------------------------------
        altitude = denivele = None
        if mnt_index is not None:
            geom = parcelle.get('geometry')
            altitude = determiner_altitude(geom, mnt_index)
            samples = {}
            offsets = [(0.0, 0.0), (1, 0), (-1, 0), (0, 1), (0, -1)]
            for dy, dx in offsets:
                slat = plat + dy * 110.0 / LAT_M
                slng = plon + dx * 110.0 / (LAT_M * coslat_ref)
                v = mnt_index.altitude_at(slat, slng)
                if v is not None:
                    samples[(dy, dx)] = v
            if len(samples) >= 2:
                vals = list(samples.values())
                denivele = max(vals) - min(vals)

        # --- Scores de conformité par critère (0-100) -------------------------------
        # On ne considère que les critères que l'utilisateur a définis dans les filtres.
        criteres_conformite = []

        # 1) Accessibilité : distance cible à la route
        dist_route_cible = int(filtres.get('distance_route') or 0)
        route_type_sel = filtres.get('route_type', [])
        if dist_route_cible > 0 and route_type_sel:
            for rtype in route_type_sel:
                actual = dist_routes.get(rtype)
                if actual is not None:
                    pct = _match_distance(actual, dist_route_cible)
                    if pct is not None:
                        criteres_conformite.append({
                            'cle': f'access_{rtype}',
                            'poids': 0.25,
                            'pct': pct,
                            'label': f"Accessibilité → {CLASSE_LABEL.get(rtype, rtype)}",
                            'valeur': actual,
                            'cible': dist_route_cible,
                            'unite': 'm',
                        })

        # 2) Positionnement : distance cible aux équipements
        for groupe, mapping in FILTRE_AMENITY.items():
            distance_key = {
                'health': 'distance_health', 'education': 'distance_education',
                'commerce': 'distance_commerce', 'transport': 'distance_transport',
                'admin': 'distance_admin',
            }[groupe]
            seuil = int(filtres.get(distance_key) or 0)
            if seuil <= 0:
                continue
            for ftype in filtres.get(groupe, []):
                keys = mapping.get(ftype, [])
                present = [k for k in keys if k in dist_by_amenity]
                if not present:
                    continue
                actual = min(dist_by_amenity[k] for k in present)
                pct = _match_distance(actual, seuil)
                if pct is not None:
                    criteres_conformite.append({
                        'cle': f'pos_{groupe}_{ftype}',
                        'poids': 0.25,
                        'pct': pct,
                        'label': f"Positionnement → {FILTRE_LABEL.get(groupe, {}).get(ftype, ftype)}",
                        'valeur': actual,
                        'cible': seuil,
                        'unite': 'm',
                    })

        # 3) Topographie : altitude
        altitude_sel = filtres.get('altitude', [])
        if altitude_sel and altitude is not None:
            pct = _match_altitude(altitude, altitude_sel)
            if pct is not None:
                criteres_conformite.append({
                    'cle': 'topo_altitude',
                    'poids': 0.25,
                    'pct': pct,
                    'label': 'Topographie → Altitude',
                    'valeur': altitude,
                    'cible': altitude_sel,
                    'unite': 'm',
                })

        # 4) Surface souhaitée
        if surface_souhaitee > 0:
            pct = _match_superficie(parcelle.get('surface'), surface_souhaitee)
            if pct is not None:
                criteres_conformite.append({
                    'cle': 'surface',
                    'poids': 0.25,
                    'pct': pct,
                    'label': f"Surface → {surface_souhaitee:.0f} m²",
                    'valeur': float(parcelle.get('surface') or 0),
                    'cible': surface_souhaitee,
                    'unite': 'm²',
                })

        # Score final = moyenne des pourcentages de conformité définis
        n_criteres = len(criteres_conformite) or 1
        score_final = round(sum(c['pct'] for c in criteres_conformite) / n_criteres, 1)
        score_amc = score_final
        score_superf = next((c['pct'] for c in criteres_conformite if c['cle'] == 'surface'), None)
        score_access_final = next((c['pct'] for c in criteres_conformite if c['cle'].startswith('access_')), None)
        score_pos_final = next((c['pct'] for c in criteres_conformite if c['cle'].startswith('pos_')), None)
        score_topo_final = next((c['pct'] for c in criteres_conformite if c['cle'] == 'topo_altitude'), None)

        roi, marge, benefice_net, score_rentabilite, type_rentabilite = None, None, None, None, 'indisponible'
        prix_terrain = None

        infos = {
            'reference_cadastrale': parcelle.get('num') or f"P-{parcelle['id']}",
            'commune': '—',
            'province': '—',
            'region': 'Rabat-Salé-Kénitra',
            'superficie': f"{float(parcelle.get('surface') or 0):.2f} m²",
            'perimetre': f"{parcelle['perimetre']:.2f} m",
            'latitude': plat,
            'longitude': plon,
            'zone_amenagement': '—',
            'statut_foncier': '—',
            'nature_juridique': '—',
            'type_immatriculation': '—',
            'num_titre_foncier': '—',
        }

        criteres = _construire_criteres(
            parcelle, filtres, dist_routes, nearest_name, class_nearest_name,
            dist_by_amenity, altitude, denivele, projet,
        )

        conforme_count = sum(1 for c in criteres if c['conforme'])
        total_criteres = len(criteres) or 1
        resultats.append({
            'id': parcelle['id'],
            'nom': f"Parcelle {infos['reference_cadastrale']}",
            'superficie': float(parcelle.get('surface') or 0),
            'lat': plat,
            'lng': plon,
            'geometry': parcelle.get('geometry'),
            'score_global': score_final,
            'score_final': score_final,
            'score_amc': score_amc,
            'score_accessibilite': round(score_access_final) if score_access_final is not None else None,
            'score_positionnement': round(score_pos_final) if score_pos_final is not None else None,
            'score_topographie': round(score_topo_final) if score_topo_final is not None else None,
            'score_superficie': round(score_superf) if score_superf is not None else None,
            'roi': roi,
            'marge': marge,
            'benefice_net': benefice_net,
            'score_rentabilite': round(score_rentabilite, 1) if score_rentabilite is not None else None,
            'type_rentabilite': type_rentabilite,
            'prix_terrain': prix_terrain,
            'infos_generales': infos,
            'criteres': criteres,
            'criteres_satisfaits': conforme_count,
            'criteres_total': total_criteres,
            'criteres_conformite': criteres_conformite,
            'points_forts': [c['critere'] for c in criteres if c['conforme']][:3],
            'points_faibles': [c['critere'] for c in criteres if not c['conforme']][:3],
        })

    resultats.sort(key=lambda x: x['score_global'], reverse=True)
    for i, r in enumerate(resultats):
        r['classement'] = i + 1

    return {
        'total': len(resultats),
        'resultats': resultats,
        'couches_utilisees': ['cadastre', 'reseau_routier', 'equipements_publics', 'mnt'],
    }


def _construire_criteres(parcelle, filtres, dist_routes, nearest_name, class_nearest_name,
                         dist_by_amenity, altitude, denivele, projet) -> list:
    criteres = []

    # --- critères du projet ---------------------------------------------------
    surface_souhaitee = projet.get('surface_souhaitee') or 0
    surface_construite = projet.get('surface_construite') or 0
    superficie_m2 = float(parcelle.get('surface') or 0)
    if surface_souhaitee:
        ratio = superficie_m2 / surface_souhaitee
        criteres.append({
            'id': 'superficie',
            'critere': 'Adéquation à la surface souhaitée du projet',
            'critere_demande': f"≈ {surface_souhaitee:.0f} m²",
            'valeur_mesuree': f"{superficie_m2:.0f} m²",
            'valeur_mesuree_brute': round(superficie_m2, 1),
            'unite': 'm²',
            'point_interet': 'Projet',
            'conforme': 0.5 <= ratio <= 2.0,
        })
    if surface_construite:
        criteres.append({
            'id': 'surface_construite',
            'critere': 'Capacité d’accueil de la surface construite du projet',
            'critere_demande': f"≥ {surface_construite:.0f} m²",
            'valeur_mesuree': f"{superficie_m2:.0f} m²",
            'valeur_mesuree_brute': round(superficie_m2, 1),
            'unite': 'm²',
            'point_interet': 'Projet',
            'conforme': superficie_m2 >= surface_construite,
        })

    dist_route = int(filtres.get('distance_route') or 0)
    for rtype in filtres.get('route_type', []):
        dist = dist_routes.get(rtype)
        if dist is None:
            continue
        poi = nearest_name if rtype == 'peu_importe' else class_nearest_name.get(rtype, CLASSE_LABEL[rtype])
        criteres.append({
            'id': f'route_{rtype}',
            'critere': f"Distance à {CLASSE_CRITERE[rtype]}",
            'critere_demande': f"≤ {dist_route} m" if dist_route else 'Peu importe',
            'valeur_mesuree': f"{dist:.0f} m",
            'valeur_mesuree_brute': round(dist, 1),
            'unite': 'm',
            'point_interet': poi or CLASSE_LABEL[rtype],
            'conforme': dist <= dist_route if dist_route else True,
        })

    for groupe, mapping in FILTRE_AMENITY.items():
        distance_key = {
            'health': 'distance_health', 'education': 'distance_education',
            'commerce': 'distance_commerce', 'transport': 'distance_transport',
            'admin': 'distance_admin',
        }[groupe]
        seuil = int(filtres.get(distance_key) or 0)
        for ftype in filtres.get(groupe, []):
            keys = mapping.get(ftype, [])
            present = [k for k in keys if k in dist_by_amenity]
            if not present:
                continue
            dist = min(dist_by_amenity[k] for k in present)
            label = FILTRE_LABEL[groupe][ftype]
            poi = AMENITY_LABEL.get(keys[0], keys[0])
            criteres.append({
                'id': f'{groupe}_{ftype}',
                'critere': f"Distance à {label}",
                'critere_demande': f"≤ {seuil} m" if seuil else 'Peu importe',
                'valeur_mesuree': f"{dist:.0f} m",
                'valeur_mesuree_brute': round(dist, 1),
                'unite': 'm',
                'point_interet': poi,
                'conforme': dist <= seuil if seuil else True,
            })

    denivele_sel = filtres.get('denivele', [])
    if denivele_sel and denivele is not None:
        conforme = any({
            'lt5': denivele < 5, '5_20': 5 <= denivele <= 20, 'gt20': denivele > 20,
        }.get(v, False) for v in denivele_sel)
        criteres.append({
            'id': 'denivele',
            'critere': 'Dénivelé du terrain',
            'critere_demande': ', '.join(denivele_sel),
            'valeur_mesuree': f"{denivele:.1f} m",
            'valeur_mesuree_brute': round(denivele, 1),
            'unite': 'm',
            'point_interet': 'MNT',
            'conforme': conforme,
        })

    altitude_sel = filtres.get('altitude', [])
    if altitude_sel and 'any' not in altitude_sel and altitude is not None:
        conforme = any({
            'lt100': altitude < 100, '100_300': 100 <= altitude <= 300, 'gt300': altitude > 300,
        }.get(v, False) for v in altitude_sel)
        criteres.append({
            'id': 'altitude',
            'critere': 'Altitude du terrain',
            'critere_demande': ', '.join(altitude_sel),
            'valeur_mesuree': f"{altitude:.1f} m",
            'valeur_mesuree_brute': round(altitude, 1),
            'unite': 'm',
            'point_interet': 'MNT',
            'conforme': conforme,
        })

    loc_sel = filtres.get('localisation', [])
    if loc_sel:
        zone = determiner_localisation(parcelle.get('geometry'), limite_commune)
        label = {'centre_ville': 'Centre-ville', 'periurbaine': 'Périphérie'}
        zone_affichee = label.get(zone, 'Zone non déterminée')
        criteres.append({
            'id': 'loc',
            'critere': 'Zone de localisation',
            'critere_demande': ', '.join(loc_sel),
            'valeur_mesuree': zone_affichee,
            'valeur_mesuree_brute': 0,
            'unite': '',
            'point_interet': zone_affichee,
            'conforme': bool(zone) and zone in loc_sel,
        })

    return criteres


# ---------------------------------------------------------------------------
# Extraction des distances pour le module de pondération AHP+ROC
# ---------------------------------------------------------------------------

def extraire_donnees_ponderation(projet_pk: int, selections: dict) -> dict:
    """Extrait les distances brutes et métadonnées pour tous les terrains candidats d'un projet.

    Args:
        projet_pk: ID du projet
        selections: {
            "accessibilite": ["enseignement", "sante", "administration", "routes"],
            "route_type": "route_nationale" | "route_regionale" | ...,
        }

    Returns:
        {
            "terrains": [
                {
                    "id": int,
                    "nom": str,
                    "lat": float, "lng": float,
                    "superficie": float,
                    "distances": {
                        "enseignement": float (m),
                        "sante": float,
                        "administration": float,
                        "routes": float,
                    },
                    "zone_localisation": "centre_ville" | "periurbaine" | None,
                    "altitude": float | None,
                }, ...
            ],
            "min_max_distances": {
                "enseignement": {"min": float, "max": float},
                ...
            }
        }
    """
    from .models import Terrain as TerrainModel

    # Charger les couches SIG
    parcels_db = _load_parcels()
    routes = _load_routes()
    equipments = _load_equipment()

    if not parcels_db:
        return {"terrains": [], "min_max_distances": {}}

    # Préparer les segments routes
    seg_count = len(routes['s_lat'])
    route_type = selections.get('route_type', 'peu_importe')
    class_ids = {}
    for cls, hs in CLASSES_ROUTE.items():
        mask = np.zeros(seg_count, dtype=bool)
        for i, hw in enumerate(routes['highway']):
            if hw in hs:
                mask[i] = True
        class_ids[cls] = mask
    class_ids['peu_importe'] = np.ones(seg_count, dtype=bool)

    # Identifier les amenity groups demandés
    selections_access = selections.get('accessibilite', [])
    GROUP_MAP = {
        'enseignement': 'education',
        'sante': 'sante',
        'administration': 'services',
    }

    # Charger le MNT
    mnt_path = None
    with connection.cursor() as cur:
        cur.execute("SELECT fichier FROM couche WHERE nom='mnt'")
        row = cur.fetchone()
        if row and row[0]:
            mnt_path = os.path.join(settings.MEDIA_ROOT, row[0])

    mnt_index = None
    if mnt_path and os.path.exists(mnt_path):
        try:
            mnt_index = MNTAltitudeIndex(mnt_path)
        except Exception:
            mnt_index = None

    limite_commune = _load_commune_limite()

    coslat_ref = _coslat(33.88)
    equip_lat = np.array([e['lat'] for e in equipments], dtype='f8') if equipments else np.array([], dtype='f8')
    equip_lon = np.array([e['lng'] for e in equipments], dtype='f8') if equipments else np.array([], dtype='f8')

    resultats_terrains = []
    distances_collectees: dict[str, list[float]] = {
        'enseignement': [], 'sante': [], 'administration': [], 'routes': [],
    }

    # On utilise toujours l'ensemble des parcelles cadastrales comme candidats (indépendamment
    # des terrains éventuellement enregistrés du projet), pour classer tout le cadastre.
    candidats = []
    for p in parcels_db:
        p_num = (p.get('num') or '').strip()
        p_ind = (p.get('indice') or '').strip()
        if p_num and p_ind and not p_num.endswith(f'/{p_ind}') and '/' not in p_num:
            nom_c = f'Parcelle {p_num}/{p_ind}'
            ref_c = f'{p_num}/{p_ind}'
        elif p_num:
            nom_c = f'Parcelle {p_num}'
            ref_c = p_num
        else:
            nom_c = f"Parcelle {p['id']}"
            ref_c = ''

        candidats.append({
            'id': p['id'],
            'nom': nom_c,
            'lat': float(p['lat']),
            'lng': float(p['lng']),
            'superficie': float(p.get('surface') or 0),
            'reference_cadastrale': ref_c,
            'indice': p_ind,
            'consistance': p.get('Consistance') or '',
            'fid': p.get('fid'),
            'num_parcelle': p.get('num') or '',
            'geometry': p.get('geometry'),
        })

    for cand in candidats:
        tid = cand['id']
        plat = cand['lat']
        plon = cand['lng']

        # --- Distances routes ---
        dist_route = None
        if seg_count > 0:
            dists = _seg_distances_m(
                plat, plon, routes['s_lat'], routes['s_lon'],
                routes['e_lat'], routes['e_lon'], coslat_ref,
            )
            dist_route_all = float(dists.min())
            dist_routes_par_classe = {}
            for cls, mask in class_ids.items():
                if cls == 'peu_importe':
                    continue
                if mask.any():
                    dist_routes_par_classe[cls] = float(dists[mask].min())

            # Route selon le type choisi
            dist_route = dist_routes_par_classe.get(route_type, dist_route_all)
            if 'routes' in selections_access and dist_route is not None:
                distances_collectees['routes'].append(dist_route)

        # --- Distances équipements ---
        dist_by_amenity = {}
        if len(equip_lat) > 0:
            dlat = (equip_lat - plat) * LAT_M
            dlon = (equip_lon - plon) * (LAT_M * coslat_ref)
            equip_dists = np.sqrt(dlat ** 2 + dlon ** 2)

            for e_idx, e in enumerate(equipments):
                key = e['amenity']
                d = float(equip_dists[e_idx])
                if key not in dist_by_amenity or d < dist_by_amenity[key]:
                    dist_by_amenity[key] = d

        dist_par_categorie_access = {}
        for sel in selections_access:
            group_key = GROUP_MAP.get(sel)
            if group_key and group_key in GROUPES_EQUIPEMENTS:
                keys = GROUPES_EQUIPEMENTS[group_key]
                present = [k for k in keys if k in dist_by_amenity]
                if present:
                    d_min = min(dist_by_amenity[k] for k in present)
                    dist_par_categorie_access[sel] = d_min
                    distances_collectees[sel].append(d_min)

        # --- Localisation (plan d'aménagement, point dans polygone) ---
        t_obj = cand.get('_terrain')
        zone = None
        if t_obj is not None and t_obj.derniere_maj_geo:
            zone = t_obj.zone_localisation_calculee or None
        if zone is None:
            zone = determiner_localisation(cand.get('geometry'), limite_commune)
        if zone is None and cand.get('lat') is not None and cand.get('lng') is not None:
            # Repli : terrain sans polygone mais avec un centroïde (lat/lng)
            if point_in_polygon(float(cand['lat']), float(cand['lng']), limite_commune):
                zone = 'centre_ville'
            else:
                zone = 'periurbaine'

        # --- Altitude (MNT) ---
        altitude = None
        if t_obj is not None and t_obj.derniere_maj_geo and t_obj.altitude_calculee is not None:
            altitude = t_obj.altitude_calculee
        if altitude is None and mnt_index is not None:
            altitude = determiner_altitude(cand.get('geometry'), mnt_index)
        # altitude reste None si le MNT est absent / ne couvre pas le terrain
        # (aucun fallback fictif — voir B4)

        resultats_terrains.append({
            'id': tid,
            'nom': cand['nom'],
            'lat': plat,
            'lng': plon,
            'superficie': cand['superficie'],
            'reference_cadastrale': cand['reference_cadastrale'],
            'indice': cand['indice'],
            'consistance': cand['consistance'],
            'fid': cand.get('fid'),
            'num_parcelle': cand.get('num_parcelle') or '',
            'geometry': cand.get('geometry'),
            'distances': {
                'enseignement': dist_par_categorie_access.get('enseignement'),
                'sante': dist_par_categorie_access.get('sante'),
                'administration': dist_par_categorie_access.get('administration'),
                'routes': dist_route if 'routes' in selections_access else None,
            },
            'zone_localisation': zone,
            'altitude': altitude,
        })

    # Calculer min/max par catégorie pour la normalisation
    min_max = {}
    for cat, dists in distances_collectees.items():
        if dists:
            min_max[cat] = {"min": min(dists), "max": max(dists)}

    return {
        "terrains": resultats_terrains,
        "min_max_distances": min_max,
    }

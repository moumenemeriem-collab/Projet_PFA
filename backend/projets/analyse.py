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

from .models import calculer_rentabilite

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
        'id', 'geometry', 'id_parcelle', 'num_titre_foncier', 'type_immatriculation',
        'nature_juridique', 'superficie_m2', 'commune', 'cercle', 'province',
        'nature_occupation_code', 'nature_occupation_libelle', 'zone_amenagement',
        'statut_foncier', 'origine', 'reference_plan', 'echelle_leve',
        'date_creation', 'date_derniere_maj',
    ]
    query = (
        'SELECT id, geometry, id_parcelle, num_titre_foncier, type_immatriculation, '
        'nature_juridique, superficie_m2, commune, cercle, province, '
        'nature_occupation_code, nature_occupation_libelle, zone_amenagement, '
        'statut_foncier, origine, reference_plan, echelle_leve, '
        'date_creation, date_derniere_maj FROM couche_cadastre ORDER BY id'
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


def _load_equipment() -> list:
    with connection.cursor() as cur:
        cur.execute(
            'SELECT geometry, amenity FROM couche_equipements_publics'
        )
        rows = cur.fetchall()
    items = []
    for geometry, amenity in rows:
        if isinstance(geometry, str):
            geometry = json.loads(geometry)
        coords = geometry.get('coordinates')
        if not coords:
            continue
        lng, lat = coords[0], coords[1]
        items.append({'lat': lat, 'lng': lng, 'amenity': amenity or ''})
    return items


# ---------------------------------------------------------------------------
# Modèle de scoring
# ---------------------------------------------------------------------------

DISTANCE_BANDS = [(0, 100), (250, 90), (500, 80), (1000, 65), (2000, 45),
                  (3000, 30), (5000, 15), (10000, 5)]
PENTE_BANDS = [(0, 100), (3, 90), (8, 75), (12, 55), (18, 35), (25, 15), (50, 5)]


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


def _pente_score(p) -> float:
    if p is None:
        return 60.0
    return _piecewise(p, PENTE_BANDS)


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
# Rentabilité (ROI) — pondération du score final
# ---------------------------------------------------------------------------

POIDS_AMC = 0.70
POIDS_RENTABILITE = 0.30

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


def _load_rentabilite() -> dict:
    """Références rentabilité : prix du terrain par parcelle + ROI par type de projet."""
    with connection.cursor() as cur:
        cur.execute(
            'SELECT id_parcelle, prix_terrain, id_type, roi, marge, benefice_net '
            'FROM rentabilite'
        )
        rows = cur.fetchall()
    refs = {}
    for id_parcelle, prix_terrain, id_type, roi, marge, benefice_net in rows:
        refs[id_parcelle] = {
            'prix_terrain': float(prix_terrain) if prix_terrain is not None else None,
            'id_type': id_type,
            'roi': float(roi) if roi is not None else None,
            'marge': float(marge) if marge is not None else None,
            'benefice_net': float(benefice_net) if benefice_net is not None else None,
        }
    return refs


def _rentabilite_parcelle(projet: dict, prix_terrain_parcelle, ref_rentabilite: dict):
    """(roi, marge, benefice_net, score_rentabilite, type_rentabilite) pour une parcelle.

    - 'personnalisee' : ROI recalculé avec le prix du terrain de la parcelle ;
    - 'benchmark'      : ROI de référence du même type de projet ;
    - 'indisponible'   : aucune donnée exploitable.
    """
    has_revenu = bool(projet.get('revenu_estime')) or (
        bool(projet.get('prix_vente_unitaire')) and bool(projet.get('nombre_unites')))
    if has_revenu:
        prix = prix_terrain_parcelle if prix_terrain_parcelle is not None else projet.get('prix_terrain')
        if prix is not None:
            res = calculer_rentabilite(
                prix, projet.get('cout_construction'), projet.get('autres_charges'),
                projet.get('prix_vente_unitaire'), projet.get('nombre_unites'),
                projet.get('revenu_estime'), projet.get('budget_total'))
            if res.get('complete'):
                roi = res['roi']
                return roi, res['marge'], res['benefice_net'], _normaliser_roi(roi), 'personnalisee'

    ref = ref_rentabilite
    if ref and ref.get('id_type') == projet.get('id_type') and ref.get('roi') is not None:
        return ref['roi'], ref.get('marge'), ref.get('benefice_net'), _normaliser_roi(ref['roi']), 'benchmark'

    return None, None, None, None, 'indisponible'


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
    'commerce': {'centre_commercial': ['mall'], 'marche': ['marketplace']},
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
    rentabilite_refs = _load_rentabilite()

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

        # --- topographie (MNT) --------------------------------------------------------
        altitude = pente = denivele = None
        if mnt_index is not None:
            samples = {}
            offsets = [(0.0, 0.0), (1, 0), (-1, 0), (0, 1), (0, -1)]
            for dy, dx in offsets:
                slat = plat + dy * 110.0 / LAT_M
                slng = plon + dx * 110.0 / (LAT_M * coslat_ref)
                v = mnt_index.altitude_at(slat, slng)
                if v is not None:
                    samples[(dy, dx)] = v
            if (0.0, 0.0) in samples:
                altitude = samples[(0.0, 0.0)]
            if len(samples) >= 2:
                vals = list(samples.values())
                denivele = max(vals) - min(vals)
            # pente : gradient est/nord
            if (0.0, 0.0) in samples and ((1, 0) in samples or (0, 1) in samples):
                gx = (samples.get((0, 1), samples[(0.0, 0.0)]) - samples[(0.0, 0.0)]) / 110.0
                gy = (samples.get((1, 0), samples[(0.0, 0.0)]) - samples[(0.0, 0.0)]) / 110.0
                pente = math.sqrt(gx * gx + gy * gy) * 100.0
        score_topo = _pente_score(pente if pente is not None else None)

        score_superf = _score_superficie(parcelle.get('superficie_m2'), surface_souhaitee)
        if score_superf is not None:
            score_amc = round(
                0.30 * score_access + 0.30 * score_pos + 0.25 * score_topo + 0.15 * score_superf, 1)
        else:
            score_amc = round(0.35 * score_access + 0.35 * score_pos + 0.30 * score_topo, 1)

        ref_rentabilite = rentabilite_refs.get(parcelle.get('id_parcelle'))
        prix_terrain = ref_rentabilite['prix_terrain'] if ref_rentabilite else None
        roi, marge, benefice_net, score_rentabilite, type_rentabilite = _rentabilite_parcelle(
            projet, prix_terrain, ref_rentabilite)

        if score_rentabilite is not None:
            score_final = round(
                POIDS_AMC * score_amc + POIDS_RENTABILITE * score_rentabilite, 1)
        else:
            score_final = score_amc

        infos = {
            'reference_cadastrale': parcelle.get('id_parcelle') or f"P-{parcelle['id']}",
            'commune': parcelle.get('commune') or '—',
            'province': parcelle.get('province') or '—',
            'region': 'Rabat-Salé-Kénitra',
            'superficie': f"{float(parcelle.get('superficie_m2') or 0):.2f} m²",
            'perimetre': f"{parcelle['perimetre']:.2f} m",
            'latitude': plat,
            'longitude': plon,
            'zone_amenagement': parcelle.get('zone_amenagement') or '—',
            'statut_foncier': parcelle.get('statut_foncier') or '—',
            'nature_juridique': parcelle.get('nature_juridique') or '—',
            'type_immatriculation': parcelle.get('type_immatriculation') or '—',
            'num_titre_foncier': parcelle.get('num_titre_foncier') or '—',
        }

        criteres = _construire_criteres(
            parcelle, filtres, dist_routes, nearest_name, class_nearest_name,
            dist_by_amenity, altitude, pente, denivele, projet,
        )

        conforme_count = sum(1 for c in criteres if c['conforme'])
        total_criteres = len(criteres) or 1
        resultats.append({
            'id': parcelle['id'],
            'nom': f"Parcelle {infos['reference_cadastrale']}",
            'superficie': float(parcelle.get('superficie_m2') or 0),
            'lat': plat,
            'lng': plon,
            'score_global': score_final,
            'score_final': score_final,
            'score_amc': score_amc,
            'score_accessibilite': round(score_access),
            'score_positionnement': round(score_pos),
            'score_topographie': round(score_topo),
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
                         dist_by_amenity, altitude, pente, denivele, projet) -> list:
    criteres = []

    # --- critères du projet ---------------------------------------------------
    surface_souhaitee = projet.get('surface_souhaitee') or 0
    surface_construite = projet.get('surface_construite') or 0
    superficie_m2 = float(parcelle.get('superficie_m2') or 0)
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

    pente_sel = filtres.get('pente', [])
    if pente_sel and pente is not None:
        conforme = any({
            '0_5': pente <= 5, '5_10': 5 < pente <= 10,
            '10_15': 10 < pente <= 15, 'gt15': pente > 15,
        }.get(v, False) for v in pente_sel)
        criteres.append({
            'id': 'pente',
            'critere': 'Pente du terrain',
            'critere_demande': ', '.join(pente_sel),
            'valeur_mesuree': f"{pente:.1f} %",
            'valeur_mesuree_brute': round(pente, 1),
            'unite': '%',
            'point_interet': 'MNT',
            'conforme': conforme,
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
        nearest_eq = min(dist_by_amenity.values()) if dist_by_amenity else None
        if nearest_eq is None:
            zone = 'rurale'
        elif nearest_eq < 800:
            zone = 'centre_ville'
        elif nearest_eq < 2500:
            zone = 'periurbaine'
        else:
            zone = 'rurale'
        label = {'centre_ville': 'Centre-ville', 'periurbaine': 'Périurbaine', 'rurale': 'Rurale'}
        criteres.append({
            'id': 'loc',
            'critere': 'Zone de localisation',
            'critere_demande': ', '.join(loc_sel),
            'valeur_mesuree': label[zone],
            'valeur_mesuree_brute': 0,
            'unite': '',
            'point_interet': label[zone],
            'conforme': zone in loc_sel,
        })

    return criteres

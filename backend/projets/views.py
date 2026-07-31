import json
import os

from django.conf import settings
from django.core.files.base import ContentFile
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authentication import JWTOptionalAuthentication

from .models import Couche, ImportCouche, Projet, Terrain, TypeProjet
from .serializers import (
    CoucheDetailSerializer,
    CoucheListSerializer,
    ProjetCreateSerializer,
    ProjetDetailSerializer,
    ProjetListSerializer,
    ProjetUpdateSerializer,
    TerrainCreateSerializer,
    TerrainListSerializer,
    TypeProjetSerializer,
)


class TypeProjetListView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        types = TypeProjet.objects.filter(actif=True)
        return Response(TypeProjetSerializer(types, many=True).data)


class ProjetListView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user
        if hasattr(user, 'role') and user.role == 'admin':
            queryset = Projet.objects.all()
        elif user.is_authenticated:
            queryset = Projet.objects.filter(investisseur=user)
        else:
            queryset = Projet.objects.all()

        search = request.query_params.get('search', '').strip()
        type_id = request.query_params.get('type', '').strip()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 12))

        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(nom__icontains=search) | Q(description__icontains=search)
            )

        if type_id:
            queryset = queryset.filter(id_type_id=type_id)

        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        projets = queryset[start:end]

        return Response({
            'count': total,
            'results': ProjetListSerializer(projets, many=True).data,
        })

    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Authentification requise pour créer un projet.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = ProjetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        projet = serializer.save(investisseur=request.user)
        return Response(
            ProjetDetailSerializer(projet).data,
            status=status.HTTP_201_CREATED,
        )


class ProjetDetailView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, pk: int):
        try:
            projet = Projet.objects.select_related('id_type').get(pk=pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(ProjetDetailSerializer(projet).data)

    def patch(self, request, pk: int):
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentification requise.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            projet = Projet.objects.get(pk=pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if projet.investisseur != request.user and request.user.role != 'admin':
            return Response(
                {'detail': 'Vous n\'avez pas la permission de modifier ce projet.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProjetUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        projet = serializer.update(projet, serializer.validated_data)
        return Response(ProjetDetailSerializer(projet).data)

    def delete(self, request, pk: int):
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentification requise.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            projet = Projet.objects.get(pk=pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if projet.investisseur != request.user and request.user.role != 'admin':
            return Response(
                {'detail': 'Vous n\'avez pas la permission de supprimer ce projet.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        projet.delete()
        return Response({'message': 'Projet supprimé avec succès.'}, status=status.HTTP_200_OK)


class AnalyseTerrainView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, projet_pk: int):
        try:
            projet = Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        terrains = Terrain.objects.filter(projet=projet)
        if not terrains.exists():
            return Response({'detail': 'Aucun terrain à analyser.'}, status=status.HTTP_400_BAD_REQUEST)

        filtres = request.data or {}
        total = terrains.count()

        resultats = []
        for terrain in terrains:
            t = {
                'id': terrain.id,
                'nom': terrain.nom,
                'superficie': float(terrain.superficie),
                'lat': float(terrain.lat),
                'lng': float(terrain.lng),
                'score_global': float(terrain.score) * 10,
                'score_accessibilite': terrain.accessibilite * 10,
                'score_positionnement': terrain.positionnement * 10,
                'score_topographie': terrain.topographie * 10,
                'infos_generales': _generer_infos_terrain(terrain),
                'criteres': _generer_resultats_criteres(terrain, filtres),
                'points_forts': [],
                'points_faibles': [],
            }

            conforme_count = sum(1 for c in t['criteres'] if c['conforme'])
            total_criteres = len(t['criteres']) or 1
            t['criteres_satisfaits'] = conforme_count
            t['criteres_total'] = total_criteres

            pts_forts = [c['critere'] for c in t['criteres'] if c['conforme']][:3]
            pts_faibles = [c['critere'] for c in t['criteres'] if not c['conforme']][:3]
            t['points_forts'] = pts_forts
            t['points_faibles'] = pts_faibles

            resultats.append(t)

        resultats.sort(key=lambda x: x['score_global'], reverse=True)
        for i, r in enumerate(resultats):
            r['classement'] = i + 1

        return Response({
            'total': total,
            'resultats': resultats,
        })


def _generer_infos_terrain(terrain: Terrain) -> dict:
    import hashlib
    seed = hashlib.md5(f'{terrain.id}-{terrain.nom}'.encode()).hexdigest()
    h = int(seed[:8], 16)

    communes = ['Anfa', 'Ain Diab', 'Maarif', 'Hay Hassani', 'Sidi Bernoussi', 'Riad', 'Agdal', 'Souissi', 'Youssoufia', 'Moulay Rachid']
    provinces = ['Casablanca-Anfa', 'Casablanca-Al Fida', 'Casablanca-Aïn Chock', 'Nouaceur', 'Médiouna']
    regions = ['Casablanca-Settat', 'Rabat-Salé-Kénitra', 'Marrakech-Safi', 'Fès-Meknès', 'Tanger-Tétouan-Al Hoceïma']
    zones = ['Zone d\'aménagement A', 'Zone d\'aménagement B', 'Zone industrielle', 'Zone touristique', 'Zone résidentielle']

    superficie = float(terrain.superficie)
    perimetre = round(4 * (superficie ** 0.5) * (0.85 + (h % 100) / 500), 2)

    return {
        'reference_cadastrale': f"{chr(65 + (h % 26))}{chr(65 + ((h // 26) % 26))}-{(h % 900000) + 100000}",
        'commune': communes[h % len(communes)],
        'province': provinces[h % len(provinces)],
        'region': regions[h % len(regions)],
        'superficie': f"{superficie:.2f} m²",
        'perimetre': f"{perimetre:.2f} m",
        'latitude': float(terrain.lat),
        'longitude': float(terrain.lng),
        'zone_amenagement': zones[h % len(zones)],
    }


def _generer_resultats_criteres(terrain: Terrain, filtres: dict) -> list:
    import hashlib, random
    seed = hashlib.md5(f'{terrain.id}-{terrain.nom}-analyse'.encode()).hexdigest()
    rng = random.Random(seed)

    resultats = []

    routes_sel = filtres.get('route_type', [])
    dist_route = int(filtres.get('distance_route', 0))

    for rtype in routes_sel:
        noms_routes = {
            'route_nationale': 'Route Nationale N1', 'route_regionale': 'Route Régionale R301',
            'route_provinciale': 'Route Provinciale P501', 'route_locale': 'Chev. communal',
        }
        dist = rng.randint(50, 3000)
        resultats.append({
            'id': f'route_{rtype}',
            'critere': f"Distance à une {rtype.replace('_', ' ')}",
            'critere_demande': f"≤ {dist_route} m" if dist_route else 'Peu importe',
            'valeur_mesuree': f"{dist} m",
            'valeur_mesuree_brute': dist,
            'unite': 'm',
            'point_interet': noms_routes.get(rtype, 'Route'),
            'conforme': dist <= dist_route if dist_route else True,
        })

    health_types = {'hopital': 'Hôpital', 'clinique': 'Clinique'}
    health_dist = int(filtres.get('distance_health', 2000))
    for htype in filtres.get('health', []):
        dist = rng.randint(100, 8000)
        noms = {
            'hopital': ['Hôpital Ibn Rochd', 'Hôpital Cheikh Zaid', 'Hôpital Avicenne'],
            'clinique': ['Clinique Agdal', 'Clinique Yasmine', 'Clinique les Lys'],
        }
        resultats.append({
            'id': f'health_{htype}',
            'critere': f"Distance à {health_types.get(htype, htype)}",
            'critere_demande': f"≤ {health_dist} m",
            'valeur_mesuree': f"{dist} m",
            'valeur_mesuree_brute': dist,
            'unite': 'm',
            'point_interet': rng.choice(noms.get(htype, ['Établissement'])),
            'conforme': dist <= health_dist,
        })

    edu_types = {'ecole': 'École', 'lycee': 'Lycée', 'universite': 'Université'}
    edu_dist = int(filtres.get('distance_education', 2000))
    for etype in filtres.get('education', []):
        dist = rng.randint(100, 6000)
        noms = {
            'ecole': ['École Al Massira', 'École Ibn Sina', 'École Atlas'],
            'lycee': ['Lycée Descartes', 'Lycée Moulay Youssef', 'Lycée Lyautey'],
            'universite': ['Université Hassan II', 'Université Mohammed V', 'Université Al Akhawayn'],
        }
        resultats.append({
            'id': f'edu_{etype}',
            'critere': f"Distance à {edu_types.get(etype, etype)}",
            'critere_demande': f"≤ {edu_dist} m",
            'valeur_mesuree': f"{dist} m",
            'valeur_mesuree_brute': dist,
            'unite': 'm',
            'point_interet': rng.choice(noms.get(etype, ['Établissement'])),
            'conforme': dist <= edu_dist,
        })

    commerce_types = {'centre_commercial': 'Centre commercial', 'marche': 'Marché'}
    commerce_dist = int(filtres.get('distance_commerce', 2000))
    for ctype in filtres.get('commerce', []):
        dist = rng.randint(100, 5000)
        noms = {
            'centre_commercial': ['Morocco Mall', 'Carré d\'Or', 'Marjane'],
            'marche': ['Marché Central', 'Souk El Had', 'Marché Municipal'],
        }
        resultats.append({
            'id': f'commerce_{ctype}',
            'critere': f"Distance à {commerce_types.get(ctype, ctype)}",
            'critere_demande': f"≤ {commerce_dist} m",
            'valeur_mesuree': f"{dist} m",
            'valeur_mesuree_brute': dist,
            'unite': 'm',
            'point_interet': rng.choice(noms.get(ctype, ['Commerce'])),
            'conforme': dist <= commerce_dist,
        })

    transport_types = {'gare_routiere': 'Gare routière', 'arret_bus': 'Arrêt de bus'}
    transport_dist = int(filtres.get('distance_transport', 1000))
    for ttype in filtres.get('transport', []):
        dist = rng.randint(50, 3000)
        noms = {
            'gare_routiere': ['Gare Routière Ouled Ziane', 'Gare Routière Bab El Had'],
            'arret_bus': ['Arrêt Boulevard Mohammed V', 'Arrêt Place des Nations', 'Arrêt Gare'],
        }
        resultats.append({
            'id': f'transport_{ttype}',
            'critere': f"Distance à {transport_types.get(ttype, ttype)}",
            'critere_demande': f"≤ {transport_dist} m",
            'valeur_mesuree': f"{dist} m",
            'valeur_mesuree_brute': dist,
            'unite': 'm',
            'point_interet': rng.choice(noms.get(ttype, ['Arrêt'])),
            'conforme': dist <= transport_dist,
        })

    admin_types = {'commune': 'la commune', 'poste': 'la poste', 'police': 'le commissariat'}
    admin_dist = int(filtres.get('distance_admin', 2000))
    for atype in filtres.get('admin', []):
        dist = rng.randint(100, 5000)
        noms = {
            'commune': ['Commune Anfa', 'Commune Maarif', 'Arrondissement Hay Hassani'],
            'poste': ['Poste Maarif', 'Poste Central', 'Poste Casablanca'],
            'police': ['Commissariat Anfa', 'Commissariat Hay Hassani', 'Police District'],
        }
        resultats.append({
            'id': f'admin_{atype}',
            'critere': f"Distance à {admin_types.get(atype, atype)}",
            'critere_demande': f"≤ {admin_dist} m",
            'valeur_mesuree': f"{dist} m",
            'valeur_mesuree_brute': dist,
            'unite': 'm',
            'point_interet': rng.choice(noms.get(atype, ['Administration'])),
            'conforme': dist <= admin_dist,
        })

    poles_types = {
        'pole_centre': 'Centre-ville', 'pole_industriel': 'Pôle industriel',
        'pole_commercial': 'Pôle commercial', 'pole_gare': 'Gare',
        'pole_port': 'Port', 'pole_aeroport': 'Aéroport',
    }
    dist_pole = int(filtres.get('distance_poles', 5000))
    for ptype in filtres.get('pole', []):
        dist = rng.randint(500, 15000)
        resultats.append({
            'id': f'pole_{ptype}',
            'critere': f"Distance à {poles_types.get(ptype, ptype)}",
            'critere_demande': f"≤ {dist_pole} m",
            'valeur_mesuree': f"{dist} m",
            'valeur_mesuree_brute': dist,
            'unite': 'm',
            'point_interet': poles_types.get(ptype, ptype),
            'conforme': dist <= dist_pole,
        })

    for ltype in filtres.get('localisation', []):
        label = {'centre_ville': 'Centre-ville', 'periurbaine': 'Périurbaine', 'rurale': 'Rurale'}
        resultats.append({
            'id': f'loc_{ltype}',
            'critere': 'Zone de localisation',
            'critere_demande': label.get(ltype, ltype),
            'valeur_mesuree': label.get(ltype, ltype),
            'valeur_mesuree_brute': 0,
            'unite': '',
            'point_interet': label.get(ltype, ltype),
            'conforme': True,
        })

    pente_val = round(rng.uniform(0.5, 18), 1)
    pente_sel = filtres.get('pente', [])
    if pente_sel:
        conforme = any({
            '0_5': pente_val <= 5, '5_10': 5 < pente_val <= 10,
            '10_15': 10 < pente_val <= 15, 'gt15': pente_val > 15,
        }.get(v, False) for v in pente_sel)
        demande = ', '.join(pente_sel)
        resultats.append({
            'id': 'pente',
            'critere': 'Pente du terrain',
            'critere_demande': demande,
            'valeur_mesuree': f"{pente_val} %",
            'valeur_mesuree_brute': pente_val,
            'unite': '%',
            'point_interet': 'Terrain',
            'conforme': conforme,
        })

    denivele_val = round(rng.uniform(1, 35), 1)
    denivele_sel = filtres.get('denivele', [])
    if denivele_sel:
        conforme = any({
            'lt5': denivele_val < 5, '5_20': 5 <= denivele_val <= 20, 'gt20': denivele_val > 20,
        }.get(v, False) for v in denivele_sel)
        resultats.append({
            'id': 'denivele',
            'critere': 'Dénivelé du terrain',
            'critere_demande': ', '.join(denivele_sel),
            'valeur_mesuree': f"{denivele_val} m",
            'valeur_mesuree_brute': denivele_val,
            'unite': 'm',
            'point_interet': 'Terrain',
            'conforme': conforme,
        })

    altitude_val = round(rng.uniform(10, 500), 1)
    altitude_sel = filtres.get('altitude', [])
    if altitude_sel and 'any' not in altitude_sel:
        conforme = any({
            'lt100': altitude_val < 100, '100_300': 100 <= altitude_val <= 300, 'gt300': altitude_val > 300,
        }.get(v, False) for v in altitude_sel)
        resultats.append({
            'id': 'altitude',
            'critere': 'Altitude du terrain',
            'critere_demande': ', '.join(altitude_sel),
            'valeur_mesuree': f"{altitude_val} m",
            'valeur_mesuree_brute': altitude_val,
            'unite': 'm',
            'point_interet': 'Terrain',
            'conforme': conforme,
        })

    return resultats


class TerrainListView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, projet_pk: int):
        try:
            projet = Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        terrains = Terrain.objects.filter(projet=projet)

        search = request.query_params.get('search', '').strip()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))

        if search:
            from django.db.models import Q
            terrains = terrains.filter(Q(nom__icontains=search))

        total = terrains.count()
        start = (page - 1) * page_size
        end = start + page_size
        page_terrains = terrains[start:end]

        return Response({
            'count': total,
            'results': TerrainListSerializer(page_terrains, many=True).data,
        })

    def post(self, request, projet_pk: int):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Authentification requise.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            projet = Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if projet.investisseur != request.user and request.user.role != 'admin':
            return Response(
                {'detail': "Vous n'avez pas la permission."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TerrainCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        terrain = serializer.save(projet=projet)
        return Response(
            TerrainListSerializer(terrain).data,
            status=status.HTTP_201_CREATED,
        )


class TerrainDetailView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def delete(self, request, projet_pk: int, pk: int):
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentification requise.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            terrain = Terrain.objects.get(pk=pk, projet_id=projet_pk)
        except Terrain.DoesNotExist:
            return Response({'detail': 'Terrain introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        terrain.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CoucheList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Couche.objects.all()
        detail = request.query_params.get('detail') == '1'
        serializer_class = CoucheDetailSerializer if detail else CoucheListSerializer
        return Response(serializer_class(queryset, many=True).data)


class CoucheDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            couche = Couche.objects.get(pk=pk)
        except Couche.DoesNotExist:
            return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CoucheDetailSerializer(couche).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def importer_couche(request, pk):
    try:
        couche = Couche.objects.get(pk=pk)
    except Couche.DoesNotExist:
        return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)

    if 'fichier' not in request.FILES:
        return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

    fichier = request.FILES['fichier']
    nom_fichier = fichier.name

    if not nom_fichier.endswith('.geojson'):
        return Response({'error': 'Format différent : seul le format GeoJSON (.geojson) est accepté'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        raw = fichier.read().decode('utf-8')
        data = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        return Response({'error': f'Format différent : fichier JSON invalide - {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    features = data.get('features', [])
    if not features:
        return Response({'error': 'Aucune entité trouvée dans le fichier'}, status=status.HTTP_400_BAD_REQUEST)

    premiere = features[0]
    geom = premiere.get('geometry')
    props = premiere.get('properties', {})

    if not geom:
        return Response({'error': 'Format différent : aucune géométrie trouvée'}, status=status.HTTP_400_BAD_REQUEST)

    type_geom_fichier = geom['type']
    if couche.type_geometrie and couche.type_geometrie != type_geom_fichier:
        return Response({
            'error': f'Format différent : le type de géométrie attendu est "{couche.type_geometrie}" mais le fichier fourni a "{type_geom_fichier}"'
        }, status=status.HTTP_400_BAD_REQUEST)

    attributs_fichier = list(props.keys())
    attributs_attendus = [a['nom'] for a in couche.attributs] if couche.attributs else []

    if attributs_attendus:
        manquants = [a for a in attributs_attendus if a not in attributs_fichier]
        en_trop = [a for a in attributs_fichier if a not in attributs_attendus]

        erreurs = []
        if manquants:
            erreurs.append(f'Attributs non définis : {", ".join(manquants)} (présents dans la couche mais absents du fichier)')
        if en_trop:
            erreurs.append(f'Attributs inattendus : {", ".join(en_trop)} (présents dans le fichier mais non définis dans la couche)')

        if erreurs:
            ImportCouche.objects.create(couche=couche, fichier=nom_fichier, statut='erreur', message='; '.join(erreurs))
            couche.etat = 'erreur'
            couche.message_erreur = '; '.join(erreurs)
            couche.save()
            return Response({'error': '; '.join(erreurs)}, status=status.HTTP_400_BAD_REQUEST)

    table_liee = couche.table_liee
    if not table_liee:
        return Response({'error': 'Aucune table liée configurée pour cette couche'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    from django.db import connection
    try:
        with connection.cursor() as cur:
            cur.execute(f'TRUNCATE TABLE "{table_liee}" RESTART IDENTITY CASCADE')

            for feature in features:
                geom_feature = json.dumps(feature.get('geometry'))
                props_feature = feature.get('properties', {})

                colonnes = ['geometry']
                valeurs = [geom_feature]
                for attr in attributs_attendus:
                    colonnes.append(f'"{attr}"')
                    valeurs.append(props_feature.get(attr))

                placeholders = ', '.join(['%s'] * len(colonnes))
                cols = ', '.join(colonnes)
                cur.execute(f'INSERT INTO "{table_liee}" ({cols}) VALUES ({placeholders})', valeurs)

        nb = len(features)

        ImportCouche.objects.create(couche=couche, fichier=nom_fichier, statut='succes',
                                    message=f'Import réussi : {nb} enregistrement(s)', nb_enregistrements=nb)

        couche.etat = 'importe'
        couche.message_erreur = ''
        couche.type_geometrie = type_geom_fichier

        fichier.seek(0)
        from datetime import datetime
        nom_sauvegarde = f'{couche.nom}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.geojson'
        couche.fichier.save(nom_sauvegarde, ContentFile(fichier.read()), save=False)
        couche.taille_fichier = fichier.size
        couche.format_fichier = 'GeoJSON'
        couche.save()

        return Response({'message': f'Import réussi : {nb} enregistrement(s) importé(s)', 'nb_enregistrements': nb})

    except Exception as e:
        ImportCouche.objects.create(couche=couche, fichier=nom_fichier, statut='erreur', message=str(e))
        couche.etat = 'erreur'
        couche.message_erreur = str(e)
        couche.save()
        return Response({'error': f'Erreur lors de l\'import : {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def telecharger_couche(request, pk):
    try:
        couche = Couche.objects.get(pk=pk)
    except Couche.DoesNotExist:
        return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)

    if not couche.fichier:
        return Response({'error': 'Aucun fichier disponible pour cette couche'}, status=status.HTTP_404_NOT_FOUND)

    from django.http import FileResponse
    file_path = couche.fichier.path
    if not os.path.exists(file_path):
        return Response({'error': 'Fichier introuvable sur le disque'}, status=status.HTTP_404_NOT_FOUND)

    return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=f'{couche.nom}.geojson')

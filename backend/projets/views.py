import json
import os
import re

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import connection
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authentication import JWTOptionalAuthentication

from .models import Analyse, Couche, ImportCouche, PonderationPreference, Projet, ResultatAnalyse, Terrain, TypeProjet
from .serializers import (
    AnalyseCreateSerializer,
    AnalyseDetailSerializer,
    AnalyseListSerializer,
    AnalysePondereeSerializer,
    CoucheDetailSerializer,
    CoucheListSerializer,
    PonderationPreferenceSerializer,
    ProjetCreateSerializer,
    ProjetDetailSerializer,
    ProjetListSerializer,
    ProjetUpdateSerializer,
    ResultatAnalyseSerializer,
    TerrainCreateSerializer,
    TerrainListSerializer,
    TypeProjetSerializer,
)


def _log(utilisateur, action, entite, description):
    from dashboard.models import Activite
    Activite.log(utilisateur, action, entite, description)


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
        _log(request.user, 'ajout', 'projet', f'Création du projet "{projet.nom}"')
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
        _log(request.user, 'modification', 'projet', f'Modification du projet "{projet.nom}"')
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

        nom_projet = projet.nom
        projet.delete()
        _log(request.user, 'suppression', 'projet', f'Suppression du projet "{nom_projet}"')
        return Response({'message': 'Projet supprimé avec succès.'}, status=status.HTTP_200_OK)


class ProjetRentabilitePreviewView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        from .profitability import calculer_rentabilite_projet
        from types import SimpleNamespace

        d = request.data if isinstance(request.data, dict) else {}

        def _g(key, default=None):
            v = d.get(key, default)
            if v == '' or v is None:
                return default
            return v

        projet = SimpleNamespace(
            surface_souhaitee=_g('surface_souhaitee', 0),
            surface_totale=_g('surface_totale'),
            prix_foncier_m2=_g('prix_foncier_m2'),
            frais_acquisition=_g('frais_acquisition', 7),
            taux_chute=_g('taux_chute', 30),
            cos=_g('cos'),
            cus=_g('cus'),
            surface_constructible=_g('surface_constructible'),
            surface_voie=_g('surface_voie'),
            surface_espace_vert=_g('surface_espace_vert'),
            has_appartement=_g('has_appartement', True),
            has_commerce=_g('has_commerce', False),
            has_bureau=_g('has_bureau', False),
            has_equipement=_g('has_equipement', False),
            has_equipement_prive=_g('has_equipement_prive', False),
            quote_part_appartement=_g('quote_part_appartement', 100),
            quote_part_commerce=_g('quote_part_commerce', 0),
            quote_part_bureau=_g('quote_part_bureau', 0),
            quote_part_equipement=_g('quote_part_equipement', 0),
            quote_part_equipement_prive=_g('quote_part_equipement_prive', 0),
            prix_vente_appartement=_g('prix_vente_appartement'),
            prix_vente_commerce=_g('prix_vente_commerce'),
            prix_vente_bureau=_g('prix_vente_bureau'),
            surface_equipement=_g('surface_equipement'),
            prix_vente_equipement=_g('prix_vente_equipement'),
            surface_equipement_prive=_g('surface_equipement_prive'),
            prix_vente_equipement_prive=_g('prix_vente_equipement_prive'),
            cout_construction_appartement=_g('cout_construction_appartement'),
            cout_construction_commerce=_g('cout_construction_commerce'),
            cout_construction_bureau=_g('cout_construction_bureau'),
            cout_construction_equipement=_g('cout_construction_equipement'),
            cout_construction_equipement_prive=_g('cout_construction_equipement_prive'),
            taux_etudes_honoraires=_g('taux_etudes_honoraires', 10),
            taux_imprevus=_g('taux_imprevus', 5),
            taux_commercialisation=_g('taux_commercialisation', 3),
            duree_construction=_g('duree_construction', 2),
            duree_commercialisation=_g('duree_commercialisation', 3),
            taux_actualisation=_g('taux_actualisation', 8),
            repartition_construction=_g('repartition_construction'),
            repartition_ventes=_g('repartition_ventes'),
        )

        try:
            result = calculer_rentabilite_projet(projet)
        except Exception as exc:
            return Response({'ok': False, 'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)


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


class AnalyseParcellesView(APIView):
    """Analyse multicritère réelle des parcelles cadastrales (couches SIG)."""

    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, projet_pk: int):
        try:
            Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        from .analyse import analyser_parcelles

        filtres = request.data or {}
        try:
            return Response(analyser_parcelles(projet_pk, filtres))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': f'Erreur lors de l’analyse : {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        label = {'centre_ville': 'Centre-ville', 'periurbaine': 'Périphérie'}
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

    altitude_val = round(rng.uniform(20, 450), 1)
    altitude_sel = filtres.get('altitude', [])
    if altitude_sel:
        conforme = any({
            'lt100': altitude_val < 100, '100_300': 100 <= altitude_val <= 300,
            'gt300': altitude_val > 300,
        }.get(v, False) for v in altitude_sel)
        demande = ', '.join(altitude_sel)
        resultats.append({
            'id': 'altitude',
            'critere': 'Altitude du terrain',
            'critere_demande': demande,
            'valeur_mesuree': f"{altitude_val} m",
            'valeur_mesuree_brute': altitude_val,
            'unite': 'm',
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
        terrain = serializer.save(projet=projet, utilisateur=request.user)
        _log(request.user, 'ajout', 'terrain', f'Ajout du terrain "{terrain.nom}" (projet {projet.nom})')
        return Response(
            TerrainListSerializer(terrain).data,
            status=status.HTTP_201_CREATED,
        )


class TerrainDetailView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def patch(self, request, projet_pk: int, pk: int):
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentification requise.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            terrain = Terrain.objects.get(pk=pk, projet_id=projet_pk)
        except Terrain.DoesNotExist:
            return Response({'detail': 'Terrain introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        rentabilite_data = request.data.get('rentabilite_json')
        if rentabilite_data is None:
            return Response({'detail': 'rentabilite_json requis.'}, status=status.HTTP_400_BAD_REQUEST)
        terrain.rentabilite_json = rentabilite_data
        terrain.save(update_fields=['rentabilite_json'])
        from .serializers import TerrainListSerializer
        return Response(TerrainListSerializer(terrain).data)

    def delete(self, request, projet_pk: int, pk: int):
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentification requise.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            terrain = Terrain.objects.get(pk=pk, projet_id=projet_pk)
        except Terrain.DoesNotExist:
            return Response({'detail': 'Terrain introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        nom_terrain = terrain.nom
        terrain.delete()
        _log(request.user, 'suppression', 'terrain', f'Suppression du terrain "{nom_terrain}"')
        return Response(status=status.HTTP_204_NO_CONTENT)


class TerrainBulkImportView(APIView):
    """Importe un fichier GeoJSON cadastral en terrains pour un projet."""

    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, projet_pk: int):
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentification requise.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            projet = Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if projet.investisseur != request.user and request.user.role != 'admin':
            return Response({'detail': "Vous n'avez pas la permission."}, status=status.HTTP_403_FORBIDDEN)

        fichier = request.FILES.get('fichier')
        if not fichier:
            return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        if not fichier.name.endswith('.geojson'):
            return Response({'detail': 'Format non supporté. Seul le GeoJSON est accepté.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = json.loads(fichier.read().decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            return Response({'detail': f'GeoJSON invalide : {exc}'}, status=status.HTTP_400_BAD_REQUEST)

        features = data.get('features') or []
        if not features:
            return Response({'detail': 'Aucune entité trouvée dans le fichier.'}, status=status.HTTP_400_BAD_REQUEST)

        remplacer = request.data.get('remplacer', 'false') in ('true', '1', 'True')
        if remplacer:
            Terrain.objects.filter(projet=projet).delete()

        terrains = []
        skipped = 0
        for i, feature in enumerate(features):
            props = feature.get('properties') or {}
            geom_data = feature.get('geometry')

            if not geom_data:
                skipped += 1
                continue

            try:
                from django.contrib.gis.geos import GEOSGeometry as GEOSGeom
                geom = GEOSGeom(json.dumps(geom_data))
            except Exception:
                skipped += 1
                continue

            if geom is None:
                skipped += 1
                continue

            if not geom.valid:
                try:
                    geom = geom.make_valid()
                except Exception:
                    skipped += 1
                    continue

            geom.srid = 4326
            centroid = geom.centroid

            num = props.get('num') or ''
            surface_val = props.get('surface') or 0
            try:
                surface_val = round(float(surface_val), 2)
            except (TypeError, ValueError):
                surface_val = 0

            ind = (props.get('indice') or '').strip()
            if num and ind and not num.endswith(f'/{ind}') and '/' not in num:
                nom = f'Parcelle {num}/{ind}'
            elif num:
                nom = f'Parcelle {num}'
            else:
                nom = f'Parcelle {i + 1}'

            terrains.append(Terrain(
                projet=projet,
                utilisateur=request.user,
                nom=nom,
                superficie=surface_val,
                lat=round(centroid.y, 6),
                lng=round(centroid.x, 6),
                num_parcelle=num,
                num_titre_foncier=num,
                fid=props.get('fid'),
                indice=props.get('indice') or '',
                complement=props.get('complement') or '',
                consistance=props.get('Consistance') or '',
                geometry=geom,
            ))

        created = Terrain.objects.bulk_create(terrains, batch_size=100)
        _log(request.user, 'ajout', 'terrain', f'Import de {len(created)} parcelle(s) dans le projet "{projet.nom}"')

        return Response({
            'message': f'{len(created)} terrain(s) importé(s).',
            'nb_importes': len(created),
            'nb_ignores': skipped,
        }, status=status.HTTP_201_CREATED)


ALLOWED_DESIGNATIONS = {
    'B', 'B2', 'B3', 'B4', 'SB', 'SB2', 'SB4', 'SB6',
    'C', 'C2', 'C4',
    'ZPI',
    'ZS',
    'IN', 'IN2', 'IN3', 'INS',
    'D', 'DS1', 'D1', 'D5',
}

IGNORABLE_DESIGNATIONS = {
    '', 'none', 'null', 'undefined', '-', 'affectation non définie',
    'affectation non definie', 'non défini', 'non defini', 'inconnu'
}

# Préfixes désignations considérées « Non définie » dans le PA de Témara
# (aucune règle de constructibilité ni surfaces à retrancher) : on leur
# applique exactement le même traitement que la désignation NULL.
NON_DEFINIE_DESIGNATIONS = {'AA', 'AAT', 'HA', 'MK', 'TA', 'SK', 'ME'}

# Fallback CUS (coefficient d'emprise au sol) par désignation constructible,
# utilisé uniquement quand l'attribut 'cus' du PA est NULL/vide pour cette
# entité. COS reste « libre »/non fixé et donc éditable par l'utilisateur.
CUS_FALLBACK = {
    'B3': 0.75,
    'C2': 0.40,
    'C4': 0.35,
    'D1': 0.30,
    'D5': 0.20,
}


def _cus_fallback(designation: str, type_construction: str | None):
    """CUS de secours selon la désignation (et le type de lot pour DS1)."""
    d = (designation or '').strip().upper()
    if d == 'DS1':
        tc = (type_construction or '').lower()
        if 'bande' in tc:
            return 0.50
        if 'jumel' in tc:
            return 0.40
        return 0.30
    return CUS_FALLBACK.get(d)


def _is_constructible_designation(designation: str) -> bool:
    d = (designation or '').strip().upper()
    return d in ALLOWED_DESIGNATIONS


def _is_ignorable_designation(designation: str) -> bool:
    d = (designation or '').strip().lower()
    return not d or d.startswith('ta') or d in IGNORABLE_DESIGNATIONS


def _is_non_definie_designation(designation: str) -> bool:
    """Vrai si la désignation est « Non définie » (à exclure comme le NULL).

    Retourne True pour les désignations NULL/vides, les préfixes explicitement
    « Non définie » (AA, AAT, HA, MK, TA, SK, ME) et tout code qui ne
    correspond à aucune catégorie connue du PA.
    """
    raw = (designation or '').strip()
    if not raw:
        return True
    d = raw.upper()
    if d in NON_DEFINIE_DESIGNATIONS:
        return True
    if d in ALLOWED_DESIGNATIONS:
        return False
    # Équipement public/privé
    if re.match(r'^(A|P|E|S|SP|M|C|G)\d{2,}$', d):
        return False
    # Voie / espace vert / non constructible
    if re.match(r'^(TE|CP|PS|PL|RP|RN|RR)\d*$', d):
        return False
    if re.match(r'^V\d*$', d):
        return False
    if d in ('RB', 'RS'):
        return False
    # Autre voie identifiée par son type de construction ou code inconnu
    return True


def _is_child_affectation(code_a: str, code_b: str) -> bool:
    """Retourne True si code_a est une affectation fille / sous-zone de code_b (mère).
    Ex: IN2 est fille de IN, B2 est fille de B, SB4 est fille de B ou SB, DS1 est fille de D.
    """
    ca = (code_a or '').strip().upper()
    cb = (code_b or '').strip().upper()
    if not ca or not cb or ca == cb:
        return False
    if ca.startswith(cb) and len(ca) > len(cb):
        return True
    if ca.startswith('SB') and cb == 'B':
        return True
    if ca.startswith('DS') and cb == 'D':
        return True
    return False


def _resolve_parent_child_constructibles(affectations: list) -> list:
    """Résout les superpositions entre affectations constructibles parent/enfant.
    Pour les affectations comme IN et IN2 :
    - Conserve l'affectation fille IN2 avec sa surface.
    - Déduit la surface de IN2 de l'affectation mère IN.
    - Si la surface restante de IN est <= 0.1 m² (complètement superposées), supprime IN.
    """
    if not affectations:
        return []

    constr = [dict(a) for a in affectations if a.get('type') == 'constructible']
    non_constr = [dict(a) for a in affectations if a.get('type') != 'constructible']

    if len(constr) <= 1:
        return affectations

    # Trier les constructibles par spécificité décroissante (les filles en premier)
    def _spec_key(a):
        code = a['designation'].upper()
        digits = sum(1 for c in code if c.isdigit())
        return (digits > 0, len(code), a['surface_m2'])

    constr_sorted = sorted(constr, key=_spec_key, reverse=True)

    for i, child in enumerate(constr_sorted):
        child_code = child['designation'].upper()
        child_area = child['surface_m2']
        if child_area <= 0:
            continue

        for j in range(i + 1, len(constr_sorted)):
            parent = constr_sorted[j]
            parent_code = parent['designation'].upper()
            if parent['surface_m2'] <= 0:
                continue

            if _is_child_affectation(child_code, parent_code):
                parent['surface_m2'] = max(0.0, round(parent['surface_m2'] - child_area, 2))

    active_constr = [a for a in constr_sorted if a['surface_m2'] > 0.1]
    active_constr.sort(key=lambda a: a['surface_m2'], reverse=True)

    return active_constr + non_constr


class SurfaceConstructibleView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    EQUIPEMENT_DESIGNATIONS_RE = r'^(A|P|E|S|SP|M|C|G)\d{2,}'

    def get(self, request, projet_pk: int, terrain_pk: int):
        try:
            terrain = Terrain.objects.get(pk=terrain_pk, projet_id=projet_pk)
        except Terrain.DoesNotExist:
            return Response({'detail': 'Terrain introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if not terrain.geometry:
            return Response({'surface_constructible': 0, 'superficie': 0, 'taux': 0, 'non_construable': 0, 'affectations': []})

        return self._compute(terrain.geometry.wkt, float(terrain.superficie) if terrain.superficie else 0)

    def post(self, request, projet_pk: int, terrain_pk: int = 0):
        geometry = request.data.get('geometry')
        superficie = float(request.data.get('superficie', 0) or 0)
        if not geometry:
            return Response({'detail': 'geometry requise.'}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.gis.geos import GEOSException, fromstr
        try:
            geom = fromstr(json.dumps(geometry)) if isinstance(geometry, dict) else fromstr(geometry)
        except (GEOSException, TypeError, ValueError) as exc:
            return Response({'detail': f'Géométrie invalide : {exc}'}, status=status.HTTP_400_BAD_REQUEST)
        if superficie <= 0:
            try:
                from pyproj import Transformer
                transformer = Transformer.from_crs('EPSG:4326', 'EPSG:32629', always_xy=True)
                coords = geom.coords
                from shapely.geometry import Polygon
                projected = Polygon([(transformer.transform(x, y)[0], transformer.transform(x, y)[1]) for x, y in coords[0]])
                superficie = round(projected.area, 2)
            except Exception:
                superficie = 0
        return self._compute(geom.wkt, superficie)

    @staticmethod
    def _compute(terrain_wkt: str, terrain_superficie: float):
        sql = """
            SELECT pa.designation, pa.type_construction, pa.cos, pa.cus, pa.hauteur_max, pa.largeur_min,
                ST_Area(
                    ST_Intersection(
                        ST_SetSRID(ST_GeomFromText(%s), 4326),
                        ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
                    )::geography
                ) as intersection_area_m2
            FROM couche_plan_amenagement pa
            WHERE pa.geometry IS NOT NULL
            AND ST_Intersects(
                ST_SetSRID(ST_GeomFromText(%s), 4326),
                ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
            )
        """

        try:
            with connection.cursor() as cur:
                cur.execute(sql, [terrain_wkt, terrain_wkt])
                rows = cur.fetchall()
        except Exception as exc:
            return Response(
                {'detail': f'Erreur calcul surface constructible : {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        non_constr = 0.0
        raw_affectations = []
        for designation, type_construction, cos_val, cus_val, h_max, l_min, area_m2 in rows:
            area = round(float(area_m2), 2)
            if area <= 0:
                continue
            raw_d = (designation or '').strip()
            raw_tc = (type_construction or '').strip() or None
            cos_num = None if cos_val is None else float(cos_val)
            cus_num = None if cus_val is None else float(cus_val)
            h_max_str = str(h_max).strip() if h_max is not None else None
            l_min_str = str(l_min).strip() if l_min is not None else None
            if cus_num is None and _is_constructible_designation(raw_d):
                cus_num = _cus_fallback(raw_d, raw_tc)
            if _is_non_definie_designation(raw_d):
                continue

            aff_item = {
                'designation': raw_d,
                'surface_m2': area,
                'type': 'constructible' if _is_constructible_designation(raw_d) else 'non_constructible',
                'type_construction': raw_tc,
                'cos': cos_num,
                'cus': cus_num,
                'hauteur_max': h_max_str,
                'largeur_min': l_min_str,
            }
            if _is_constructible_designation(raw_d):
                raw_affectations.append(aff_item)
            else:
                non_constr += area
                raw_affectations.append(aff_item)

        # Résolution des superpositions parent / enfant
        affectations = _resolve_parent_child_constructibles(raw_affectations)

        surface_constructible = max(0.0, terrain_superficie - non_constr)
        taux = round(surface_constructible / terrain_superficie * 100, 1) if terrain_superficie > 0 else 0.0

        dominant = None
        if affectations:
            constr_affectations = [a for a in affectations if a['type'] == 'constructible']
            if constr_affectations:
                def _dominant_key(a):
                    return (a['surface_m2'], len(a['designation']))
                dominant = max(constr_affectations, key=_dominant_key)

        return Response({
            'surface_constructible': round(surface_constructible, 2),
            'superficie': terrain_superficie,
            'taux': taux,
            'non_construable': round(non_constr, 2),
            'affectations': affectations,
            'designation_dominante': dominant['designation'] if dominant else None,
            'cos': dominant['cos'] if dominant else None,
            'cus': dominant['cus'] if dominant else None,
        })

    @staticmethod
    def _compute_equipement(terrain_wkt: str, terrain_superficie: float = 0.0) -> dict:
        """Calcule les surfaces d'équipement, de voirie et d'espaces verts.

        Recherche l'intersection avec :
          - couche_plan_amenagement : zones PA à vocation équipement / voirie / espace vert
            * Équipement public : Administrations A, Services publics P, Enseignement E,
              Santé S, Sport SP, Mosquées M, Cimetières C  (PS = parc de stationnement est
              désormais classé en voirie, retiré des équipements)
            * Équipement privé : G
            * Voirie : TE, CP (chemin piéton), PS (parc de stationnement), PL (place),
              RP (rond-point), RN, RR  (désignation et/ou type_construction)
            * Espaces verts : V (et type_construction « espace vert »…)
          - couche_equipements_publics : équipements publics réels (école, hôpital, …)
        Retourne un dict avec surface_equipement, surface_equipement_prive,
        surface_voie, surface_espace_vert et leurs taux.
        """
        sql_pa_publique = """
            SELECT
                ST_Area(
                    ST_Intersection(
                        ST_SetSRID(ST_GeomFromText(%s), 4326),
                        ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
                    )::geography
                ) as intersection_area_m2
            FROM couche_plan_amenagement pa
            WHERE pa.designation IS NOT NULL
            AND UPPER(TRIM(pa.designation)) ~ '^(A|E|M|C|SP|S|P)[0-9]{2,}'
            AND ST_Intersects(
                ST_SetSRID(ST_GeomFromText(%s), 4326),
                ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
            )
        """
        sql_pa_prive = """
            SELECT
                ST_Area(
                    ST_Intersection(
                        ST_SetSRID(ST_GeomFromText(%s), 4326),
                        ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
                    )::geography
                ) as intersection_area_m2
            FROM couche_plan_amenagement pa
            WHERE pa.designation IS NOT NULL
            AND UPPER(TRIM(pa.designation)) ~ '^G[0-9]{2,}'
            AND ST_Intersects(
                ST_SetSRID(ST_GeomFromText(%s), 4326),
                ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
            )
        """
        sql_voie = """
            SELECT
                ST_Area(
                    ST_Intersection(
                        ST_SetSRID(ST_GeomFromText(%s), 4326),
                        ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
                    )::geography
                ) as intersection_area_m2
            FROM couche_plan_amenagement pa
            WHERE pa.designation IS NOT NULL
            AND (
                UPPER(TRIM(pa.designation)) ~ '^(TE|CP|PS|PL|RP|RN|RR)[0-9 -]*'
                OR LOWER(COALESCE(pa.type_construction, ''))
                   ~ '(chemin|place publique|place|parking|stationnement|voie|rue|rond|pi[ée]ton|autoroute)'
            )
            AND ST_Intersects(
                ST_SetSRID(ST_GeomFromText(%s), 4326),
                ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
            )
        """
        sql_espace_vert = """
            SELECT
                ST_Area(
                    ST_Intersection(
                        ST_SetSRID(ST_GeomFromText(%s), 4326),
                        ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
                    )::geography
                ) as intersection_area_m2
            FROM couche_plan_amenagement pa
            WHERE pa.designation IS NOT NULL
            AND (
                UPPER(TRIM(pa.designation)) ~ '^V[0-9 -]*'
                OR LOWER(COALESCE(pa.type_construction, ''))
                   ~ '(espace vert|mail plant[ée]|square|jardin|parc paysager|plante|aedificandi)'
            )
            AND ST_Intersects(
                ST_SetSRID(ST_GeomFromText(%s), 4326),
                ST_SetSRID(ST_GeomFromGeoJSON(pa.geometry::text), 4326)
            )
        """
        sql_eq = """
            SELECT
                ST_Area(
                    ST_Intersection(
                        ST_SetSRID(ST_GeomFromText(%s), 4326),
                        ST_SetSRID(ST_GeomFromGeoJSON(ep.geometry::text), 4326)
                    )::geography
                ) as intersection_area_m2
            FROM couche_equipements_publics ep
            WHERE ep.geometry IS NOT NULL
            AND ST_Intersects(
                ST_SetSRID(ST_GeomFromText(%s), 4326),
                ST_SetSRID(ST_GeomFromGeoJSON(ep.geometry::text), 4326)
            )
        """
        total_pub = 0.0
        total_prive = 0.0
        total_voie = 0.0
        total_espace_vert = 0.0
        try:
            with connection.cursor() as cur:
                cur.execute(sql_pa_publique, [terrain_wkt, terrain_wkt])
                for (area,) in cur.fetchall():
                    v = float(area)
                    if v > 0:
                        total_pub += v
                cur.execute(sql_pa_prive, [terrain_wkt, terrain_wkt])
                for (area,) in cur.fetchall():
                    v = float(area)
                    if v > 0:
                        total_prive += v
                cur.execute(sql_voie, [terrain_wkt, terrain_wkt])
                for (area,) in cur.fetchall():
                    v = float(area)
                    if v > 0:
                        total_voie += v
                cur.execute(sql_espace_vert, [terrain_wkt, terrain_wkt])
                for (area,) in cur.fetchall():
                    v = float(area)
                    if v > 0:
                        total_espace_vert += v
                cur.execute(sql_eq, [terrain_wkt, terrain_wkt])
                for (area,) in cur.fetchall():
                    v = float(area)
                    if v > 0:
                        total_pub += v
        except Exception:
            pass

        surface_pub = round(total_pub, 2)
        taux_pub = round(surface_pub / terrain_superficie * 100, 2) if terrain_superficie > 0 else 0.0
        surface_prive = round(total_prive, 2)
        taux_prive = round(surface_prive / terrain_superficie * 100, 2) if terrain_superficie > 0 else 0.0
        surface_voie = round(total_voie, 2)
        taux_voie = round(surface_voie / terrain_superficie * 100, 2) if terrain_superficie > 0 else 0.0
        surface_espace_vert = round(total_espace_vert, 2)
        taux_espace_vert = round(surface_espace_vert / terrain_superficie * 100, 2) if terrain_superficie > 0 else 0.0
        return {
            'surface_equipement': surface_pub,
            'taux_equipement': taux_pub,
            'surface_equipement_prive': surface_prive,
            'taux_equipement_prive': taux_prive,
            'surface_voie': surface_voie,
            'surface_espace_vert': surface_espace_vert,
        }


class SurfaceEquipementView(APIView):
    """Calcule la surface d'équipement pour un terrain donné."""
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, projet_pk: int, terrain_pk: int):
        try:
            terrain = Terrain.objects.get(pk=terrain_pk, projet_id=projet_pk)
        except Terrain.DoesNotExist:
            return Response({'detail': 'Terrain introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        if not terrain.geometry:
            return Response({'surface_equipement': 0, 'taux_equipement': 0, 'surface_equipement_prive': 0, 'taux_equipement_prive': 0, 'surface_voie': 0, 'surface_espace_vert': 0})
        superficie = float(terrain.superficie) if terrain.superficie else 0.0
        result = SurfaceConstructibleView._compute_equipement(terrain.geometry.wkt, superficie)
        return Response(result)

    def post(self, request, projet_pk: int):
        geometry = request.data.get('geometry')
        superficie = float(request.data.get('superficie', 0) or 0)
        if not geometry:
            return Response({'detail': 'geometry requise.'}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.gis.geos import GEOSException, fromstr
        try:
            geom = fromstr(json.dumps(geometry)) if isinstance(geometry, dict) else fromstr(geometry)
        except (GEOSException, TypeError, ValueError) as exc:
            return Response({'detail': f'Géométrie invalide : {exc}'}, status=status.HTTP_400_BAD_REQUEST)
        if superficie <= 0:
            try:
                from pyproj import Transformer
                from shapely.geometry import Polygon
                transformer = Transformer.from_crs('EPSG:4326', 'EPSG:32629', always_xy=True)
                coords = geom.coords
                projected = Polygon([(transformer.transform(x, y)[0], transformer.transform(x, y)[1]) for x, y in coords[0]])
                superficie = round(projected.area, 2)
            except Exception:
                superficie = 0.0
        result = SurfaceConstructibleView._compute_equipement(geom.wkt, superficie)
        return Response(result)


class CoucheList(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = Couche.objects.all()
        detail = request.query_params.get('detail') == '1'
        serializer_class = CoucheDetailSerializer if detail else CoucheListSerializer
        return Response(serializer_class(queryset, many=True).data)


class CoucheDetail(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

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
            cur.execute(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)",
                [table_liee],
            )
            table_exists = cur.fetchone()[0]

            if not table_exists:
                col_defs = ['"id" BIGSERIAL PRIMARY KEY', '"geometry" JSONB NOT NULL']
                for attr in (couche.attributs or []):
                    attr_name = attr.get('nom', '')
                    attr_type = attr.get('type', 'string')
                    if attr_type == 'number':
                        col_defs.append(f'"{attr_name}" DOUBLE PRECISION')
                    else:
                        col_defs.append(f'"{attr_name}" TEXT')
                create_sql = f'CREATE TABLE IF NOT EXISTS "{table_liee}" ({", ".join(col_defs)})'
                cur.execute(create_sql)

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

        _log(request.user, 'modification', 'couche', f'Import de la couche "{couche.nom_affichage}" : {nb} enregistrement(s)')

        return Response({'message': f'Import réussi : {nb} enregistrement(s) importé(s)', 'nb_enregistrements': nb})

    except Exception as e:
        ImportCouche.objects.create(couche=couche, fichier=nom_fichier, statut='erreur', message=str(e))
        couche.etat = 'erreur'
        couche.message_erreur = str(e)
        couche.save()
        return Response({'error': f'Erreur lors de l\'import : {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@authentication_classes([JWTOptionalAuthentication])
@permission_classes([AllowAny])
def telecharger_couche(request, pk):
    try:
        couche = Couche.objects.get(pk=pk)
    except Couche.DoesNotExist:
        return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)

    from django.db import connection
    from django.http import HttpResponse, FileResponse
    import io

    table_liee = couche.table_liee

    # Si la couche a une table liée dans PostgreSQL, on génère le GeoJSON depuis la base
    if table_liee:
        attributs_attendus = [a['nom'] for a in couche.attributs] if couche.attributs else []
        col_sql = ', '.join(f'"{c}"' for c in attributs_attendus)
        sql = f'SELECT geometry, {col_sql} FROM "{table_liee}"' if attributs_attendus else f'SELECT geometry FROM "{table_liee}"'

        features = []
        try:
            with connection.cursor() as cur:
                cur.execute(sql)
                for row in cur.fetchall():
                    props = {}
                    for i, nom in enumerate(attributs_attendus):
                        props[nom] = row[i + 1]
                    geometry = row[0]
                    if isinstance(geometry, str):
                        try:
                            geometry = json.loads(geometry)
                        except ValueError:
                            geometry = None
                    if not isinstance(geometry, dict) or geometry.get('type') not in ('Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'):
                        continue
                    features.append({'type': 'Feature', 'properties': props, 'geometry': geometry})
        except Exception as e:
            return Response({'error': f'Erreur lors de la génération du fichier : {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        collection = {'type': 'FeatureCollection', 'features': features}
        contenu = json.dumps(collection, ensure_ascii=False).encode('utf-8')

        response = HttpResponse(contenu, content_type='application/geo+json')
        response['Content-Disposition'] = f'attachment; filename="{couche.nom}.geojson"'
        return response

    if couche.fichier:
        file_path = couche.fichier.path
        if os.path.exists(file_path):
            ext = os.path.splitext(couche.fichier.name)[1] or '.geojson'
            return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=f'{couche.nom}{ext}')

    return Response({'error': 'Aucune donnée disponible pour cette couche'}, status=status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Analyses sauvegardées
# ---------------------------------------------------------------------------

class AnalyseListView(APIView):
    """Liste l'historique des analyses d'un projet et en enregistre une nouvelle."""

    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, projet_pk: int):
        try:
            Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        analyses = Analyse.objects.filter(projet_id=projet_pk)
        return Response(AnalyseListSerializer(analyses, many=True).data)

    def post(self, request, projet_pk: int):
        try:
            projet = Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AnalyseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            analyse = serializer.save(projet=projet)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': f'Erreur lors de l’enregistrement de l’analyse : {exc}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        _log(request.user, 'ajout', 'analyse', f'Analyse #{analyse.pk} sur le projet "{projet.nom}" ({analyse.nombre_parcelles} parcelle(s))')
        return Response(AnalyseDetailSerializer(analyse).data, status=status.HTTP_201_CREATED)


class AnalyseDetailView(APIView):
    """Détail d'une analyse enregistrée (avec ses résultats)."""

    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, projet_pk: int, analyse_pk: int):
        try:
            analyse = Analyse.objects.get(pk=analyse_pk, projet_id=projet_pk)
        except Analyse.DoesNotExist:
            return Response({'detail': 'Analyse introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AnalyseDetailSerializer(analyse).data)


class AnalyseResultatsView(APIView):
    """Résultats d'une analyse enregistrée."""

    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, projet_pk: int, analyse_pk: int):
        try:
            analyse = Analyse.objects.get(pk=analyse_pk, projet_id=projet_pk)
        except Analyse.DoesNotExist:
            return Response({'detail': 'Analyse introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        resultats = ResultatAnalyse.objects.filter(analyse_id=analyse.pk)
        return Response({
            'total': resultats.count(),
            'resultats': ResultatAnalyseSerializer(resultats, many=True).data,
        })


# ---------------------------------------------------------------------------
# Analyse pondérée AHP+ROC
# ---------------------------------------------------------------------------

class AnalysePondereeView(APIView):
    """Analyse multicritère avec pondération AHP (catégories) + ROC (sous-critères)."""

    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, projet_pk: int):
        try:
            projet = Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AnalysePondereeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            from .analyse import extraire_donnees_ponderation
            from .ahp import calculer_poids_ahp
            from .scoring import calculer_poids_globaux, calculer_score_terrain, calculer_contributions
            from .normalisation import (
                normaliser_distances, score_localisation, score_altitude,
            )

            matrice_ahp = data['matrice_ahp']
            ordre_categories = data.get('ordre_categories', [])
            ordres_roc = data['ordres_roc']
            selections = data['selections_criteres']
            prefs_loc = data['preferences_localisation']
            plages_altitude = data['preferences_altitude']
            seuil = data['seuil']

            # 1. Poids AHP
            resultat_ahp = calculer_poids_ahp(
                matrice_ahp,
                ordre=ordre_categories if ordre_categories else None,
            )
            poids_ahp = resultat_ahp['poids']

            # 2. Extraire les distances GIS
            donnees = extraire_donnees_ponderation(projet_pk, {
                'accessibilite': selections.get('accessibilite', []),
                'route_type': selections.get('route_type', 'peu_importe'),
            })

            # 3. Normaliser les distances par catégorie
            distances_brutes: dict[str, dict[str, float]] = {}
            for t in donnees['terrains']:
                for cat, dist in t['distances'].items():
                    if dist is not None:
                        if cat not in distances_brutes:
                            distances_brutes[cat] = {}
                        distances_brutes[cat][str(t['id'])] = dist

            scores_dist_norm = {}
            for cat, dists in distances_brutes.items():
                scores_dist_norm[cat] = normaliser_distances(dists)

            # 4. Poids globaux
            poids_globaux = calculer_poids_globaux(poids_ahp, ordres_roc)

            # 5. Score par terrain
            resultats = []
            for t in donnees['terrains']:
                tid = str(t['id'])
                scores_norm = {}

                # Scores de distance normalisés
                for cat in distances_brutes:
                    if tid in scores_dist_norm.get(cat, {}):
                        scores_norm[cat] = scores_dist_norm[cat][tid]

                # Localisation
                zone_terrain = t['zone_localisation']
                choix_loc = prefs_loc.get('localisation')
                if choix_loc and 'localisation' in poids_globaux:
                    scores_norm['localisation'] = score_localisation(zone_terrain, choix_loc)

                # Altitude
                if plages_altitude and t['altitude'] is not None and 'altitude' in poids_globaux:
                    scores_norm['altitude'] = score_altitude(t['altitude'], plages_altitude)

                score = calculer_score_terrain(scores_norm, poids_globaux)

                if score < seuil:
                    continue

                contributions = calculer_contributions(scores_norm, poids_globaux)

                resultats.append({
                    'id': t['id'],
                    'nom': t['nom'],
                    'superficie': t['superficie'],
                    'lat': t['lat'],
                    'lng': t['lng'],
                    'reference_cadastrale': t.get('reference_cadastrale', ''),
                    'indice': t.get('indice', ''),
                    'consistance': t.get('consistance', ''),
                    'fid': t.get('fid'),
                    'num_parcelle': t.get('num_parcelle', ''),
                    'geometry': t.get('geometry'),
                    'score_final': round(score, 4),
                    'distances': t['distances'],
                    'zone_localisation': zone_terrain,
                    'altitude': t['altitude'],
                    'contributions': contributions,
                })

            resultats.sort(key=lambda x: x['score_final'], reverse=True)
            for i, r in enumerate(resultats):
                r['rang'] = i + 1

            # 6. Sauvegarder les préférences pour le projet
            try:
                from .models import PonderationPreference
                PonderationPreference.objects.update_or_create(
                    projet=projet,
                    defaults={
                        'matrice_ahp': matrice_ahp,
                        'ordre_categories': ordre_categories,
                        'ordres_roc': ordres_roc,
                        'selections_criteres': selections,
                        'preferences_localisation': prefs_loc,
                        'preferences_altitude': plages_altitude,
                        'seuil': seuil,
                    },
                )
            except Exception:
                pass

            # 6bis. Sauvegarder l'analyse pondérée dans l'historique (modèle Analyse)
            try:
                from .models import Analyse, ResultatAnalyse
                analyse = Analyse.objects.create(
                    projet=projet,
                    filtres={
                        'matrice_ahp': matrice_ahp,
                        'ordre_categories': ordre_categories,
                        'ordres_roc': ordres_roc,
                        'selections_criteres': selections,
                        'preferences_localisation': prefs_loc,
                        'preferences_altitude': plages_altitude,
                        'seuil': seuil,
                    },
                    poids_amc=1.0,
                    poids_rentabilite=0.0,
                    nombre_parcelles=len(resultats),
                    statut='complete',
                )
                ResultatAnalyse.objects.bulk_create([
                    ResultatAnalyse(
                        analyse=analyse,
                        id_parcelle=str(r.get('id')) if r.get('id') is not None else r.get('num_parcelle', ''),
                        reference_cadastrale=r.get('reference_cadastrale', '') or '',
                        nom=r.get('nom', '') or '',
                        superficie=r.get('superficie'),
                        lat=r.get('lat'),
                        lng=r.get('lng'),
                        score_amc=r.get('score_final'),
                        score_final=r.get('score_final'),
                        rang=r.get('rang'),
                        criteres_conformite=r.get('contributions'),
                    )
                    for r in resultats
                ])
            except Exception:
                pass

            return Response({
                'total': len(resultats),
                'resultats': resultats,
                'poids_globaux': poids_globaux,
                'poids_ahp': poids_ahp,
                'CR': resultat_ahp['CR'],
                'coherent': resultat_ahp['coherent'],
            })

        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'detail': f'Erreur lors de l\'analyse pondérée : {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PonderationPreferenceView(APIView):
    """Récupère/sauvegarde les préférences de pondération d'un projet."""

    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, projet_pk: int):
        try:
            Projet.objects.get(pk=projet_pk)
        except Projet.DoesNotExist:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        prefs = PonderationPreference.objects.filter(projet_id=projet_pk).first()
        if not prefs:
            return Response(None)

        return Response(PonderationPreferenceSerializer(prefs).data)


# ---------------------------------------------------------------------------
# Couche features CRUD (gestion des lignes par l'investisseur)
# ---------------------------------------------------------------------------

def _get_attributs(couche):
    return [a['nom'] for a in couche.attributs if a['nom'].lower() != 'fid'] if couche.attributs else []


def _get_attributs_all(couche):
    return [a['nom'] for a in couche.attributs] if couche.attributs else []


@api_view(['GET'])
def couche_features_list(request, pk):
    try:
        couche = Couche.objects.get(pk=pk)
    except Couche.DoesNotExist:
        return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)

    table = couche.table_liee
    if not table:
        return Response({'count': 0, 'results': []})

    attributs = _get_attributs_all(couche)
    search = request.GET.get('search', '').strip()
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 20))

    col_sql = ', '.join(f'"{c}"' for c in attributs) if attributs else ''
    select = f'id, geometry, {col_sql}' if col_sql else 'id, geometry'

    where = ''
    params = []
    if search and attributs:
        conditions = []
        for a in attributs:
            conditions.append(f'"{a}"::text ILIKE %s')
            params.append(f'%{search}%')
        where = 'WHERE ' + ' OR '.join(conditions)

    count_sql = f'SELECT COUNT(*) FROM "{table}" {where}'
    sql = f'SELECT {select} FROM "{table}" {where} ORDER BY id LIMIT %s OFFSET %s'
    params_count = list(params)
    params_page = params + [page_size, (page - 1) * page_size]

    features = []
    total = 0
    try:
        with connection.cursor() as cur:
            cur.execute(count_sql, params_count)
            total = cur.fetchone()[0]
            cur.execute(sql, params_page)
            cols = [desc[0] for desc in cur.description]
            for row in cur.fetchall():
                props = {}
                for i, col in enumerate(cols):
                    if col in ('id', 'geometry'):
                        continue
                    props[col] = row[i]
                geometry = row[cols.index('geometry')]
                if isinstance(geometry, str):
                    try:
                        geometry = json.loads(geometry)
                    except ValueError:
                        geometry = None
                features.append({
                    'id': row[cols.index('id')],
                    'geometry': geometry,
                    'properties': props,
                })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'count': total, 'results': features})


@api_view(['POST'])
def couche_features_create(request, pk):
    try:
        couche = Couche.objects.get(pk=pk)
    except Couche.DoesNotExist:
        return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)

    table = couche.table_liee
    if not table:
        return Response({'error': 'Pas de table associée'}, status=status.HTTP_400_BAD_REQUEST)

    attributs = _get_attributs(couche)
    data = request.data
    geometry = data.get('geometry')
    props = data.get('properties', {})

    cols = ['geometry']
    vals = [json.dumps(geometry) if isinstance(geometry, dict) else None]
    for a in attributs:
        cols.append(f'"{a}"')
        vals.append(props.get(a))

    placeholders = ', '.join(['%s'] * len(cols))
    cols_sql = ', '.join(cols)
    sql = f'INSERT INTO "{table}" ({cols_sql}) VALUES ({placeholders}) RETURNING id'

    try:
        with connection.cursor() as cur:
            cur.execute(sql, vals)
            new_id = cur.fetchone()[0]
        return Response({'id': new_id, 'message': 'Ligne créée'}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT'])
def couche_features_update(request, pk, feature_id):
    try:
        couche = Couche.objects.get(pk=pk)
    except Couche.DoesNotExist:
        return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)

    table = couche.table_liee
    if not table:
        return Response({'error': 'Pas de table associée'}, status=status.HTTP_400_BAD_REQUEST)

    attributs = _get_attributs(couche)
    data = request.data
    geometry = data.get('geometry')
    props = data.get('properties', {})

    set_parts = []
    vals = []
    if geometry is not None:
        set_parts.append('geometry = %s')
        vals.append(json.dumps(geometry) if isinstance(geometry, dict) else None)
    for a in attributs:
        if a in props:
            set_parts.append(f'"{a}" = %s')
            vals.append(props.get(a))

    if not set_parts:
        return Response({'error': 'Aucun champ à modifier'}, status=status.HTTP_400_BAD_REQUEST)

    vals.append(feature_id)
    sql = f'UPDATE "{table}" SET {", ".join(set_parts)} WHERE id = %s'

    try:
        with connection.cursor() as cur:
            cur.execute(sql, vals)
            if cur.rowcount == 0:
                return Response({'error': 'Ligne introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'message': 'Ligne mise à jour'})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def couche_features_delete(request, pk, feature_id):
    try:
        couche = Couche.objects.get(pk=pk)
    except Couche.DoesNotExist:
        return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)

    table = couche.table_liee
    if not table:
        return Response({'error': 'Pas de table associée'}, status=status.HTTP_400_BAD_REQUEST)

    sql = f'DELETE FROM "{table}" WHERE id = %s'
    try:
        with connection.cursor() as cur:
            cur.execute(sql, [feature_id])
            if cur.rowcount == 0:
                return Response({'error': 'Ligne introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'message': 'Ligne supprimée'})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def couche_features_duplicate(request, pk, feature_id):
    try:
        couche = Couche.objects.get(pk=pk)
    except Couche.DoesNotExist:
        return Response({'error': 'Couche introuvable'}, status=status.HTTP_404_NOT_FOUND)

    table = couche.table_liee
    if not table:
        return Response({'error': 'Pas de table associée'}, status=status.HTTP_400_BAD_REQUEST)

    attributs_all = _get_attributs_all(couche)
    attributs_write = _get_attributs(couche)
    col_sql = ', '.join(f'"{a}"' for a in attributs_all) if attributs_all else ''
    select = f'id, geometry, {col_sql}' if col_sql else 'id, geometry'
    sql_fetch = f'SELECT {select} FROM "{table}" WHERE id = %s'

    try:
        with connection.cursor() as cur:
            cur.execute(sql_fetch, [feature_id])
            row = cur.fetchone()
            if not row:
                return Response({'error': 'Ligne introuvable'}, status=status.HTTP_404_NOT_FOUND)
            cols = [desc[0] for desc in cur.description]
            geom = row[cols.index('geometry')]
            geom_val = json.dumps(geom) if isinstance(geom, str) else geom

            insert_cols = ['geometry']
            insert_vals = [geom_val]
            for a in attributs_write:
                insert_cols.append(f'"{a}"')
                insert_vals.append(row[cols.index(a)] if a in cols else None)

            placeholders = ', '.join(['%s'] * len(insert_cols))
            cols_sql_ins = ', '.join(insert_cols)
            cur.execute(f'INSERT INTO "{table}" ({cols_sql_ins}) VALUES ({placeholders}) RETURNING id', insert_vals)
            new_id = cur.fetchone()[0]
        return Response({'id': new_id, 'message': 'Ligne dupliquée'}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

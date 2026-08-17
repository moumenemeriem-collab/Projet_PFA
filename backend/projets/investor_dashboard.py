"""API endpoint pour le tableau de bord investisseur.

Fournit les statistiques personnalisées de l'utilisateur connecté :
- Nombre de projets, terrains, analyses
- Scores moyens et meilleurs terrains
- Dernières analyses
- Résumé par projet
"""

from django.db.models import Avg, Count, Max
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authentication import JWTOptionalAuthentication

from .models import Analyse, Projet, ResultatAnalyse, Terrain


class InvestorDashboardView(APIView):
    authentication_classes = [JWTOptionalAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        projets = Projet.objects.filter(investisseur=user)

        nb_projets = projets.count()
        terrains = Terrain.objects.filter(projet__investisseur=user)
        nb_terrains = terrains.count()
        analyses = Analyse.objects.filter(projet__investisseur=user)
        nb_analyses = analyses.count()

        score_moyen = (
            terrains.aggregate(moy=Avg('score'))['moy']
        )

        best_terrains = list(
            terrains.order_by('-score')[:5].values(
                'id', 'nom', 'superficie', 'lat', 'lng',
                'score', 'accessibilite', 'positionnement', 'topographie',
                'projet__nom', 'projet__id',
            )
        )
        for t in best_terrains:
            t['projet_nom'] = t.pop('projet__nom')
            t['projet_id'] = t.pop('projet__id')
            t['score'] = float(t['score']) if t['score'] else 0
            t['superficie'] = float(t['superficie']) if t['superficie'] else 0
            t['lat'] = float(t['lat']) if t['lat'] else None
            t['lng'] = float(t['lng']) if t['lng'] else None

        recent_analyses = list(
            analyses.order_by('-date_creation')[:5].values(
                'id', 'date_creation', 'nombre_parcelles', 'statut',
                'projet__nom', 'projet__id',
            )
        )
        for a in recent_analyses:
            a['projet_nom'] = a.pop('projet__nom')
            a['projet_id'] = a.pop('projet__id')
            a['date_creation'] = a['date_creation'].isoformat() if a['date_creation'] else None

        projets_resume = []
        for p in projets:
            p_terrains = Terrain.objects.filter(projet=p)
            p_analyses = Analyse.objects.filter(projet=p)
            p_score = p_terrains.aggregate(moy=Avg('score'))['moy']
            projets_resume.append({
                'id': p.id,
                'nom': p.nom,
                'type_nom': p.id_type.nom if p.id_type else '',
                'surface_souhaitee': float(p.surface_souhaitee) if p.surface_souhaitee else 0,
                'budget_total': float(p.budget_total) if p.budget_total else 0,
                'date_creation': p.date_creation.isoformat() if p.date_creation else None,
                'nb_terrains': p_terrains.count(),
                'nb_analyses': p_analyses.count(),
                'score_moyen': round(float(p_score), 2) if p_score else None,
                'derniere_analyse': (
                    p_analyses.order_by('-date_creation').values_list('date_creation', flat=True).first()
                ),
            })
        for p in projets_resume:
            if p['derniere_analyse']:
                p['derniere_analyse'] = p['derniere_analyse'].isoformat()

        raw_top = list(
            ResultatAnalyse.objects.filter(
                analyse__projet__investisseur=user,
                score_final__isnull=False,
            )
            .order_by('-score_final')
            .values(
                'id', 'reference_cadastrale', 'nom', 'superficie',
                'score_final', 'score_amc', 'score_accessibilite',
                'score_positionnement', 'score_topographie',
                'rang', 'analyse__projet__nom', 'analyse__projet__id',
            )
        )
        seen_refs: set[str] = set()
        top_resultats = []
        for r in raw_top:
            ref = r['reference_cadastrale']
            if ref in seen_refs:
                continue
            seen_refs.add(ref)
            r['projet_nom'] = r.pop('analyse__projet__nom')
            r['projet_id'] = r.pop('analyse__projet__id')
            r['superficie'] = float(r['superficie']) if r['superficie'] else None
            top_resultats.append(r)
            if len(top_resultats) >= 5:
                break

        return Response({
            'resume': {
                'nb_projets': nb_projets,
                'nb_terrains': nb_terrains,
                'nb_analyses': nb_analyses,
                'score_moyen': round(float(score_moyen), 2) if score_moyen else None,
            },
            'projets': projets_resume,
            'meilleurs_terrains': best_terrains,
            'dernieres_analyses': recent_analyses,
            'top_resultats': top_resultats,
        })

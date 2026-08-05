"""Vues de statistiques et tableau de bord administrateur."""

import glob
import json
import os
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, F
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Utilisateur
from accounts.permissions import IsAdmin
from messagerie.models import Message, Notification, Reponse
from projets.models import Analyse, Couche, Projet

from .models import Activite

MONTHS = 12


def _mois_serie():
    """Retourne les derniers mois (format YYYY-MM) par ordre chronologique."""
    from dateutil.relativedelta import relativedelta

    today = timezone.now().date().replace(day=1)
    mois = []
    for i in range(MONTHS - 1, -1, -1):
        d = today - relativedelta(months=i)
        mois.append(d.strftime('%Y-%m'))
    return mois


def _aggregate_par_mois(queryset, champ='date_creation'):
    rows = {}
    for r in queryset.annotate(mois=TruncMonth(champ)).values('mois').annotate(total=Count('id')):
        if r['mois'] is not None:
            rows[r['mois'].strftime('%Y-%m')] = r['total']
    serie = []
    for m in _mois_serie():
        serie.append({'mois': m, 'total': rows.get(m, 0)})
    return serie


def _nb_parcelles_cadastre():
    """Compte les parcelles de la couche cadastre (GeoJSON importé).

    Les entités du cadastre ne sont pas en lignes de base : elles vivent dans
    le fichier de la couche. On lit le dernier GeoJSON importé pour la couche
    'cadastre'.
    """
    chemins = []
    couche = Couche.objects.filter(nom='cadastre').first()
    if couche and couche.fichier and couche.fichier.name:
        try:
            chemins.append(couche.fichier.path)
        except Exception:
            chemins = []
    if not chemins:
        dossier = os.path.join(settings.MEDIA_ROOT, 'couches', 'cadastre')
        chemins = sorted(glob.glob(os.path.join(dossier, '*.geojson')))
    if not chemins:
        return 0
    try:
        with open(chemins[-1], encoding='utf-8') as f:
            data = json.load(f)
        return len(data.get('features', []))
    except Exception:
        return 0


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        today = timezone.now().date()
        debut_mois = today.replace(day=1)
        il_y_a_30j = today - timedelta(days=30)
        il_y_a_7j = today - timedelta(days=7)

        utilisateurs = Utilisateur.objects.all()
        activites = Activite.objects.all()

        # --- Utilisateurs ---
        # Actifs : connexion/activité récente (a au moins une activité, un projet
        # ou un message) ; nouveaux : créés il y a 30 jours ou moins ;
        # désactivés : aucun projet, message ni activité enregistrés.
        actifs_ids = set(activites.values_list('utilisateur_id', flat=True))
        actifs_ids |= set(Projet.objects.values_list('investisseur_id', flat=True))
        actifs_ids |= set(Message.objects.values_list('expediteur_id', flat=True))
        actifs_ids |= set(Reponse.objects.values_list('auteur_id', flat=True))
        actifs_ids.discard(None)

        nb_total = utilisateurs.count()
        nb_actifs = len([u for u in actifs_ids if u is not None])
        nb_nouveaux = utilisateurs.filter(date_creation__gte=il_y_a_30j).count()
        nb_desactives = nb_total - nb_actifs

        # --- Couches ---
        couches = Couche.objects.all()
        nb_couches_total = couches.count()
        nb_couches_ajoutees = couches.filter(date_creation__gte=il_y_a_30j).count()
        nb_couches_modifiees = couches.filter(
            date_mise_a_jour__gte=il_y_a_30j,
            date_mise_a_jour__gt=F('date_creation'),
        ).count()
        nb_couches_supprimees = activites.filter(entite='couche', action='suppression').count()

        # --- Analyses ---
        analyses = Analyse.objects.all()
        nb_analyses = analyses.count()
        nb_analyses_semaine = analyses.filter(date_creation__gte=il_y_a_7j).count()

        # --- Actifs aujourd'hui (au moins une activité enregistrée ce jour) ---
        nb_actifs_aujourdhui = activites.filter(
            date_creation__date=today,
        ).values('utilisateur_id').distinct().count()

        # --- Projets / parcelles cadastrales / messagerie ---
        nb_projets = Projet.objects.count()
        nb_parcelles_cadastrales = _nb_parcelles_cadastre()
        nb_messages = Message.objects.count()
        nb_notifications_non_lues = Notification.objects.filter(lu=False).count()

        # --- Séries mensuelles ---
        serie_utilisateurs = _aggregate_par_mois(utilisateurs)
        serie_couches = _aggregate_par_mois(couches)
        serie_analyses = _aggregate_par_mois(analyses)
        serie_activite = _aggregate_par_mois(activites)

        # --- Historique récent ---
        historique = [
            {
                'id': a.id,
                'action': a.action,
                'entite': a.entite,
                'description': a.description,
                'utilisateur': (
                    f'{a.utilisateur.prenom} {a.utilisateur.nom}'
                    if a.utilisateur else 'Système'
                ),
                'date': a.date_creation,
            }
            for a in activites[:10]
        ]

        # --- Répartition des utilisateurs par rôle ---
        par_role = {}
        for r in utilisateurs.values('role').annotate(total=Count('id')):
            par_role[r['role']] = r['total']

        # --- Activité par entité ---
        par_entite = {}
        for r in activites.values('entite').annotate(total=Count('id')):
            par_entite[r['entite']] = r['total']

        return Response({
            'date': timezone.now().isoformat(),
            'utilisateurs': {
                'total': nb_total,
                'actifs': nb_actifs,
                'actifs_aujourdhui': nb_actifs_aujourdhui,
                'nouveaux': nb_nouveaux,
                'desactives': max(nb_desactives, 0),
                'par_role': par_role,
                'evolution': serie_utilisateurs,
            },
            'couches': {
                'total': nb_couches_total,
                'ajoutees': nb_couches_ajoutees,
                'modifiees': nb_couches_modifiees,
                'supprimees': nb_couches_supprimees,
                'evolution': serie_couches,
            },
            'analyses': {
                'total': nb_analyses,
                'semaine': nb_analyses_semaine,
                'evolution': serie_analyses,
            },
            'activite': {
                'total': activites.count(),
                'evolution': serie_activite,
                'historique': historique,
                'projets': nb_projets,
                'parcelles_cadastrales': nb_parcelles_cadastrales,
                'messages': nb_messages,
                'notifications_non_lues': nb_notifications_non_lues,
                'par_entite': par_entite,
            },
        })

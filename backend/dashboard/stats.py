"""Calcul et mise à jour des statistiques du tableau de bord administrateur."""

import glob
import json
import os
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, F
from django.db.models.functions import TruncMonth
from django.utils import timezone

from accounts.models import Utilisateur
from messagerie.models import Message, Notification, Reponse
from projets.models import Analyse, Couche, Projet

from .models import Activite, DashboardStats

MONTHS = 12
STALE_SECONDS = 300  # 5 minutes


def _mois_serie():
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
    return [{'mois': m, 'total': rows.get(m, 0)} for m in _mois_serie()]


def _nb_parcelles_cadastre():
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


def _compute_actifs_ids():
    """Utilisateurs considérés actifs (activité, contenu ou connexion récente)."""
    il_y_a_30j = timezone.now() - timedelta(days=30)
    actifs_ids = set(Activite.objects.values_list('utilisateur_id', flat=True))
    actifs_ids |= set(Projet.objects.values_list('investisseur_id', flat=True))
    actifs_ids |= set(Message.objects.values_list('expediteur_id', flat=True))
    actifs_ids |= set(Reponse.objects.values_list('auteur_id', flat=True))
    actifs_ids |= set(
        Utilisateur.objects.filter(derniere_connexion__gte=il_y_a_30j).values_list('id', flat=True)
    )
    actifs_ids.discard(None)
    return actifs_ids


def refresh_dashboard_stats():
    """Recalcule toutes les statistiques et les enregistre (singleton pk=1)."""
    now = timezone.now()
    today = now.date()
    il_y_a_30j = now - timedelta(days=30)
    il_y_a_7j = now - timedelta(days=7)

    utilisateurs = Utilisateur.objects.all()
    activites = Activite.objects.all()
    couches = Couche.objects.all()
    analyses = Analyse.objects.all()

    actifs_ids = _compute_actifs_ids()
    nb_total = utilisateurs.count()
    nb_actifs = len(actifs_ids)
    nb_nouveaux = utilisateurs.filter(date_creation__gte=il_y_a_30j).count()

    par_role = {}
    for r in utilisateurs.values('role').annotate(total=Count('id')):
        par_role[r['role']] = r['total']

    par_entite = {}
    for r in activites.values('entite').annotate(total=Count('id')):
        par_entite[r['entite']] = r['total']

    defaults = {
        'nb_utilisateurs': nb_total,
        'nb_utilisateurs_actifs': nb_actifs,
        'nb_utilisateurs_actifs_aujourdhui': activites.filter(
            date_creation__date=today,
        ).values('utilisateur_id').distinct().count(),
        'nb_utilisateurs_nouveaux': nb_nouveaux,
        'nb_utilisateurs_desactives': max(nb_total - nb_actifs, 0),
        'par_role': par_role,
        'evolution_utilisateurs': _aggregate_par_mois(utilisateurs),
        'nb_couches_total': couches.count(),
        'nb_couches_ajoutees': couches.filter(date_creation__gte=il_y_a_30j).count(),
        'nb_couches_modifiees': couches.filter(
            date_mise_a_jour__gte=il_y_a_30j,
            date_mise_a_jour__gt=F('date_creation'),
        ).count(),
        'nb_couches_supprimees': activites.filter(entite='couche', action='suppression').count(),
        'evolution_couches': _aggregate_par_mois(couches),
        'nb_analyses': analyses.count(),
        'nb_analyses_semaine': analyses.filter(date_creation__gte=il_y_a_7j).count(),
        'evolution_analyses': _aggregate_par_mois(analyses),
        'nb_projets': Projet.objects.count(),
        'nb_messages': Message.objects.count(),
        'nb_notifications_non_lues': Notification.objects.filter(lu=False).count(),
        'nb_parcelles_cadastre': _nb_parcelles_cadastre(),
        'nb_activite_total': activites.count(),
        'evolution_activite': _aggregate_par_mois(activites),
        'par_entite': par_entite,
    }

    stats, _ = DashboardStats.objects.update_or_create(pk=1, defaults=defaults)
    return stats


def get_dashboard_stats(force=False):
    """Retourne les stats en cache ; recalcule si absentes ou périmées."""
    stats = DashboardStats.objects.filter(pk=1).first()
    if stats is None or force:
        return refresh_dashboard_stats()
    age = (timezone.now() - stats.date_mise_a_jour).total_seconds()
    if age > STALE_SECONDS:
        return refresh_dashboard_stats()
    return stats


def _ensure_stats():
    stats = DashboardStats.objects.filter(pk=1).first()
    if stats is None:
        return refresh_dashboard_stats()
    return stats


def bump_counter(**deltas):
    """Incrémente des compteurs simples sans recalcul complet."""
    if not deltas:
        return
    stats = _ensure_stats()
    updates = {}
    for field, delta in deltas.items():
        if delta and hasattr(stats, field):
            updates[field] = F(field) + delta
    if updates:
        DashboardStats.objects.filter(pk=1).update(**updates)


def on_activity_logged(activite):
    """Mise à jour légère après une entrée de journal."""
    if activite is None:
        return
    try:
        stats = _ensure_stats()
        par_entite = dict(stats.par_entite or {})
        par_entite[activite.entite] = par_entite.get(activite.entite, 0) + 1
        today = timezone.now().date()
        nb_aujourdhui = Activite.objects.filter(
            date_creation__date=today,
        ).values('utilisateur_id').distinct().count()
        DashboardStats.objects.filter(pk=1).update(
            nb_activite_total=F('nb_activite_total') + 1,
            par_entite=par_entite,
            nb_utilisateurs_actifs_aujourdhui=nb_aujourdhui,
        )
    except Exception:
        pass


def build_api_response(stats):
    """Construit la réponse JSON à partir des stats pré-calculées."""
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
        for a in Activite.objects.select_related('utilisateur')[:10]
    ]

    return {
        'date': timezone.now().isoformat(),
        'utilisateurs': {
            'total': stats.nb_utilisateurs,
            'actifs': stats.nb_utilisateurs_actifs,
            'actifs_aujourdhui': stats.nb_utilisateurs_actifs_aujourdhui,
            'nouveaux': stats.nb_utilisateurs_nouveaux,
            'desactives': stats.nb_utilisateurs_desactives,
            'par_role': stats.par_role,
            'evolution': stats.evolution_utilisateurs,
        },
        'couches': {
            'total': stats.nb_couches_total,
            'ajoutees': stats.nb_couches_ajoutees,
            'modifiees': stats.nb_couches_modifiees,
            'supprimees': stats.nb_couches_supprimees,
            'evolution': stats.evolution_couches,
        },
        'analyses': {
            'total': stats.nb_analyses,
            'semaine': stats.nb_analyses_semaine,
            'evolution': stats.evolution_analyses,
        },
        'activite': {
            'total': stats.nb_activite_total,
            'evolution': stats.evolution_activite,
            'historique': historique,
            'projets': stats.nb_projets,
            'parcelles_cadastrales': stats.nb_parcelles_cadastre,
            'messages': stats.nb_messages,
            'notifications_non_lues': stats.nb_notifications_non_lues,
            'par_entite': stats.par_entite,
        },
    }

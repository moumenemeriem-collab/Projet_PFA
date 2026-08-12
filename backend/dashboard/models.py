"""Journal d'activité de la plateforme WebSIG.

Enregistre chaque action significative (ajout, modification, suppression)
réalisée par un utilisateur, pour alimenter le tableau de bord administrateur.
"""

from django.db import models

from accounts.models import Utilisateur


class Activite(models.Model):
    ACTION_CHOICES = [
        ('ajout', 'Ajout'),
        ('modification', 'Modification'),
        ('suppression', 'Suppression'),
    ]

    ENTITE_CHOICES = [
        ('utilisateur', 'Utilisateur'),
        ('projet', 'Projet'),
        ('terrain', 'Terrain'),
        ('analyse', 'Analyse'),
        ('couche', 'Couche'),
        ('message', 'Message'),
        ('reponse', 'Réponse'),
    ]

    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activites',
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    entite = models.CharField(max_length=30, choices=ENTITE_CHOICES)
    description = models.CharField(max_length=500)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'activite'
        ordering = ['-date_creation']

    def __str__(self) -> str:
        auteur = self.utilisateur
        nom = f'{auteur.prenom} {auteur.nom}' if auteur else 'Système'
        return f'[{self.action}] {self.entite} par {nom}'

    @staticmethod
    def log(utilisateur, action, entite, description) -> 'Activite':
        """Crée une entrée de journal de manière sécurisée."""
        try:
            activite = Activite.objects.create(
                utilisateur=utilisateur,
                action=action,
                entite=entite,
                description=description[:500],
            )
            from .stats import on_activity_logged
            on_activity_logged(activite)
            return activite
        except Exception:
            # Le journal ne doit jamais faire échouer une opération métier.
            return None


class DashboardStats(models.Model):
    """Statistiques pré-calculées du tableau de bord (singleton pk=1)."""

    nb_utilisateurs = models.IntegerField(default=0)
    nb_utilisateurs_actifs = models.IntegerField(default=0)
    nb_utilisateurs_actifs_aujourdhui = models.IntegerField(default=0)
    nb_utilisateurs_nouveaux = models.IntegerField(default=0)
    nb_utilisateurs_desactives = models.IntegerField(default=0)
    par_role = models.JSONField(default=dict)

    nb_couches_total = models.IntegerField(default=0)
    nb_couches_ajoutees = models.IntegerField(default=0)
    nb_couches_modifiees = models.IntegerField(default=0)
    nb_couches_supprimees = models.IntegerField(default=0)
    evolution_couches = models.JSONField(default=list)

    nb_analyses = models.IntegerField(default=0)
    nb_analyses_semaine = models.IntegerField(default=0)
    evolution_analyses = models.JSONField(default=list)

    nb_projets = models.IntegerField(default=0)
    nb_messages = models.IntegerField(default=0)
    nb_notifications_non_lues = models.IntegerField(default=0)
    nb_parcelles_cadastre = models.IntegerField(default=0)

    nb_activite_total = models.IntegerField(default=0)
    evolution_activite = models.JSONField(default=list)
    par_entite = models.JSONField(default=dict)
    evolution_utilisateurs = models.JSONField(default=list)

    date_mise_a_jour = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'dashboard_stats'
        verbose_name = 'Statistiques tableau de bord'
        verbose_name_plural = 'Statistiques tableau de bord'

    def __str__(self) -> str:
        return f'Stats dashboard (maj {self.date_mise_a_jour:%Y-%m-%d %H:%M})'

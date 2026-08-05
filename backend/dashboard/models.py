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
            return Activite.objects.create(
                utilisateur=utilisateur,
                action=action,
                entite=entite,
                description=description[:500],
            )
        except Exception:
            # Le journal ne doit jamais faire échouer une opération métier.
            return None

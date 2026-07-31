from django.db import models

from accounts.models import Utilisateur


class Message(models.Model):
    expediteur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='messages_envoyes',
    )
    sujet = models.CharField(max_length=200)
    contenu = models.TextField()
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    est_lu = models.BooleanField(default=False)

    class Meta:
        db_table = 'message'
        ordering = ['-date_creation']

    def __str__(self) -> str:
        return f'[{self.sujet}] par {self.expediteur}'


class Reponse(models.Model):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='reponses',
    )
    auteur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='reponses_envoyees',
    )
    contenu = models.TextField()
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reponse'
        ordering = ['date_creation']

    def __str__(self) -> str:
        return f'Reponse de {self.auteur} a {self.message}'


class Notification(models.Model):
    destinataire = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    titre = models.CharField(max_length=200)
    contenu = models.TextField()
    type_notif = models.CharField(
        max_length=50,
        choices=[
            ('nouveau_message', 'Nouveau message'),
            ('nouvelle_reponse', 'Nouvelle réponse'),
            ('message_modifie', 'Message modifié'),
            ('message_supprime', 'Message supprimé'),
            ('reponse_modifiee', 'Réponse modifiée'),
            ('reponse_supprimee', 'Réponse supprimée'),
        ],
    )
    message_id = models.IntegerField(null=True, blank=True)
    lu = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification'
        ordering = ['-date_creation']

    def __str__(self) -> str:
        return f'[{self.type_notif}] pour {self.destinataire}: {self.titre}'

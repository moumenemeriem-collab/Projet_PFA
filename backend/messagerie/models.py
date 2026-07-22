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

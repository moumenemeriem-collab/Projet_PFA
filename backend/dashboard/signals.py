"""Signaux pour mettre à jour les compteurs du tableau de bord."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from accounts.models import Utilisateur
from messagerie.models import Message, Notification
from projets.models import Analyse, Couche, Projet

from .stats import bump_counter


@receiver(post_save, sender=Utilisateur)
def utilisateur_saved(sender, instance, created, **kwargs):
    if created:
        bump_counter(nb_utilisateurs=1, nb_utilisateurs_nouveaux=1)


@receiver(post_delete, sender=Utilisateur)
def utilisateur_deleted(sender, instance, **kwargs):
    bump_counter(nb_utilisateurs=-1)


@receiver(post_save, sender=Projet)
def projet_saved(sender, instance, created, **kwargs):
    if created:
        bump_counter(nb_projets=1)


@receiver(post_delete, sender=Projet)
def projet_deleted(sender, instance, **kwargs):
    bump_counter(nb_projets=-1)


@receiver(post_save, sender=Analyse)
def analyse_saved(sender, instance, created, **kwargs):
    if created:
        bump_counter(nb_analyses=1, nb_analyses_semaine=1)


@receiver(post_save, sender=Couche)
def couche_saved(sender, instance, created, **kwargs):
    if created:
        bump_counter(nb_couches_total=1, nb_couches_ajoutees=1)


@receiver(post_delete, sender=Couche)
def couche_deleted(sender, instance, **kwargs):
    bump_counter(nb_couches_total=-1)


@receiver(post_save, sender=Message)
def message_saved(sender, instance, created, **kwargs):
    if created:
        bump_counter(nb_messages=1)


@receiver(post_delete, sender=Message)
def message_deleted(sender, instance, **kwargs):
    bump_counter(nb_messages=-1)


@receiver(post_save, sender=Notification)
def notification_saved(sender, instance, created, **kwargs):
    if created and not instance.lu:
        bump_counter(nb_notifications_non_lues=1)

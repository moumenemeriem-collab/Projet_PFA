"""Rafraîchit les statistiques pré-calculées du tableau de bord."""

from django.core.management.base import BaseCommand

from dashboard.stats import refresh_dashboard_stats


class Command(BaseCommand):
    help = 'Recalcule et enregistre les statistiques du tableau de bord administrateur.'

    def handle(self, *args, **options):
        stats = refresh_dashboard_stats()
        self.stdout.write(
            self.style.SUCCESS(
                f'Statistiques mises à jour : {stats.nb_utilisateurs} utilisateurs, '
                f'{stats.nb_projets} projets, {stats.nb_analyses} analyses.'
            )
        )

from django.contrib import admin

from .models import Activite, DashboardStats


@admin.register(Activite)
class ActiviteAdmin(admin.ModelAdmin):
    list_display = ['date_creation', 'action', 'entite', 'utilisateur', 'description']
    list_filter = ['action', 'entite', 'date_creation']
    search_fields = ['description', 'utilisateur__prenom', 'utilisateur__nom', 'utilisateur__email']
    readonly_fields = ['date_creation']
    ordering = ['-date_creation']


@admin.register(DashboardStats)
class DashboardStatsAdmin(admin.ModelAdmin):
    list_display = ['date_mise_a_jour', 'nb_utilisateurs', 'nb_projets', 'nb_analyses', 'nb_couches_total']
    readonly_fields = [
        'nb_utilisateurs', 'nb_utilisateurs_actifs', 'nb_utilisateurs_actifs_aujourdhui',
        'nb_utilisateurs_nouveaux', 'nb_utilisateurs_desactives', 'par_role',
        'nb_couches_total', 'nb_couches_ajoutees', 'nb_couches_modifiees', 'nb_couches_supprimees',
        'evolution_couches', 'nb_analyses', 'nb_analyses_semaine', 'evolution_analyses',
        'nb_projets', 'nb_messages', 'nb_notifications_non_lues', 'nb_parcelles_cadastre',
        'nb_activite_total', 'evolution_activite', 'par_entite', 'evolution_utilisateurs',
        'date_mise_a_jour',
    ]

    def has_add_permission(self, request):
        return not DashboardStats.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

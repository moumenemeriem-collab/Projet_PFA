from django.contrib import admin

from .models import Activite


@admin.register(Activite)
class ActiviteAdmin(admin.ModelAdmin):
    list_display = ['date_creation', 'action', 'entite', 'utilisateur', 'description']
    list_filter = ['action', 'entite', 'date_creation']
    search_fields = ['description', 'utilisateur__prenom', 'utilisateur__nom', 'utilisateur__email']
    readonly_fields = ['date_creation']
    ordering = ['-date_creation']

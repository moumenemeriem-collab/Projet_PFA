from django.contrib import admin

from .models import Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(admin.ModelAdmin):
    list_display = ('email', 'prenom', 'nom', 'role', 'date_creation')
    list_filter = ('role',)
    search_fields = ('email', 'prenom', 'nom')
    readonly_fields = ('date_creation', 'mot_de_passe_hash')

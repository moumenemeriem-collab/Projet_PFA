from django.contrib import admin

from .models import Couche, ImportCouche, ParametreAffectation, Projet, Terrain, TypeProjet


@admin.register(TypeProjet)
class TypeProjetAdmin(admin.ModelAdmin):
    list_display = ('nom', 'actif')
    list_filter = ('actif',)
    search_fields = ('nom',)


@admin.register(Projet)
class ProjetAdmin(admin.ModelAdmin):
    list_display = ('nom', 'type_projet', 'investisseur', 'budget_total', 'date_creation')
    list_filter = ('id_type',)
    search_fields = ('nom', 'description')

    def type_projet(self, obj):
        return obj.id_type.nom if obj.id_type else '-'
    type_projet.short_description = 'Type'


@admin.register(Terrain)
class TerrainAdmin(admin.ModelAdmin):
    list_display = ('nom', 'projet', 'superficie', 'score', 'date_creation')
    search_fields = ('nom',)


@admin.register(Couche)
class CoucheAdmin(admin.ModelAdmin):
    list_display = ('nom_affichage', 'type_geometrie', 'etat', 'date_mise_a_jour', 'taille_affichage')
    list_filter = ('etat', 'type_geometrie')
    search_fields = ('nom', 'nom_affichage', 'description')


@admin.register(ImportCouche)
class ImportCoucheAdmin(admin.ModelAdmin):
    list_display = ('couche', 'statut', 'nb_enregistrements', 'date_import')
    list_filter = ('statut',)


@admin.register(ParametreAffectation)
class ParametreAffectationAdmin(admin.ModelAdmin):
    list_display = ('code', 'zone', 'categorie', 'type_operation', 'hauteur_max', 'nombre_etages', 'cos', 'cus')
    list_filter = ('zone', 'categorie')
    search_fields = ('code', 'type_operation', 'type_construction', 'conditions')

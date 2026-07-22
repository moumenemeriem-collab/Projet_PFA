from django.contrib import admin

from .models import Message, Reponse


class ReponseInline(admin.TabularInline):
    model = Reponse
    extra = 0
    readonly_fields = ('date_creation',)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sujet', 'expediteur', 'date_creation', 'est_lu')
    list_filter = ('est_lu', 'date_creation')
    search_fields = ('sujet', 'contenu', 'expediteur__email')
    inlines = [ReponseInline]


@admin.register(Reponse)
class ReponseAdmin(admin.ModelAdmin):
    list_display = ('message', 'auteur', 'date_creation')
    list_filter = ('date_creation',)
    search_fields = ('contenu', 'auteur__email')

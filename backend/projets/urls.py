from django.urls import path

from .views import (
    AnalyseTerrainView,
    CoucheDetail,
    CoucheList,
    ProjetDetailView,
    ProjetListView,
    TerrainDetailView,
    TerrainListView,
    TypeProjetListView,
    importer_couche,
    telecharger_couche,
)

urlpatterns = [
    path('types/', TypeProjetListView.as_view(), name='projets-types'),
    path('', ProjetListView.as_view(), name='projets-list'),
    path('<int:pk>/', ProjetDetailView.as_view(), name='projets-detail'),
    path('<int:projet_pk>/terrains/', TerrainListView.as_view(), name='terrains-list'),
    path('<int:projet_pk>/terrains/<int:pk>/', TerrainDetailView.as_view(), name='terrains-detail'),
    path('<int:projet_pk>/analyser/', AnalyseTerrainView.as_view(), name='terrains-analyse'),
    path('couches/', CoucheList.as_view(), name='couche-list'),
    path('couches/<int:pk>/', CoucheDetail.as_view(), name='couche-detail'),
    path('couches/<int:pk>/import/', importer_couche, name='couche-import'),
    path('couches/<int:pk>/download/', telecharger_couche, name='couche-download'),
]

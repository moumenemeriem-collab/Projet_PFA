from django.urls import path

from .investor_dashboard import InvestorDashboardView
from .views import (
    AnalyseDetailView,
    AnalyseListView,
    AnalyseParcellesView,
    AnalyseResultatsView,
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
    path('investor-dashboard/', InvestorDashboardView.as_view(), name='investor-dashboard'),
    path('', ProjetListView.as_view(), name='projets-list'),
    path('<int:pk>/', ProjetDetailView.as_view(), name='projets-detail'),
    path('<int:projet_pk>/terrains/', TerrainListView.as_view(), name='terrains-list'),
    path('<int:projet_pk>/terrains/<int:pk>/', TerrainDetailView.as_view(), name='terrains-detail'),
    path('<int:projet_pk>/analyser/', AnalyseTerrainView.as_view(), name='terrains-analyse'),
    path('<int:projet_pk>/analyser-parcelles/', AnalyseParcellesView.as_view(), name='parcelles-analyse'),
    path('<int:projet_pk>/analyses/', AnalyseListView.as_view(), name='analyses-list'),
    path('<int:projet_pk>/analyses/<int:analyse_pk>/', AnalyseDetailView.as_view(), name='analyses-detail'),
    path('<int:projet_pk>/analyses/<int:analyse_pk>/resultats/', AnalyseResultatsView.as_view(), name='analyses-resultats'),
    path('couches/', CoucheList.as_view(), name='couche-list'),
    path('couches/<int:pk>/', CoucheDetail.as_view(), name='couche-detail'),
    path('couches/<int:pk>/import/', importer_couche, name='couche-import'),
    path('couches/<int:pk>/download/', telecharger_couche, name='couche-download'),
]

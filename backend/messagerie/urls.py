from django.urls import path

from .views import (
    AdminMessageListView,
    MarquerLuView,
    MessageDetailView,
    MessageListView,
    ReponseCreateView,
)

urlpatterns = [
    path('', MessageListView.as_view(), name='messagerie-list'),
    path('<int:pk>/', MessageDetailView.as_view(), name='messagerie-detail'),
    path('<int:message_id>/repondre/', ReponseCreateView.as_view(), name='messagerie-repondre'),
    path('admin/', AdminMessageListView.as_view(), name='messagerie-admin-list'),
    path('admin/<int:pk>/marquer-lu/', MarquerLuView.as_view(), name='messagerie-admin-marquer-lu'),
]

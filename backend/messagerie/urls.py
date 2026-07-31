from django.urls import path

from .views import (
    AdminMessageListView,
    MarquerLuView,
    MessageDetailView,
    MessageListView,
    NotificationDeleteView,
    NotificationListView,
    NotificationMarkReadView,
    ReponseCreateView,
    ReponseDetailView,
)

urlpatterns = [
    path('', MessageListView.as_view(), name='messagerie-list'),
    path('<int:pk>/', MessageDetailView.as_view(), name='messagerie-detail'),
    path('<int:message_id>/repondre/', ReponseCreateView.as_view(), name='messagerie-repondre'),
    path('reponses/<int:pk>/', ReponseDetailView.as_view(), name='messagerie-reponse-detail'),
    path('admin/', AdminMessageListView.as_view(), name='messagerie-admin-list'),
    path('admin/<int:pk>/marquer-lu/', MarquerLuView.as_view(), name='messagerie-admin-marquer-lu'),
    path('notifications/', NotificationListView.as_view(), name='notifications-list'),
    path('notifications/marquer-lues/', NotificationMarkReadView.as_view(), name='notifications-mark-read'),
    path('notifications/<int:pk>/', NotificationDeleteView.as_view(), name='notifications-delete'),
]

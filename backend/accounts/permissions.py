from rest_framework.permissions import BasePermission

from .models import Role


class IsAdmin(BasePermission):
    message = 'Accès réservé aux administrateurs.'

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and getattr(user, 'role', None) == Role.ADMIN)

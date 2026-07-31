from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication as SimpleJWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import Utilisateur


class JWTAuthentication(SimpleJWTAuthentication):
    def get_user(self, validated_token):
        try:
            user_id = validated_token['user_id']
        except KeyError as exc:
            raise InvalidToken('Token invalide : identifiant utilisateur manquant.') from exc

        try:
            return Utilisateur.objects.get(pk=user_id)
        except Utilisateur.DoesNotExist as exc:
            raise AuthenticationFailed('Utilisateur introuvable.') from exc


class JWTOptionalAuthentication(JWTAuthentication):
    def authenticate(self, request: Request):
        try:
            return super().authenticate(request)
        except Exception:
            return None

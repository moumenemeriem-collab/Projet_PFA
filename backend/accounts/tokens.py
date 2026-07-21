from rest_framework_simplejwt.tokens import RefreshToken

from .models import Utilisateur


def get_tokens_for_user(utilisateur: Utilisateur) -> dict[str, str]:
    refresh = RefreshToken()
    refresh['user_id'] = utilisateur.id
    refresh['email'] = utilisateur.email
    refresh['role'] = utilisateur.role

    access = refresh.access_token
    access['user_id'] = utilisateur.id
    access['email'] = utilisateur.email
    access['role'] = utilisateur.role

    return {
        'refresh': str(refresh),
        'access': str(access),
    }

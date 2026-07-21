from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import JWTAuthentication
from .models import Utilisateur
from .permissions import IsAdmin
from .serializers import (
    AdminUserCreateSerializer,
    AdminUserUpdateSerializer,
    AdminUtilisateurSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UtilisateurSerializer,
)
from .tokens import get_tokens_for_user


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()
        tokens = get_tokens_for_user(utilisateur)
        return Response(
            {
                'message': 'Compte créé avec succès.',
                'utilisateur': UtilisateurSerializer(utilisateur).data,
                'tokens': tokens,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].strip().lower()
        password = serializer.validated_data['mot_de_passe']

        try:
            utilisateur = Utilisateur.objects.get(email__iexact=email)
        except Utilisateur.DoesNotExist:
            return Response(
                {'detail': 'Adresse e-mail ou mot de passe incorrect.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not utilisateur.check_password(password):
            return Response(
                {'detail': 'Adresse e-mail ou mot de passe incorrect.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        tokens = get_tokens_for_user(utilisateur)
        return Response(
            {
                'message': 'Connexion réussie.',
                'utilisateur': UtilisateurSerializer(utilisateur).data,
                'tokens': tokens,
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        utilisateur = request.user
        return Response(UtilisateurSerializer(utilisateur).data)

    def patch(self, request):
        utilisateur = request.user
        serializer = ProfileUpdateSerializer(
            utilisateur,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()
        return Response(
            {
                'message': 'Profil mis à jour avec succès.',
                'utilisateur': UtilisateurSerializer(utilisateur).data,
            }
        )


class ChangePasswordView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        utilisateur = request.user
        utilisateur.set_password(serializer.validated_data['nouveau_mot_de_passe'])
        utilisateur.save()
        return Response({'message': 'Mot de passe modifié avec succès.'})


class UserListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        queryset = Utilisateur.objects.all()
        search = request.query_params.get('search', '').strip()
        role = request.query_params.get('role', '').strip()

        if search:
            queryset = queryset.filter(
                Q(prenom__icontains=search)
                | Q(nom__icontains=search)
                | Q(email__icontains=search)
            )

        if role in ('admin', 'investisseur'):
            queryset = queryset.filter(role=role)

        utilisateurs = queryset.order_by('-date_creation')
        return Response(
            {
                'count': utilisateurs.count(),
                'results': AdminUtilisateurSerializer(utilisateurs, many=True).data,
            }
        )

    def post(self, request):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()
        return Response(
            {
                'message': 'Utilisateur créé avec succès.',
                'utilisateur': AdminUtilisateurSerializer(utilisateur).data,
            },
            status=status.HTTP_201_CREATED,
        )


class UserDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk: int):
        try:
            utilisateur = Utilisateur.objects.get(pk=pk)
        except Utilisateur.DoesNotExist:
            return Response({'detail': 'Utilisateur introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserUpdateSerializer(
            data=request.data,
            partial=True,
            context={'instance': utilisateur, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.update(utilisateur, serializer.validated_data)
        return Response(
            {
                'message': 'Utilisateur modifié avec succès.',
                'utilisateur': AdminUtilisateurSerializer(utilisateur).data,
            }
        )

    def delete(self, request, pk: int):
        try:
            utilisateur = Utilisateur.objects.get(pk=pk)
        except Utilisateur.DoesNotExist:
            return Response({'detail': 'Utilisateur introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if utilisateur.pk == request.user.pk:
            return Response(
                {'detail': 'Vous ne pouvez pas supprimer votre propre compte.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        utilisateur.delete()
        return Response({'message': 'Utilisateur supprimé avec succès.'}, status=status.HTTP_200_OK)

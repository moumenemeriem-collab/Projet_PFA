from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authentication import JWTAuthentication
from accounts.permissions import IsAdmin

from .models import Message, Reponse
from .serializers import (
    MessageCreateSerializer,
    MessageDetailSerializer,
    MessageListSerializer,
    MessageUpdateSerializer,
    ReponseCreateSerializer,
    ReponseSerializer,
)


class MessageListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'admin':
            queryset = Message.objects.all()
        else:
            queryset = Message.objects.filter(expediteur=user)

        search = request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(sujet__icontains=search) | Q(contenu__icontains=search)
            )

        statut = request.query_params.get('statut', '').strip()
        if statut == 'lu':
            queryset = queryset.filter(est_lu=True)
        elif statut == 'non_lu':
            queryset = queryset.filter(est_lu=False)

        messages = queryset.order_by('-date_creation')
        return Response({
            'count': messages.count(),
            'results': MessageListSerializer(messages, many=True).data,
        })

    def post(self, request):
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            expediteur=request.user,
            sujet=serializer.validated_data['sujet'],
            contenu=serializer.validated_data['contenu'],
        )
        return Response(
            {
                'message': 'Message envoyé avec succès.',
                'data': MessageDetailSerializer(message).data,
            },
            status=status.HTTP_201_CREATED,
        )


class MessageDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_message(self, pk, user):
        try:
            if user.role == 'admin':
                return Message.objects.get(pk=pk)
            return Message.objects.get(pk=pk, expediteur=user)
        except Message.DoesNotExist:
            return None

    def get(self, request, pk):
        message = self._get_message(pk, request.user)
        if not message:
            return Response(
                {'detail': 'Message introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if request.user.role == 'admin':
            message.est_lu = True
            message.save(update_fields=['est_lu'])
        return Response(MessageDetailSerializer(message).data)

    def patch(self, request, pk):
        message = self._get_message(pk, request.user)
        if not message:
            return Response(
                {'detail': 'Message introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = MessageUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(message, field, value)
        message.save()
        return Response({
            'message': 'Message modifié avec succès.',
            'data': MessageDetailSerializer(message).data,
        })

    def delete(self, request, pk):
        message = self._get_message(pk, request.user)
        if not message:
            return Response(
                {'detail': 'Message introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        message.delete()
        return Response({'message': 'Message supprimé avec succès.'})


class ReponseCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        try:
            if request.user.role == 'admin':
                message = Message.objects.get(pk=message_id)
            else:
                message = Message.objects.get(pk=message_id, expediteur=request.user)
        except Message.DoesNotExist:
            return Response(
                {'detail': 'Message introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ReponseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reponse = Reponse.objects.create(
            message=message,
            auteur=request.user,
            contenu=serializer.validated_data['contenu'],
        )
        return Response(
            {
                'message': 'Réponse envoyée avec succès.',
                'data': ReponseSerializer(reponse).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminMessageListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        queryset = Message.objects.all()

        search = request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(sujet__icontains=search)
                | Q(contenu__icontains=search)
                | Q(expediteur__prenom__icontains=search)
                | Q(expediteur__nom__icontains=search)
                | Q(expediteur__email__icontains=search)
            )

        statut = request.query_params.get('statut', '').strip()
        if statut == 'lu':
            queryset = queryset.filter(est_lu=True)
        elif statut == 'non_lu':
            queryset = queryset.filter(est_lu=False)

        non_lus_count = Message.objects.filter(est_lu=False).count()
        total_count = Message.objects.count()

        messages = queryset.order_by('-date_creation')
        return Response({
            'count': messages.count(),
            'non_lus': non_lus_count,
            'total': total_count,
            'results': MessageListSerializer(messages, many=True).data,
        })


class MarquerLuView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            message = Message.objects.get(pk=pk)
        except Message.DoesNotExist:
            return Response(
                {'detail': 'Message introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        message.est_lu = True
        message.save(update_fields=['est_lu'])
        return Response({'message': 'Message marqué comme lu.'})

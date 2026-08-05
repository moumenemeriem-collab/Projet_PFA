from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authentication import JWTAuthentication
from accounts.permissions import IsAdmin

from .models import Message, Notification, Reponse
from .serializers import (
    MessageCreateSerializer,
    MessageDetailSerializer,
    MessageListSerializer,
    MessageUpdateSerializer,
    NotificationSerializer,
    ReponseCreateSerializer,
    ReponseSerializer,
    ReponseUpdateSerializer,
)

PAGE_SIZE = 6


def _paginate(queryset, page: int, page_size: int = PAGE_SIZE):
    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    return queryset[start:end], total


def _creer_notification(destinataire, titre, contenu, type_notif, message_id=None):
    Notification.objects.create(
        destinataire=destinataire,
        titre=titre,
        contenu=contenu,
        type_notif=type_notif,
        message_id=message_id,
    )


def _log(utilisateur, action, entite, description):
    from dashboard.models import Activite
    Activite.log(utilisateur, action, entite, description)


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
            queryset = queryset.filter(
                Q(sujet__icontains=search) | Q(contenu__icontains=search)
            )

        statut = request.query_params.get('statut', '').strip()
        if statut == 'lu':
            queryset = queryset.filter(est_lu=True)
        elif statut == 'non_lu':
            queryset = queryset.filter(est_lu=False)

        queryset = queryset.order_by('-date_creation')
        page = int(request.query_params.get('page', 1))
        page = max(1, page)
        paginated, total = _paginate(queryset, page)

        return Response({
            'count': total,
            'results': MessageListSerializer(paginated, many=True).data,
        })

    def post(self, request):
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            expediteur=request.user,
            sujet=serializer.validated_data['sujet'],
            contenu=serializer.validated_data['contenu'],
        )
        _log(request.user, 'ajout', 'message', f'Envoi du message "{message.sujet}"')
        from accounts.models import Utilisateur
        admins = Utilisateur.objects.filter(role='admin')
        for admin in admins:
            _creer_notification(
                destinataire=admin,
                titre='Nouveau message reçu',
                contenu=f'{request.user.prenom} {request.user.nom} a envoyé un message : "{message.sujet}"',
                type_notif='nouveau_message',
                message_id=message.id,
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
        _log(request.user, 'modification', 'message', f'Modification du message "{message.sujet}"')
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
        sujet = message.sujet
        expediteur = message.expediteur
        message.delete()
        _log(request.user, 'suppression', 'message', f'Suppression du message "{sujet}"')
        auteur_name = f'{request.user.prenom} {request.user.nom}'
        if request.user.role == 'admin':
            _creer_notification(
                destinataire=expediteur,
                titre='Message supprimé',
                contenu=f"L'administrateur {auteur_name} a supprimé votre message \"{sujet}\"",
                type_notif='message_supprime',
            )
        else:
            from accounts.models import Utilisateur
            admins = Utilisateur.objects.filter(role='admin')
            for admin in admins:
                _creer_notification(
                    destinataire=admin,
                    titre='Message supprimé',
                    contenu=f'{auteur_name} a supprimé le message "{sujet}"',
                    type_notif='message_supprime',
                )
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
        _log(request.user, 'ajout', 'reponse', f'Réponse au message "{message.sujet}"')
        auteur_name = f'{request.user.prenom} {request.user.nom}'
        if request.user.role == 'admin' and not message.est_lu:
            message.est_lu = True
            message.save(update_fields=['est_lu'])
        if request.user.role == 'admin':
            destinataire = message.expediteur
            _creer_notification(
                destinataire=destinataire,
                titre='Nouvelle réponse à votre message',
                contenu=f"L'administrateur {auteur_name} a répondu à votre message \"{message.sujet}\"",
                type_notif='nouvelle_reponse',
                message_id=message.id,
            )
        else:
            from accounts.models import Utilisateur
            admins = Utilisateur.objects.filter(role='admin')
            for admin in admins:
                if admin.pk != request.user.pk:
                    _creer_notification(
                        destinataire=admin,
                        titre='Nouvelle réponse reçue',
                        contenu=f'{auteur_name} a répondu au message "{message.sujet}"',
                        type_notif='nouvelle_reponse',
                        message_id=message.id,
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

        queryset = queryset.order_by('-date_creation')
        page = int(request.query_params.get('page', 1))
        page = max(1, page)
        paginated, _ = _paginate(queryset, page)

        return Response({
            'count': queryset.count(),
            'non_lus': non_lus_count,
            'total': total_count,
            'results': MessageListSerializer(paginated, many=True).data,
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


class ReponseDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_reponse(self, pk, user):
        try:
            rep = Reponse.objects.get(pk=pk)
        except Reponse.DoesNotExist:
            return None
        if rep.auteur_id != user.pk:
            return None
        return rep

    def patch(self, request, pk):
        rep = self._get_reponse(pk, request.user)
        if not rep:
            return Response(
                {'detail': 'Réponse introuvable ou accès refusé.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ReponseUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(rep, field, value)
        rep.save()
        return Response({
            'message': 'Réponse modifiée avec succès.',
            'data': ReponseSerializer(rep).data,
        })

    def delete(self, request, pk):
        rep = self._get_reponse(pk, request.user)
        if not rep:
            return Response(
                {'detail': 'Réponse introuvable ou accès refusé.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        message = rep.message
        auteur_name = f'{request.user.prenom} {request.user.nom}'
        destinataire = message.expediteur if request.user.role == 'admin' else None
        rep.delete()
        if request.user.role == 'admin' and destinataire:
            _creer_notification(
                destinataire=destinataire,
                titre='Réponse supprimée',
                contenu=f"L'administrateur {auteur_name} a supprimé une réponse à votre message \"{message.sujet}\"",
                type_notif='reponse_supprimee',
            )
        return Response({'message': 'Réponse supprimée avec succès.'})


class NotificationListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(destinataire=request.user)
        non_lues = notifications.filter(lu=False).count()
        notifications = notifications[:20]
        return Response({
            'non_lues': non_lues,
            'results': NotificationSerializer(notifications, many=True).data,
        })


class NotificationMarkReadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(destinataire=request.user, lu=False).update(lu=True)
        return Response({'message': 'Notifications marquées comme lues.'})


class NotificationDeleteView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, destinataire=request.user)
        except Notification.DoesNotExist:
            return Response(
                {'detail': 'Notification introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        notif.delete()
        return Response({'message': 'Notification supprimée.'})

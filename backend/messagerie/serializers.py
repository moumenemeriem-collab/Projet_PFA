from rest_framework import serializers

from accounts.serializers import UtilisateurSerializer

from .models import Message, Reponse


class ReponseSerializer(serializers.ModelSerializer):
    auteur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = Reponse
        fields = ['id', 'message', 'auteur', 'contenu', 'date_creation', 'date_modification']
        read_only_fields = ['id', 'date_creation', 'date_modification']


class MessageListSerializer(serializers.ModelSerializer):
    expediteur = UtilisateurSerializer(read_only=True)
    nb_reponses = serializers.SerializerMethodField()
    derniere_reponse = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'expediteur', 'sujet', 'contenu',
            'date_creation', 'date_modification', 'est_lu',
            'nb_reponses', 'derniere_reponse',
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification']

    def get_nb_reponses(self, obj: Message) -> int:
        return obj.reponses.count()

    def get_derniere_reponse(self, obj: Message) -> ReponseSerializer | None:
        last = obj.reponses.order_by('-date_creation').first()
        if last:
            return ReponseSerializer(last).data
        return None


class MessageDetailSerializer(serializers.ModelSerializer):
    expediteur = UtilisateurSerializer(read_only=True)
    reponses = ReponseSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'expediteur', 'sujet', 'contenu',
            'date_creation', 'date_modification', 'est_lu',
            'reponses',
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification']


class MessageCreateSerializer(serializers.Serializer):
    sujet = serializers.CharField(max_length=200)
    contenu = serializers.CharField()

    def validate_sujet(self, value: str) -> str:
        return value.strip()

    def validate_contenu(self, value: str) -> str:
        return value.strip()


class MessageUpdateSerializer(serializers.Serializer):
    sujet = serializers.CharField(max_length=200, required=False)
    contenu = serializers.CharField(required=False)

    def validate_sujet(self, value: str) -> str:
        return value.strip()

    def validate_contenu(self, value: str) -> str:
        return value.strip()


class ReponseCreateSerializer(serializers.Serializer):
    contenu = serializers.CharField()

    def validate_contenu(self, value: str) -> str:
        return value.strip()

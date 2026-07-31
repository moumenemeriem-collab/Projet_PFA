from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Role, Utilisateur


class RegisterSerializer(serializers.Serializer):
    prenom = serializers.CharField(max_length=100)
    nom = serializers.CharField(max_length=100)
    email = serializers.EmailField(max_length=150)
    telephone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    mot_de_passe = serializers.CharField(write_only=True, min_length=8)
    confirmer_mot_de_passe = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        if Utilisateur.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('Un compte existe déjà avec cette adresse e-mail.')
        return normalized

    def validate(self, attrs: dict) -> dict:
        if attrs['mot_de_passe'] != attrs['confirmer_mot_de_passe']:
            raise serializers.ValidationError(
                {'confirmer_mot_de_passe': 'Les mots de passe ne correspondent pas.'}
            )

        user_attrs = Utilisateur(
            prenom=attrs.get('prenom', ''),
            nom=attrs.get('nom', ''),
            email=attrs.get('email', ''),
        )
        validate_password(attrs['mot_de_passe'], user=user_attrs)
        return attrs

    def create(self, validated_data: dict) -> Utilisateur:
        validated_data.pop('confirmer_mot_de_passe')
        password = validated_data.pop('mot_de_passe')
        utilisateur = Utilisateur(**validated_data, role=Role.INVESTISSEUR)
        utilisateur.set_password(password)
        utilisateur.save()
        return utilisateur


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    mot_de_passe = serializers.CharField(write_only=True)


class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ['id', 'prenom', 'nom', 'email', 'telephone', 'role', 'date_creation']
        read_only_fields = fields


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ['prenom', 'nom', 'email', 'telephone']

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        user = self.context['request'].user
        if Utilisateur.objects.filter(email__iexact=normalized).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('Un compte existe déjà avec cette adresse e-mail.')
        return normalized

    def validate_telephone(self, value: str) -> str | None:
        return value.strip() or None


class ChangePasswordSerializer(serializers.Serializer):
    mot_de_passe_actuel = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True, min_length=8)
    confirmer_mot_de_passe = serializers.CharField(write_only=True, min_length=8)

    def validate_mot_de_passe_actuel(self, value: str) -> str:
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Mot de passe actuel incorrect.')
        return value

    def validate(self, attrs: dict) -> dict:
        if attrs['nouveau_mot_de_passe'] != attrs['confirmer_mot_de_passe']:
            raise serializers.ValidationError(
                {'confirmer_mot_de_passe': 'Les mots de passe ne correspondent pas.'}
            )
        validate_password(attrs['nouveau_mot_de_passe'], user=self.context['request'].user)
        return attrs


class AdminUtilisateurSerializer(serializers.ModelSerializer):
    mot_de_passe = serializers.SerializerMethodField()

    class Meta:
        model = Utilisateur
        fields = ['id', 'prenom', 'nom', 'email', 'telephone', 'role', 'date_creation', 'mot_de_passe']
        read_only_fields = fields

    def get_mot_de_passe(self, obj: Utilisateur) -> str:
        return '••••••••'


class AdminUserCreateSerializer(serializers.Serializer):
    prenom = serializers.CharField(max_length=100)
    nom = serializers.CharField(max_length=100)
    email = serializers.EmailField(max_length=150)
    telephone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    mot_de_passe = serializers.CharField(write_only=True, min_length=8)
    confirmer_mot_de_passe = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=Role.choices)

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        if Utilisateur.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('Un compte existe déjà avec cette adresse e-mail.')
        return normalized

    def validate(self, attrs: dict) -> dict:
        if attrs['mot_de_passe'] != attrs['confirmer_mot_de_passe']:
            raise serializers.ValidationError(
                {'confirmer_mot_de_passe': 'Les mots de passe ne correspondent pas.'}
            )
        user_attrs = Utilisateur(
            prenom=attrs.get('prenom', ''),
            nom=attrs.get('nom', ''),
            email=attrs.get('email', ''),
        )
        validate_password(attrs['mot_de_passe'], user=user_attrs)
        return attrs

    def create(self, validated_data: dict) -> Utilisateur:
        validated_data.pop('confirmer_mot_de_passe')
        password = validated_data.pop('mot_de_passe')
        telephone = validated_data.pop('telephone', '') or None
        utilisateur = Utilisateur(**validated_data, telephone=telephone)
        utilisateur.set_password(password)
        utilisateur.save()
        return utilisateur


class AdminUserUpdateSerializer(serializers.Serializer):
    prenom = serializers.CharField(max_length=100, required=False)
    nom = serializers.CharField(max_length=100, required=False)
    email = serializers.EmailField(max_length=150, required=False)
    telephone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=Role.choices, required=False)
    mot_de_passe = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)
    confirmer_mot_de_passe = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        instance = self.context['instance']
        if Utilisateur.objects.filter(email__iexact=normalized).exclude(pk=instance.pk).exists():
            raise serializers.ValidationError('Un compte existe déjà avec cette adresse e-mail.')
        return normalized

    def validate(self, attrs: dict) -> dict:
        password = attrs.get('mot_de_passe', '')
        confirm = attrs.get('confirmer_mot_de_passe', '')
        if password or confirm:
            if password != confirm:
                raise serializers.ValidationError(
                    {'confirmer_mot_de_passe': 'Les mots de passe ne correspondent pas.'}
                )
            instance = self.context['instance']
            user_attrs = Utilisateur(
                prenom=attrs.get('prenom', instance.prenom),
                nom=attrs.get('nom', instance.nom),
                email=attrs.get('email', instance.email),
            )
            validate_password(password, user=user_attrs)
        else:
            attrs.pop('mot_de_passe', None)
            attrs.pop('confirmer_mot_de_passe', None)
        return attrs

    def update(self, instance: Utilisateur, validated_data: dict) -> Utilisateur:
        password = validated_data.pop('mot_de_passe', None)
        validated_data.pop('confirmer_mot_de_passe', None)

        if 'telephone' in validated_data:
            validated_data['telephone'] = validated_data['telephone'].strip() or None

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance

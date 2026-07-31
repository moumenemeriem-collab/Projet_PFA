from rest_framework import serializers

from .models import Couche, Projet, Terrain, TypeProjet


class TypeProjetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeProjet
        fields = ['id', 'nom', 'description', 'image_defaut', 'actif']
        read_only_fields = fields


class ProjetListSerializer(serializers.ModelSerializer):
    type_nom = serializers.CharField(source='id_type.nom', read_only=True)
    type_image_defaut = serializers.CharField(source='id_type.image_defaut', read_only=True)

    class Meta:
        model = Projet
        fields = [
            'id', 'nom', 'description', 'id_type', 'type_nom', 'type_image_defaut',
            'surface_souhaitee', 'budget_total', 'prix_terrain',
            'nombre_unites', 'surface_construite', 'cout_construction',
            'autres_charges', 'prix_vente_unitaire', 'revenu_estime',
            'image', 'date_creation', 'investisseur',
        ]
        read_only_fields = ['id', 'date_creation', 'investisseur']


class ProjetDetailSerializer(serializers.ModelSerializer):
    type_nom = serializers.CharField(source='id_type.nom', read_only=True)
    type_image_defaut = serializers.CharField(source='id_type.image_defaut', read_only=True)

    class Meta:
        model = Projet
        fields = [
            'id', 'nom', 'description', 'id_type', 'type_nom', 'type_image_defaut',
            'surface_souhaitee', 'budget_total', 'prix_terrain',
            'nombre_unites', 'surface_construite', 'cout_construction',
            'autres_charges', 'prix_vente_unitaire', 'revenu_estime',
            'image', 'date_creation', 'investisseur',
        ]
        read_only_fields = ['id', 'date_creation', 'investisseur']


class ProjetCreateSerializer(serializers.Serializer):
    nom = serializers.CharField(max_length=150)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    id_type = serializers.IntegerField()
    surface_souhaitee = serializers.DecimalField(max_digits=12, decimal_places=2)
    budget_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    prix_terrain = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True, default=None)
    nombre_unites = serializers.IntegerField(required=False, allow_null=True, default=None)
    surface_construite = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)
    cout_construction = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True, default=None)
    autres_charges = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True, default=None)
    prix_vente_unitaire = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True, default=None)
    revenu_estime = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True, default=None)
    image = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')

    def validate_id_type(self, value: int) -> int:
        if not TypeProjet.objects.filter(pk=value, actif=True).exists():
            raise serializers.ValidationError('Type de projet invalide ou inactif.')
        return value

    def create(self, validated_data: dict) -> Projet:
        type_id = validated_data.pop('id_type')
        projet = Projet(id_type_id=type_id, **validated_data)
        projet.save()
        return projet


class ProjetUpdateSerializer(serializers.Serializer):
    nom = serializers.CharField(max_length=150, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    id_type = serializers.IntegerField(required=False)
    surface_souhaitee = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    budget_total = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    prix_terrain = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True)
    nombre_unites = serializers.IntegerField(required=False, allow_null=True)
    surface_construite = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    cout_construction = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True)
    autres_charges = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True)
    prix_vente_unitaire = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True)
    revenu_estime = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True)
    image = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_id_type(self, value: int) -> int:
        if not TypeProjet.objects.filter(pk=value, actif=True).exists():
            raise serializers.ValidationError('Type de projet invalide ou inactif.')
        return value

    def update(self, instance: Projet, validated_data: dict) -> Projet:
        for field, value in validated_data.items():
            if field == 'id_type':
                instance.id_type_id = value
            else:
                setattr(instance, field, value)
        instance.save()
        return instance


class TerrainListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Terrain
        fields = [
            'id', 'nom', 'superficie', 'lat', 'lng',
            'accessibilite', 'positionnement', 'topographie', 'score',
            'projet', 'date_creation',
        ]
        read_only_fields = ['id', 'score', 'date_creation']


class TerrainCreateSerializer(serializers.Serializer):
    nom = serializers.CharField(max_length=150)
    superficie = serializers.DecimalField(max_digits=12, decimal_places=2)
    lat = serializers.DecimalField(max_digits=9, decimal_places=6)
    lng = serializers.DecimalField(max_digits=9, decimal_places=6)
    accessibilite = serializers.IntegerField(min_value=1, max_value=10, default=5)
    positionnement = serializers.IntegerField(min_value=1, max_value=10, default=5)
    topographie = serializers.IntegerField(min_value=1, max_value=10, default=5)

    def create(self, validated_data: dict) -> Terrain:
        terrain = Terrain(**validated_data)
        terrain.save()
        return terrain


class CoucheListSerializer(serializers.ModelSerializer):
    taille_affichage = serializers.ReadOnlyField()

    class Meta:
        model = Couche
        fields = [
            'id', 'nom', 'nom_affichage', 'description', 'categorie', 'type_geometrie',
            'attributs', 'table_liee', 'etat', 'message_erreur',
            'taille_affichage', 'taille_fichier', 'format_fichier',
            'date_creation', 'date_mise_a_jour', 'ordre',
        ]


class CoucheDetailSerializer(serializers.ModelSerializer):
    taille_affichage = serializers.ReadOnlyField()
    imports = serializers.SerializerMethodField()

    class Meta:
        model = Couche
        fields = [
            'id', 'nom', 'nom_affichage', 'description', 'categorie', 'type_geometrie',
            'attributs', 'table_liee', 'etat', 'message_erreur',
            'taille_affichage', 'taille_fichier', 'format_fichier',
            'date_creation', 'date_mise_a_jour', 'ordre', 'imports',
        ]

    def get_imports(self, obj):
        return [
            {
                'id': i.id,
                'statut': i.statut,
                'message': i.message,
                'nb_enregistrements': i.nb_enregistrements,
                'date_import': i.date_import.isoformat(),
            }
            for i in obj.imports.all()[:10]
        ]

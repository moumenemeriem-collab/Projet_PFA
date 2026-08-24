from django.contrib.gis.geos import GEOSGeometry
from rest_framework import serializers

from .models import Analyse, Couche, Projet, ResultatAnalyse, Terrain, TypeProjet
from .profitability import calculer_rentabilite_projet


class TypeProjetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeProjet
        fields = ['id', 'nom', 'description', 'image_defaut', 'actif']
        read_only_fields = fields


class ProjetListSerializer(serializers.ModelSerializer):
    type_nom = serializers.CharField(source='id_type.nom', read_only=True)
    type_image_defaut = serializers.CharField(source='id_type.image_defaut', read_only=True)
    rentabilite = serializers.SerializerMethodField()

    class Meta:
        model = Projet
        fields = [
            'id', 'nom', 'description', 'id_type', 'type_nom', 'type_image_defaut',
            'surface_souhaitee', 'budget_total', 'prix_terrain',
            'nombre_unites', 'surface_construite', 'cout_construction',
            'autres_charges', 'prix_vente_unitaire', 'revenu_estime',
            'image', 'date_creation', 'investisseur', 'rentabilite',
            'prix_foncier_m2', 'frais_acquisition', 'taux_chute', 'cos', 'cus',
            'has_appartement', 'has_commerce', 'has_bureau',
            'quote_part_appartement', 'quote_part_commerce', 'quote_part_bureau',
            'prix_vente_appartement', 'prix_vente_commerce', 'prix_vente_bureau',
            'cout_construction_appartement', 'cout_construction_commerce', 'cout_construction_bureau',
            'taux_etudes_honoraires', 'taux_imprevus', 'taux_commercialisation',
            'duree_construction', 'duree_commercialisation', 'taux_actualisation',
            'repartition_construction', 'repartition_ventes',
        ]
        read_only_fields = ['id', 'date_creation', 'investisseur']

    def get_rentabilite(self, obj: Projet) -> dict:
        try:
            return calculer_rentabilite_projet(obj)
        except Exception:
            return None


class ProjetDetailSerializer(serializers.ModelSerializer):
    type_nom = serializers.CharField(source='id_type.nom', read_only=True)
    type_image_defaut = serializers.CharField(source='id_type.image_defaut', read_only=True)
    rentabilite = serializers.SerializerMethodField()

    class Meta:
        model = Projet
        fields = [
            'id', 'nom', 'description', 'id_type', 'type_nom', 'type_image_defaut',
            'surface_souhaitee', 'budget_total', 'prix_terrain',
            'nombre_unites', 'surface_construite', 'cout_construction',
            'autres_charges', 'prix_vente_unitaire', 'revenu_estime',
            'image', 'date_creation', 'investisseur', 'rentabilite',
            'prix_foncier_m2', 'frais_acquisition', 'taux_chute', 'cos', 'cus',
            'has_appartement', 'has_commerce', 'has_bureau',
            'quote_part_appartement', 'quote_part_commerce', 'quote_part_bureau',
            'prix_vente_appartement', 'prix_vente_commerce', 'prix_vente_bureau',
            'cout_construction_appartement', 'cout_construction_commerce', 'cout_construction_bureau',
            'taux_etudes_honoraires', 'taux_imprevus', 'taux_commercialisation',
            'duree_construction', 'duree_commercialisation', 'taux_actualisation',
            'repartition_construction', 'repartition_ventes',
        ]
        read_only_fields = ['id', 'date_creation', 'investisseur']

    def get_rentabilite(self, obj: Projet) -> dict:
        try:
            return calculer_rentabilite_projet(obj)
        except Exception:
            return None


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

    # Nouveaux champs rentabilité
    prix_foncier_m2 = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)
    frais_acquisition = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=7)
    taux_chute = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=30)
    cos = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True, default=None)
    cus = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True, default=None)

    has_appartement = serializers.BooleanField(required=False, default=True)
    has_commerce = serializers.BooleanField(required=False, default=False)
    has_bureau = serializers.BooleanField(required=False, default=False)

    quote_part_appartement = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=100)
    quote_part_commerce = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=0)
    quote_part_bureau = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=0)

    prix_vente_appartement = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)
    prix_vente_commerce = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)
    prix_vente_bureau = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)

    cout_construction_appartement = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)
    cout_construction_commerce = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)
    cout_construction_bureau = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)

    taux_etudes_honoraires = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=10)
    taux_imprevus = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=5)
    taux_commercialisation = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=3)

    duree_construction = serializers.IntegerField(required=False, default=2)
    duree_commercialisation = serializers.IntegerField(required=False, default=3)
    taux_actualisation = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, default=8)

    repartition_construction = serializers.JSONField(required=False, allow_null=True, default=None)
    repartition_ventes = serializers.JSONField(required=False, allow_null=True, default=None)

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

    # Nouveaux champs rentabilité
    prix_foncier_m2 = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    frais_acquisition = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    taux_chute = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    cos = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    cus = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)

    has_appartement = serializers.BooleanField(required=False)
    has_commerce = serializers.BooleanField(required=False)
    has_bureau = serializers.BooleanField(required=False)

    quote_part_appartement = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    quote_part_commerce = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    quote_part_bureau = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)

    prix_vente_appartement = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    prix_vente_commerce = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    prix_vente_bureau = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    cout_construction_appartement = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    cout_construction_commerce = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    cout_construction_bureau = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    taux_etudes_honoraires = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    taux_imprevus = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    taux_commercialisation = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)

    duree_construction = serializers.IntegerField(required=False)
    duree_commercialisation = serializers.IntegerField(required=False)
    taux_actualisation = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)

    repartition_construction = serializers.JSONField(required=False, allow_null=True)
    repartition_ventes = serializers.JSONField(required=False, allow_null=True)

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
    geometry = serializers.SerializerMethodField()

    class Meta:
        model = Terrain
        fields = [
            'id', 'nom', 'superficie', 'lat', 'lng',
            'accessibilite', 'positionnement', 'topographie', 'score',
            'projet', 'utilisateur', 'fid', 'indice', 'complement',
            'consistance', 'num_parcelle',
            'num_titre_foncier', 'statut_juridique', 'prix_demande',
            'zonage', 'cos', 'cus', 'hauteur_maximale', 'equipements',
            'geometry', 'rentabilite_json', 'date_creation',
        ]
        read_only_fields = ['id', 'score', 'date_creation']

    def get_geometry(self, obj: Terrain) -> str:
        if obj.geometry is None:
            return ''
        return obj.geometry.geojson


class TerrainCreateSerializer(serializers.Serializer):
    num_titre_foncier = serializers.CharField(max_length=255, allow_blank=True, default='')
    statut_juridique = serializers.ChoiceField(
        choices=[c for c, _ in Terrain.STATUT_JURIDIQUE_CHOICES],
        required=False,
        allow_blank=True,
        default='',
    )
    prix_demande = serializers.DecimalField(max_digits=15, decimal_places=2, required=False, allow_null=True, default=None)
    zonage = serializers.ChoiceField(
        choices=[c for c, _ in Terrain.ZONAGE_CHOICES],
        required=False,
        allow_blank=True,
        default='',
    )
    cos = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True, default=None)
    cus = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True, default=None)
    hauteur_maximale = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True, default=None)
    equipements = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True, default=list)
    superficie = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, default=None)
    lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True, default=None)
    lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True, default=None)
    geometry = serializers.CharField(required=False, allow_null=True, allow_blank=True, default='')
    accessibilite = serializers.IntegerField(min_value=1, max_value=10, default=5)
    positionnement = serializers.IntegerField(min_value=1, max_value=10, default=5)
    topographie = serializers.IntegerField(min_value=1, max_value=10, default=5)

    def create(self, validated_data: dict) -> Terrain:
        geometry_raw = validated_data.pop('geometry', '') or ''
        geom = None
        if geometry_raw:
            try:
                geom = GEOSGeometry(geometry_raw)
            except Exception as exc:
                raise serializers.ValidationError({'geometry': f'Géométrie invalide : {exc}'})
            if geom is None or geom.geom_type != 'Polygon' or not geom.valid:
                raise serializers.ValidationError({'geometry': 'Seul un polygone valide est accepté.'})
            geom.srid = 4326
        num_titre = validated_data.pop('num_titre_foncier', '')
        superficie = validated_data.pop('superficie', None)
        terrain = Terrain(
            nom=num_titre,
            num_parcelle=num_titre,
            num_titre_foncier=num_titre,
            superficie=superficie if superficie is not None else 0,
            geometry=geom,
            **validated_data,
        )
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


class ResultatAnalyseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResultatAnalyse
        fields = [
            'id', 'id_parcelle', 'reference_cadastrale', 'nom', 'superficie', 'lat', 'lng',
            'score_accessibilite', 'score_positionnement', 'score_topographie',
            'score_superficie', 'score_amc',
            'roi', 'marge', 'benefice_net', 'prix_terrain',
            'score_rentabilite', 'type_rentabilite',
            'score_final', 'rang',
            'nombre_criteres_satisfaits', 'total_criteres',
            'criteres', 'points_forts', 'points_faibles',
        ]
        read_only_fields = fields


class AnalyseListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Analyse
        fields = [
            'id', 'projet', 'date_creation', 'filtres',
            'poids_amc', 'poids_rentabilite',
            'nombre_parcelles', 'statut',
        ]
        read_only_fields = fields


class AnalyseDetailSerializer(AnalyseListSerializer):
    resultats = ResultatAnalyseSerializer(many=True, read_only=True)

    class Meta(AnalyseListSerializer.Meta):
        fields = AnalyseListSerializer.Meta.fields + ['resultats']


class AnalyseCreateSerializer(serializers.Serializer):
    filtres = serializers.JSONField(required=False, default=dict)

    def create(self, validated_data: dict) -> Analyse:
        from .analyse import analyser_parcelles

        projet = validated_data.pop('projet')
        filtres = validated_data.pop('filtres') or {}
        resultat = analyser_parcelles(projet.pk, filtres)
        parcelles = resultat.get('resultats', [])

        analyse = Analyse.objects.create(
            projet=projet,
            filtres=filtres,
            poids_amc=0.30,
            poids_rentabilite=0.40,
            nombre_parcelles=len(parcelles),
            statut='complete',
        )
        ResultatAnalyse.objects.bulk_create([
            ResultatAnalyse(
                analyse=analyse,
                id_parcelle=str(p.get('id')) if p.get('id') is not None else p.get('id_parcelle'),
                reference_cadastrale=(p.get('infos_generales') or {}).get('reference_cadastrale', '') or '',
                nom=p.get('nom', '') or '',
                superficie=p.get('superficie'),
                lat=p.get('lat'),
                lng=p.get('lng'),
                score_accessibilite=p.get('score_accessibilite'),
                score_positionnement=p.get('score_positionnement'),
                score_topographie=p.get('score_topographie'),
                score_superficie=p.get('score_superficie'),
                score_amc=p.get('score_amc'),
                roi=p.get('roi'),
                marge=p.get('marge'),
                benefice_net=p.get('benefice_net'),
                prix_terrain=p.get('prix_terrain'),
                score_rentabilite=p.get('score_rentabilite'),
                type_rentabilite=p.get('type_rentabilite', '') or '',
                score_final=p.get('score_final'),
                rang=p.get('classement'),
                nombre_criteres_satisfaits=p.get('criteres_satisfaits', 0) or 0,
                total_criteres=p.get('criteres_total', 0) or 0,
                criteres=p.get('criteres'),
                points_forts=p.get('points_forts'),
                points_faibles=p.get('points_faibles'),
            )
            for p in parcelles
        ])
        return analyse

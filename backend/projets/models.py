from django.contrib.gis.db.models import PolygonField
from django.db import models

from accounts.models import Utilisateur

SHOB_FACTOR = 1.20


class TypeProjet(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    image_defaut = models.CharField(max_length=255, blank=True, null=True)
    actif = models.BooleanField(default=True)

    class Meta:
        db_table = 'type_projet'
        ordering = ['nom']

    def __str__(self) -> str:
        return self.nom


class Projet(models.Model):
    nom = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    id_type = models.ForeignKey(
        TypeProjet,
        on_delete=models.PROTECT,
        related_name='projets',
        db_column='id_type',
    )
    surface_souhaitee = models.DecimalField(max_digits=12, decimal_places=2)
    budget_total = models.DecimalField(max_digits=15, decimal_places=2)

    prix_terrain = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)

    nombre_unites = models.IntegerField(blank=True, null=True)
    surface_construite = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    cout_construction = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    autres_charges = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    prix_vente_unitaire = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    revenu_estime = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)

    image = models.CharField(max_length=255, blank=True, null=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    investisseur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name='projets',
        db_column='investisseur_id',
    )

    # ── Nouveaux champs : Rentabilité immobilière ──

    # Données foncières
    prix_foncier_m2 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    frais_acquisition = models.DecimalField(max_digits=5, decimal_places=2, default=7)
    taux_chute = models.DecimalField(max_digits=5, decimal_places=2, default=30)
    cos = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    cus = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    # Surfaces complémentaires
    surface_constructible = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    surface_voie = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    surface_espace_vert = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Types de biens
    has_appartement = models.BooleanField(default=True)
    has_commerce = models.BooleanField(default=False)
    has_bureau = models.BooleanField(default=False)
    has_equipement = models.BooleanField(default=False)
    has_equipement_prive = models.BooleanField(default=False)

    # Quote-parts (%)
    quote_part_appartement = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    quote_part_commerce = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    quote_part_bureau = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    quote_part_equipement = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    quote_part_equipement_prive = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Prix de vente (DH/m²)
    prix_vente_appartement = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    prix_vente_commerce = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    prix_vente_bureau = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Équipement public : surface calculée (plan d'aménagement) + prix unitaire
    surface_equipement = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    prix_vente_equipement = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Équipement privé : surface calculée (plan d'aménagement) + prix unitaire
    surface_equipement_prive = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    prix_vente_equipement_prive = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Coûts de construction (DH/m²)
    cout_construction_appartement = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cout_construction_commerce = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cout_construction_bureau = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cout_construction_equipement = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cout_construction_equipement_prive = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Charges
    taux_etudes_honoraires = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    taux_imprevus = models.DecimalField(max_digits=5, decimal_places=2, default=5)
    taux_commercialisation = models.DecimalField(max_digits=5, decimal_places=2, default=3)

    # Paramètres temporels
    duree_construction = models.IntegerField(default=2)
    duree_commercialisation = models.IntegerField(default=3)
    taux_actualisation = models.DecimalField(max_digits=5, decimal_places=2, default=8)

    # Échelonnement (JSON)
    repartition_construction = models.JSONField(null=True, blank=True)
    repartition_ventes = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'projet'
        ordering = ['-date_creation']

    def __str__(self) -> str:
        return self.nom


class Terrain(models.Model):
    SCORE_CHOICES = [(i, str(i)) for i in range(1, 11)]

    STATUT_JURIDIQUE_CHOICES = [
        ('titre', 'Titré'),
        ('requisition', 'Réquisition en cours'),
        ('non_immatricule', 'Non immatriculé'),
        ('collectif', 'Collectif'),
    ]

    ZONAGE_CHOICES = [
        ('residentiel', 'Résidentiel'),
        ('commercial', 'Commercial'),
        ('industriel', 'Industriel'),
        ('agricole', 'Agricole'),
        ('mixte', 'Mixte'),
    ]

    ZONE_LOCALISATION_CHOICES = [
        ('centre_ville', 'Centre-ville'),
        ('periurbaine', 'Périphérie'),
    ]

    projet = models.ForeignKey(
        Projet,
        on_delete=models.CASCADE,
        related_name='terrains',
        db_column='projet_id',
    )
    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='terrains_ajoutes',
        db_column='utilisateur_id',
    )
    nom = models.CharField(max_length=150)
    superficie = models.DecimalField(max_digits=12, decimal_places=2)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # Informations descriptives saisies dans le formulaire « Ajouter un terrain »
    num_titre_foncier = models.CharField(max_length=255, blank=True, default='')
    statut_juridique = models.CharField(
        max_length=30, choices=STATUT_JURIDIQUE_CHOICES, blank=True, default=''
    )
    prix_demande = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    zonage = models.CharField(max_length=20, choices=ZONAGE_CHOICES, blank=True, default='')
    cos = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    cus = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    hauteur_maximale = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    equipements = models.JSONField(default=list, blank=True)

    # Attributs hérités de la table plan cadastrale (couche cadastre)
    fid = models.BigIntegerField(null=True, blank=True)
    indice = models.CharField(max_length=255, blank=True, default='')
    complement = models.CharField(max_length=255, blank=True, default='')
    consistance = models.CharField(max_length=255, blank=True, default='')
    num_parcelle = models.CharField(max_length=255, blank=True, default='')
    # Polygone du terrain (PostGIS, EPSG:4326)
    geometry = PolygonField(srid=4326, spatial_index=True, null=True, blank=True)

    # Données géospatiales calculées une fois (plan d'aménagement + MNT) et persistées
    zone_localisation_calculee = models.CharField(
        max_length=20, choices=ZONE_LOCALISATION_CHOICES, blank=True, default=''
    )
    altitude_calculee = models.FloatField(null=True, blank=True)
    derniere_maj_geo = models.DateTimeField(null=True, blank=True)

    accessibilite = models.IntegerField(choices=SCORE_CHOICES, default=5)
    positionnement = models.IntegerField(choices=SCORE_CHOICES, default=5)
    topographie = models.IntegerField(choices=SCORE_CHOICES, default=5)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Champs rentabilité (remplis quand l'utilisateur calcule/édite la rentabilité)
    rentabilite_json = models.JSONField(null=True, blank=True)

    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'terrain'
        ordering = ['-score', '-date_creation']

    def __str__(self) -> str:
        return f'{self.nom} ({self.projet.nom})'

    def save(self, *args, **kwargs):
        self.score = (self.accessibilite + self.positionnement + self.topographie) / 3
        super().save(*args, **kwargs)


class Analyse(models.Model):
    """Exécution sauvegardée de l'analyse multicritère des parcelles."""

    STATUT_CHOICES = [
        ('complete', 'Complète'),
        ('en_cours', 'En cours'),
        ('erreur', 'Erreur'),
    ]

    projet = models.ForeignKey(
        Projet,
        on_delete=models.CASCADE,
        related_name='analyses',
        db_column='projet_id',
    )
    date_creation = models.DateTimeField(auto_now_add=True)
    filtres = models.JSONField(blank=True, null=True)
    poids_amc = models.DecimalField(max_digits=5, decimal_places=2, default=0.30)
    poids_rentabilite = models.DecimalField(max_digits=5, decimal_places=2, default=0.40)
    nombre_parcelles = models.IntegerField(default=0)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='complete')

    class Meta:
        db_table = 'analyse'
        ordering = ['-date_creation']

    def __str__(self) -> str:
        return f'Analyse #{self.pk} - {self.projet.nom}'


class ResultatAnalyse(models.Model):
    """Résultat d'une parcelle au sein d'une analyse sauvegardée."""

    analyse = models.ForeignKey(
        Analyse,
        on_delete=models.CASCADE,
        related_name='resultats',
        db_column='analyse_id',
    )
    id_parcelle = models.CharField(max_length=50)
    reference_cadastrale = models.CharField(max_length=50, blank=True, default='')
    nom = models.CharField(max_length=150, blank=True, default='')
    superficie = models.FloatField(null=True, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    score_accessibilite = models.IntegerField(null=True, blank=True)
    score_positionnement = models.IntegerField(null=True, blank=True)
    score_topographie = models.IntegerField(null=True, blank=True)
    score_superficie = models.IntegerField(null=True, blank=True)
    score_amc = models.FloatField(null=True, blank=True)

    roi = models.FloatField(null=True, blank=True)
    marge = models.FloatField(null=True, blank=True)
    benefice_net = models.FloatField(null=True, blank=True)
    prix_terrain = models.FloatField(null=True, blank=True)
    score_rentabilite = models.FloatField(null=True, blank=True)
    type_rentabilite = models.CharField(max_length=20, blank=True, default='')

    score_final = models.FloatField(null=True, blank=True)
    rang = models.IntegerField(null=True, blank=True)

    nombre_criteres_satisfaits = models.IntegerField(default=0)
    total_criteres = models.IntegerField(default=0)
    criteres = models.JSONField(blank=True, null=True)
    criteres_conformite = models.JSONField(blank=True, null=True)
    points_forts = models.JSONField(blank=True, null=True)
    points_faibles = models.JSONField(blank=True, null=True)

    class Meta:
        db_table = 'resultat_analyse'
        ordering = ['rang']

    def __str__(self) -> str:
        return f'{self.id_parcelle} - rang {self.rang}'


def couche_upload_path(instance, filename):
    return f'couches/{instance.nom}/{filename}'


class Couche(models.Model):
    ETAT_CHOICES = [
        ('non_importe', 'Non importé'),
        ('importe', 'Importé'),
        ('erreur', 'Erreur'),
    ]

    CATEGORIE_CHOICES = [
        ('foncier', 'Foncier'),
        ('urbanisme', 'Urbanisme'),
        ('administratif', 'Administratif'),
        ('equipements', 'Équipements'),
        ('infrastructure', 'Infrastructure'),
        ('topographie', 'Topographie'),
    ]

    nom = models.CharField(max_length=100, unique=True)
    nom_affichage = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    categorie = models.CharField(max_length=50, choices=CATEGORIE_CHOICES, blank=True, default='')
    type_geometrie = models.CharField(max_length=50, blank=True)
    attributs = models.JSONField(default=list, blank=True)
    table_liee = models.CharField(max_length=100, blank=True)
    fichier = models.FileField(upload_to=couche_upload_path, null=True, blank=True)
    taille_fichier = models.BigIntegerField(null=True, blank=True)
    format_fichier = models.CharField(max_length=20, blank=True)
    etat = models.CharField(max_length=20, choices=ETAT_CHOICES, default='non_importe')
    message_erreur = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_mise_a_jour = models.DateTimeField(auto_now=True)
    ordre = models.IntegerField(default=0)

    class Meta:
        db_table = 'couche'
        ordering = ['ordre', 'nom']

    def __str__(self):
        return self.nom_affichage

    @property
    def taille_affichage(self):
        if self.taille_fichier is None:
            return '-'
        size = self.taille_fichier
        for unit in ('o', 'Ko', 'Mo', 'Go'):
            if size < 1024:
                return f'{size:.1f} {unit}'
            size /= 1024
        return f'{size:.1f} To'


class ImportCouche(models.Model):
    STATUT_CHOICES = [
        ('succes', 'Succès'),
        ('erreur', 'Erreur'),
    ]

    couche = models.ForeignKey(Couche, on_delete=models.CASCADE, related_name='imports')
    fichier = models.CharField(max_length=500)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES)
    message = models.TextField(blank=True)
    nb_enregistrements = models.IntegerField(null=True, blank=True)
    date_import = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'import_couche'
        ordering = ['-date_import']

    def __str__(self):
        return f'{self.couche.nom} - {self.date_import:%Y-%m-%d %H:%M}'


class PonderationPreference(models.Model):
    """Préférences de pondération AHP+ROC d'un utilisateur pour un projet."""

    projet = models.ForeignKey(
        Projet,
        on_delete=models.CASCADE,
        related_name='ponderation_preferences',
        db_column='projet_id',
    )
    matrice_ahp = models.JSONField(
        default=list,
        help_text='2 intensités consécutives [a12, a23] (a13 = a12×a23 déduit)',
    )
    ordre_categories = models.JSONField(
        default=list,
        blank=True,
        help_text='[cat_rang1, cat_rang2, cat_rang3] ordre choisi par l\'utilisateur',
    )
    ordres_roc = models.JSONField(
        default=dict,
        help_text='{"accessibilite": ["Enseignement", "Routes", ...], "positionnement": [...]}',
    )
    selections_criteres = models.JSONField(
        default=dict,
        help_text='{"accessibilite": ["enseignement", "sante", "routes"], "localisation": ["centre_ville"], ...}',
    )
    preferences_localisation = models.JSONField(
        default=dict,
        help_text='{"localisation": "centre_ville"}',
    )
    preferences_altitude = models.JSONField(
        default=list,
        help_text='["lt100", "100_300", "gt300"]',
    )
    seuil = models.FloatField(default=0.3)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_mise_a_jour = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ponderation_preference'
        ordering = ['-date_mise_a_jour']

    def __str__(self):
        return f'Pondération {self.projet.nom} - {self.date_mise_a_jour:%Y-%m-%d %H:%M}'

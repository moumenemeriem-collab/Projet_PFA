from django.db import models

from accounts.models import Utilisateur


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

    class Meta:
        db_table = 'projet'
        ordering = ['-date_creation']

    def __str__(self) -> str:
        return self.nom


class Terrain(models.Model):
    SCORE_CHOICES = [(i, str(i)) for i in range(1, 11)]

    projet = models.ForeignKey(
        Projet,
        on_delete=models.CASCADE,
        related_name='terrains',
        db_column='projet_id',
    )
    nom = models.CharField(max_length=150)
    superficie = models.DecimalField(max_digits=12, decimal_places=2)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)

    accessibilite = models.IntegerField(choices=SCORE_CHOICES, default=5)
    positionnement = models.IntegerField(choices=SCORE_CHOICES, default=5)
    topographie = models.IntegerField(choices=SCORE_CHOICES, default=5)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'terrain'
        ordering = ['-score', '-date_creation']

    def __str__(self) -> str:
        return f'{self.nom} ({self.projet.nom})'

    def save(self, *args, **kwargs):
        self.score = (self.accessibilite + self.positionnement + self.topographie) / 3
        super().save(*args, **kwargs)


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

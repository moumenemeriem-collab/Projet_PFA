from django.contrib.auth.hashers import check_password, make_password
from django.core.validators import EmailValidator
from django.db import models


class Role(models.TextChoices):
    INVESTISSEUR = 'investisseur', 'Investisseur'
    ADMIN = 'admin', 'Admin'


class Utilisateur(models.Model):
    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    email = models.EmailField(max_length=150, unique=True, validators=[EmailValidator()])
    telephone = models.CharField(max_length=20, blank=True, null=True)
    mot_de_passe_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.INVESTISSEUR)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'utilisateur'
        ordering = ['-date_creation']

    def __str__(self) -> str:
        return f'{self.prenom} {self.nom} ({self.email})'

    def set_password(self, raw_password: str) -> None:
        self.mot_de_passe_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.mot_de_passe_hash)

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False

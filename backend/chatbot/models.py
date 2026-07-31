from django.db import models


class KnowledgeEntry(models.Model):
    slug = models.CharField(max_length=10, primary_key=True)
    categorie = models.CharField(max_length=50)
    titre = models.CharField(max_length=255)
    contenu = models.TextField()
    embedding = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'knowledge_entries'
        ordering = ['slug']

    def __str__(self):
        return f"[{self.categorie}] {self.titre}"

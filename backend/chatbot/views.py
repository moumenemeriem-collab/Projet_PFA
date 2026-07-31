import json
import os
import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ChatRequestSerializer

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Tu es l'assistant IA de GEO INVEST, une plateforme géospatiale d'analyse du potentiel foncier dans la région Rabat-Témara au Maroc.

Tu es un expert en :
- Investissement foncier et immobilier au Maroc
- Urbanisme et réglementation foncière marocaine
- Fiscalité immobilière au Maroc (droits d'enregistrement, TVA, plus-value, taxe foncière)
- Cadastre et droits de propriété (ANCFCC, titre foncier, adoul)
- Analyse multicritères de terrains

Ton rôle est d'aider les investisseurs et utilisateurs de GEO INVEST en répondant à leurs questions sur :
- Le fonctionnement de la plateforme GEO INVEST
- L'investissement foncier au Maroc
- La réglementation et la fiscalité immobilière
- Les concepts d'urbanisme et de cadastre
- Le processus d'achat et de transaction immobilière au Maroc

Règles :
- Réponds toujours en français
- Sois concis et précis (2-4 phrases maximum par réponse)
- Utilise les informations du contexte fourni pour enrichir tes réponses
- Si tu n'as pas d'information suffisante, dis-le clairement
- Adopte un ton professionnel et bienveillant
- Mentionne les concepts clés quand c'est pertinent"""

_embedding_model = None
_knowledge_cache = None


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedding_model


def _get_knowledge_cache():
    global _knowledge_cache
    if _knowledge_cache is None:
        from .models import KnowledgeEntry
        entries = KnowledgeEntry.objects.filter(embedding__isnull=False)
        _knowledge_cache = [
            {
                'id': e.id,
                'titre': e.titre,
                'categorie': e.categorie,
                'contenu': e.contenu,
                'embedding': e.embedding,
            }
            for e in entries
        ]
    return _knowledge_cache


def _cosine_similarity(a, b):
    import numpy as np
    vec_a = np.array(a, dtype=np.float32)
    vec_b = np.array(b, dtype=np.float32)
    dot = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def _build_prompt(user_message, context_texts):
    context_block = ""
    if context_texts:
        context_block = "\n\n--- CONTEXTE (extraits pertinents) ---\n"
        for i, text in enumerate(context_texts, 1):
            context_block += f"\n[{i}] {text}\n"
        context_block += "--- FIN DU CONTEXTE ---\n"

    user_content = f"""{context_block}

Question de l'utilisateur : {user_message}"""

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def _retrieve_context(user_message):
    model = _get_embedding_model()
    cache = _get_knowledge_cache()

    if not cache:
        return [], []

    query_embedding = model.encode(user_message).tolist()

    scored = []
    for entry in cache:
        sim = _cosine_similarity(query_embedding, entry['embedding'])
        scored.append((sim, entry))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:3]

    context_texts = []
    sources = []
    for score, entry in top:
        if score > 0.15:
            context_texts.append(entry['contenu'])
            sources.append({
                'titre': entry['titre'],
                'categorie': entry['categorie'],
                'score': round(float(score), 3),
            })

    return context_texts, sources


def _generate_response(user_message, context_texts):
    api_key = os.getenv('GROQ_API_KEY', '')
    if not api_key:
        return "La clé API GROQ n'est pas configurée. Veuillez contacter l'administrateur."

    from groq import Groq
    client = Groq(api_key=api_key)

    messages = _build_prompt(user_message, context_texts)

    chat_completion = client.chat.completions.create(
        messages=messages,
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        max_tokens=512,
        top_p=0.9,
    )

    return chat_completion.choices[0].message.content


class ChatView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_message = serializer.validated_data['message'].strip()

        if not user_message:
            return Response(
                {'detail': 'Le message ne peut pas être vide.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            context_texts, sources = _retrieve_context(user_message)
        except Exception as e:
            logger.error("Erreur retrieval context: %s", e)
            context_texts, sources = [], []

        try:
            response_text = _generate_response(user_message, context_texts)
        except Exception as e:
            logger.error("Erreur Groq API: %s", e)
            return Response(
                {
                    'response': "Désolé, je rencontre un problème technique. Veuillez réessayer dans quelques instants.",
                    'sources': [],
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                'response': response_text,
                'sources': sources,
            },
            status=status.HTTP_200_OK,
        )

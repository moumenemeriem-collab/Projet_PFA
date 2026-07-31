import json
import os
import logging

import numpy as np
from django.http import StreamingHttpResponse
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
_knowledge_matrix = None
_knowledge_ids = None

GROQ_MODEL = 'llama-3.1-8b-instant'
GROQ_MAX_TOKENS = 256


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


def _get_knowledge_matrix():
    global _knowledge_matrix, _knowledge_ids
    if _knowledge_matrix is None:
        cache = _get_knowledge_cache()
        vectors = []
        ids = []
        for entry in cache:
            vec = np.asarray(entry['embedding'], dtype=np.float32)
            norm = np.linalg.norm(vec)
            if norm == 0:
                continue
            vectors.append(vec / norm)
            ids.append(entry['id'])
        _knowledge_matrix = np.vstack(vectors) if vectors else np.zeros((0, 0), dtype=np.float32)
        _knowledge_ids = ids
    return _knowledge_matrix


def _build_prompt(user_message, context_texts, history=None):
    context_block = ""
    if context_texts:
        context_block = "\n\n--- CONTEXTE (extraits pertinents) ---\n"
        for i, text in enumerate(context_texts, 1):
            context_block += f"\n[{i}] {text}\n"
        context_block += "--- FIN DU CONTEXTE ---\n"

    user_content = f"""{context_block}

Question de l'utilisateur : {user_message}"""

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        for item in history[-10:]:
            role = item.get('role')
            if role in ('user', 'assistant'):
                messages.append({
                    "role": role,
                    "content": str(item.get('content', ''))[:1500],
                })
    messages.append({"role": "user", "content": user_content})
    return messages


def _retrieve_context(user_message):
    cache = _get_knowledge_cache()
    matrix = _get_knowledge_matrix()

    if not cache or matrix.shape[0] == 0:
        return [], []

    model = _get_embedding_model()
    query = np.asarray(model.encode(user_message), dtype=np.float32)
    query_norm = np.linalg.norm(query)
    if query_norm == 0:
        return [], []
    query = query / query_norm

    scores = matrix @ query
    top_indices = np.argsort(scores)[::-1][:3]

    entry_by_id = {e['id']: e for e in cache}
    context_texts = []
    sources = []
    for idx in top_indices:
        score = float(scores[idx])
        if score > 0.15:
            entry = entry_by_id.get(_knowledge_ids[idx])
            if entry is None:
                continue
            context_texts.append(entry['contenu'])
            sources.append({
                'titre': entry['titre'],
                'categorie': entry['categorie'],
                'score': round(score, 3),
            })

    return context_texts, sources


def _stream_response(user_message, context_texts, history=None):
    api_key = os.getenv('GROQ_API_KEY', '')
    if not api_key:
        yield json.dumps({
            'type': 'error',
            'message': "La clé API GROQ n'est pas configurée. Veuillez contacter l'administrateur.",
        }, ensure_ascii=False)
        return

    from groq import Groq
    client = Groq(api_key=api_key)
    messages = _build_prompt(user_message, context_texts, history)

    try:
        stream = client.chat.completions.create(
            messages=messages,
            model=GROQ_MODEL,
            temperature=0.3,
            max_tokens=GROQ_MAX_TOKENS,
            top_p=0.9,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield json.dumps({'type': 'token', 'text': delta}, ensure_ascii=False)
    except Exception as e:
        logger.error("Erreur Groq API: %s", e)
        yield json.dumps({
            'type': 'error',
            'message': "Désolé, je rencontre un problème technique. Veuillez réessayer dans quelques instants.",
        }, ensure_ascii=False)


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

        history = serializer.validated_data.get('history', [])

        def event_stream():
            for chunk in _stream_response(user_message, context_texts, history):
                yield f"data: {chunk}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'sources': sources}, ensure_ascii=False)}\n\n"

        return StreamingHttpResponse(event_stream(), content_type='text/event-stream')

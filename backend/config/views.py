from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponseNotFound
from django.views.static import serve as static_serve


def spa_index(request):
    """Sert l'application React (SPA) buildée : fichiers réels ou index.html pour le routing client."""
    dist = Path(getattr(settings, 'FRONTEND_DIST_DIR', settings.BASE_DIR / 'frontend_dist')).resolve()
    index = dist / 'index.html'

    rel = request.path.lstrip('/')
    if rel:
        target = (dist / rel).resolve()
        if target == dist or dist in target.parents:
            if target.is_file():
                return FileResponse(target.open('rb'))

    if index.is_file():
        return FileResponse(index.open('rb'))

    return HttpResponseNotFound('Frontend non buildé. Lancez "npm run build" puis collectstatic.')


def media_serve(request, path):
    return static_serve(request, path, document_root=settings.MEDIA_ROOT)

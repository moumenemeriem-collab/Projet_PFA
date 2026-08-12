"""Vues de statistiques et tableau de bord administrateur."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin

from .stats import build_api_response, get_dashboard_stats


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        stats = get_dashboard_stats()
        return Response(build_api_response(stats))

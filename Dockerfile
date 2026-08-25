# Stage 1 : compilation du frontend React/Vite
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2 : backend Django + API
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings
WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgdal-dev gdal-bin libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir GDAL==$(gdal-config --version)
COPY backend/ ./
COPY data/ /app/data/
COPY --from=frontend /app/frontend/dist ./frontend_dist
RUN chmod +x entrypoint.sh
EXPOSE 8000
CMD ["./entrypoint.sh"]

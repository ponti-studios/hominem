FROM pgvector/pgvector:pg18@sha256:b48c110f4911eb3d73ba7b6bd8964a5f26be740c2d580158530471c3c0f66487

LABEL org.opencontainers.image.description="PostgreSQL 18 with pgvector, PostGIS, and pgRouting"

RUN apt-get update && apt-get install -y --no-install-recommends \
    "postgresql-18-postgis-3=3.6.2*" \
    postgresql-18-pgrouting \
    && rm -rf /var/lib/apt/lists/*

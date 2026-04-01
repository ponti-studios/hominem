FROM pgvector/pgvector:0.8.2-pg18

LABEL org.opencontainers.image.description="PostgreSQL 18 with pgvector, PostGIS, and pgRouting"

RUN apt-get update && apt-get install -y --no-install-recommends \
    "postgresql-18-postgis-3=3.6.2*" \
    postgresql-18-pgrouting \
    && rm -rf /var/lib/apt/lists/*

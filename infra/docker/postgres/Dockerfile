FROM pgvector/pgvector:pg18

RUN apt-get update && apt-get install -y \
    postgresql-18-postgis-3 \
    postgresql-18-pgrouting \
    && rm -rf /var/lib/apt/lists/*

FROM pgvector/pgvector:pg18

# Install PostGIS and pgrouting
RUN apt-get update && apt-get install -y \
    postgresql-18-postgis-3 \
    postgresql-18-pgrouting \
    && rm -rf /var/lib/apt/lists/*

COPY infra/docker/postgres/init-extensions.sh /docker-entrypoint-initdb.d/init-extensions.sh

RUN chmod +x /docker-entrypoint-initdb.d/init-extensions.sh

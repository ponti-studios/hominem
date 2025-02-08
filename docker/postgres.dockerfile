FROM postgres:latest

# postgis	Spatial database extension for geographic objects.
# pgrouting	Routing and network analysis on PostGIS.
# postgis_tiger_geocoder	Geocoding extension for address standardization.
# hstore	Key-value store within a single column.
# uuid-ossp	Generates universally unique identifiers (UUIDs).
# pgcrypto	Provides cryptographic functions.
# btree_gin	GIN indexing support for B-tree columns.
# btree_gist	GiST indexing for B-tree structures.
# fuzzystrmatch	String similarity matching (e.g., Levenshtein).
# unaccent	Removes accents from text (useful for searches).
# intarray	Optimized handling of integer arrays.
# cube	Multidimensional cube datatype support.
# earthdistance	Calculate great-circle distances between points.
RUN apt-get update && apt-get install -y \
    postgresql-${PG_MAJOR}-pgrouting \
    postgresql-${PG_MAJOR}-postgis-3 \
    postgresql-${PG_MAJOR}-postgis-3-scripts \
    postgis \
    gdal-bin \
    osm2pgsql \
    postgresql-${PG_MAJOR}-pgcrypto \
    postgresql-${PG_MAJOR}-uuid-ossp \
    postgresql-${PG_MAJOR}-fuzzystrmatch \
    postgresql-${PG_MAJOR}-unaccent \
    postgresql-${PG_MAJOR}-intarray \
    postgresql-${PG_MAJOR}-cube \
    postgresql-${PG_MAJOR}-btree-gin \
    postgresql-${PG_MAJOR}-btree-gist \
    postgresql-${PG_MAJOR}-earthdistance \
    && rm -rf /var/lib/apt/lists/*

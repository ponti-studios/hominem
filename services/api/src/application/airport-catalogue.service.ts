import { createHash, randomUUID } from 'node:crypto';

import { db, runInTransaction, sql } from '@hominem/db/core';
import type { TransactionHandle } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import { parse } from 'csv-parse/sync';

type AirportRow = Record<string, unknown>;
const OUR_AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

type OurAirportsRow = {
  id: string;
  type: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  iso_country: string;
  municipality: string;
  scheduled_service: string;
  iata_code: string;
  last_updated: string;
};

function parseOurAirports(csv: string) {
  const records: OurAirportsRow[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
  return records.flatMap((row) => {
    const sourceId = Number(row.id);
    if (!Number.isSafeInteger(sourceId) || !row.name || !row.type) return [];
    return [
      {
        sourceId,
        code: row.iata_code?.trim().toUpperCase() || null,
        name: row.name,
        city: row.municipality || null,
        country: row.iso_country || null,
        latitude: row.latitude_deg === '' ? null : Number(row.latitude_deg),
        longitude: row.longitude_deg === '' ? null : Number(row.longitude_deg),
        type: row.type,
        scheduledService: row.scheduled_service?.toLowerCase() === 'yes',
        sourceUpdatedAt: row.last_updated || null,
      },
    ];
  });
}

/** Refreshes the existing OurAirports feed into the reference layer atomically. */
export async function syncAirportCatalogue(
  fetcher: typeof fetch = fetch,
  options: { deactivateMissing?: boolean } = {},
) {
  const startedAt = new Date();
  let csv: string;
  let response: Response;
  let airports: ReturnType<typeof parseOurAirports>;
  try {
    response = await fetcher(OUR_AIRPORTS_URL);
    if (!response.ok) throw new Error(`airport_catalogue_download_failed:${response.status}`);
    csv = await response.text();
    airports = parseOurAirports(csv);
    if (airports.length < 1000)
      throw new Error(`airport_catalogue_feed_too_small:${airports.length}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`INSERT INTO app.travel_airport_reference_refresh_log
      (source_version,source_checksum,source_name,source_url,retrieved_at,status,error,completed_at)
      VALUES ('pending','pending','OurAirports',${OUR_AIRPORTS_URL},${startedAt},'failed',${message},now())`.execute(
      db,
    );
    throw error;
  }
  const checksum = createHash('sha256').update(csv).digest('hex');
  const version = response.headers.get('last-modified') ?? checksum;
  return runInTransaction(async (trx) => {
    const runId = randomUUID();
    await sql`INSERT INTO app.travel_airport_reference_refresh_log
      (id,source_version,source_checksum,source_name,source_url,retrieved_at,status,row_count,seen_count)
      VALUES (${runId},${version},${checksum},'OurAirports',${OUR_AIRPORTS_URL},${startedAt},'running',${airports.length},${airports.length})`.execute(
      trx,
    );
    await sql`CREATE TEMP TABLE incoming_airports (
      source_id bigint PRIMARY KEY, code text, name text NOT NULL, city text, country text,
      latitude double precision, longitude double precision, type text NOT NULL,
      scheduled_service boolean NOT NULL, source_updated_at timestamptz
    ) ON COMMIT DROP`.execute(trx);
    for (let offset = 0; offset < airports.length; offset += 500) {
      const batch = airports.slice(offset, offset + 500);
      const rows = batch.map(
        (airport) =>
          sql`(${airport.sourceId},${airport.code},${airport.name},${airport.city},${airport.country},${airport.latitude},${airport.longitude},${airport.type},${airport.scheduledService},${airport.sourceUpdatedAt})`,
      );
      await sql`INSERT INTO incoming_airports (source_id,code,name,city,country,latitude,longitude,type,scheduled_service,source_updated_at) VALUES ${sql.join(rows)} ON CONFLICT (source_id) DO NOTHING`.execute(
        trx,
      );
    }
    const insertedResult = await sql<{ count: number }>`WITH inserted AS (
      INSERT INTO app.travel_airport_reference (source_id,code,name,city,country,latitude,longitude,type,scheduled_service,source_updated_at,active,missing_from_source,synced_at)
      SELECT source_id,code,name,city,country,latitude,longitude,type,scheduled_service,source_updated_at,true,false,now() FROM incoming_airports
      ON CONFLICT (source_id) DO NOTHING RETURNING 1
    ) SELECT count(*)::int AS count FROM inserted`.execute(trx);
    const updatedResult = await sql<{ count: number }>`WITH updated AS (
      UPDATE app.travel_airport_reference target SET
        code=source.code,name=source.name,city=source.city,country=source.country,
        latitude=source.latitude,longitude=source.longitude,type=source.type,
        scheduled_service=source.scheduled_service,source_updated_at=source.source_updated_at,
        active=true,missing_from_source=false,synced_at=now(),updated_at=now()
      FROM incoming_airports source WHERE target.source_id=source.source_id AND (
        target.code,target.name,target.city,target.country,target.latitude,target.longitude,target.type,
        target.scheduled_service,target.source_updated_at,target.active,target.missing_from_source
      ) IS DISTINCT FROM (
        source.code,source.name,source.city,source.country,source.latitude,source.longitude,source.type,
        source.scheduled_service,source.source_updated_at,true,false
      ) RETURNING 1
    ) SELECT count(*)::int AS count FROM updated`.execute(trx);
    let missingCount = 0;
    if (options.deactivateMissing !== false) {
      const missing = await sql<{ count: number }>`WITH changed AS (
        UPDATE app.travel_airport_reference target SET missing_from_source=true,active=false,updated_at=now()
        WHERE NOT EXISTS (SELECT 1 FROM incoming_airports source WHERE source.source_id=target.source_id)
          AND NOT target.missing_from_source RETURNING 1
      ) SELECT count(*)::int AS count FROM changed`.execute(trx);
      missingCount = Number(missing.rows[0]?.count ?? 0);
    }
    const inserted = Number(insertedResult.rows[0]?.count ?? 0);
    const updated = Number(updatedResult.rows[0]?.count ?? 0);
    await sql`UPDATE app.travel_airport_reference_refresh_log SET status='succeeded',completed_at=now(),
      inserted_count=${inserted},updated_count=${updated},deactivated_count=${missingCount},
      missing_flagged_count=${missingCount},unchanged_count=${airports.length - inserted - updated},
      missing_codes=(SELECT coalesce(jsonb_agg(code),'[]'::jsonb) FROM app.travel_airport_reference WHERE missing_from_source)
      WHERE id=${runId}`.execute(trx);
    return {
      runId,
      seen: airports.length,
      inserted,
      updated,
      deactivated: missingCount,
      checksum,
      version,
    };
  });
}
type AirportSelection = {
  id: string | null;
  curationId: string | null;
  code: string;
  name: string | null;
  city: string | null;
  country: string | null;
  type: string | null;
  latitude: number | null;
  longitude: number | null;
  servesPlace: string | null;
  notes: string | null;
  inReference: boolean;
  curated: boolean;
  legCount: number;
  referenceId: string | null;
  sourceId: string | null;
  scheduledService: boolean;
  active: boolean;
  missingFromSource: boolean;
  standalone: boolean;
};

const upperCode = (code: string) => code.trim().toUpperCase();
const stringValue = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const numberValue = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const referenceRank = `
  CASE
    WHEN scheduled_service THEN 0
    WHEN lower(type) IN ('large_airport', 'medium_airport') THEN 1
    WHEN lower(type) IN ('small_airport', 'closed') THEN 2
    WHEN lower(type) IN ('heliport', 'seaplane_base') THEN 3
    ELSE 4
  END,
  CASE WHEN lower(type) = 'closed' OR NOT active THEN 1 ELSE 0 END,
  source_id`;

async function selectAirport(
  trx: TransactionHandle,
  owner: string,
  code: string,
  preferredReferenceId?: string | null,
) {
  const normalized = upperCode(code);
  const [curated, reference] = await Promise.all([
    sql<AirportRow>`SELECT id, code, name, serves_place AS "servesPlace", city, country, notes, latitude, longitude, reference_airport_id AS "referenceId", standalone FROM app.travel_airports WHERE owner_userid=${owner} AND code=${normalized} LIMIT 1`.execute(
      trx,
    ),
    sql<AirportRow>`SELECT id, source_id AS "sourceId", code, name, city, country, latitude, longitude, type, scheduled_service AS "scheduledService", active, missing_from_source AS "missingFromSource" FROM app.travel_airport_reference WHERE upper(code)=${normalized} ORDER BY ${sql.raw(referenceRank)} LIMIT 20`.execute(
      trx,
    ),
  ]);
  const curation = curated.rows[0];
  const refs = reference.rows;
  const pinId = curation?.referenceId ?? preferredReferenceId;
  const pinned = pinId ? refs.find((item) => String(item.id) === String(pinId)) : undefined;
  const picked = curation?.standalone ? undefined : (pinned ?? refs[0]);
  const referenced = await sql<{
    count: number;
  }>`SELECT count(*) AS count FROM app.travel_transport WHERE owner_userid=${owner} AND (origin=${normalized} OR destination=${normalized})`.execute(
    trx,
  );
  if (!curation && !picked && Number(referenced.rows[0]?.count ?? 0) === 0) return null;
  return {
    id: curation ? String(curation.id) : null,
    curationId: curation ? String(curation.id) : null,
    code: normalized,
    name: stringValue(curation?.standalone ? curation.name : (picked?.name ?? curation?.name)),
    city: stringValue(curation?.standalone ? curation.city : (picked?.city ?? curation?.city)),
    country: stringValue(
      curation?.standalone ? curation.country : (picked?.country ?? curation?.country),
    ),
    type: curation?.standalone ? 'station' : stringValue(picked?.type),
    latitude: numberValue(curation?.latitude ?? picked?.latitude),
    longitude: numberValue(curation?.longitude ?? picked?.longitude),
    servesPlace: stringValue(curation?.servesPlace ?? picked?.city ?? curation?.city),
    notes: stringValue(curation?.notes),
    inReference: Boolean(picked),
    curated: Boolean(curation),
    legCount: Number(referenced.rows[0]?.count ?? 0),
    referenceId: picked ? String(picked.id) : null,
    sourceId: picked ? String(picked.sourceId) : null,
    scheduledService: Boolean(picked?.scheduledService),
    active: Boolean(picked?.active),
    missingFromSource: Boolean(picked?.missingFromSource),
    standalone: Boolean(curation?.standalone),
  } satisfies AirportSelection;
}

export async function resolveAirportSelection(
  trx: TransactionHandle,
  owner: string,
  selection: { code: string; referenceId?: string | null },
) {
  const airport = await selectAirport(trx, owner, selection.code, selection.referenceId);
  return airport
    ? {
        ...airport,
        airport: {
          id: airport.referenceId,
          name: airport.name,
          city: airport.city,
          country: airport.country,
          latitude: airport.latitude,
          longitude: airport.longitude,
        },
      }
    : null;
}

export async function getTravelAirport(owner: string, code: string, referenceId?: string | null) {
  return runInTransaction((trx) => selectAirport(trx, owner, code, referenceId));
}

export async function listTravelAirports(
  owner: string,
  input: { query?: string; country?: string; limit: number; offset: number },
) {
  const query = input.query?.trim() ?? '';
  const country = input.country?.trim().toUpperCase() ?? null;
  const pattern = `%${query}%`;
  const prefix = `${query}%`;
  const code = upperCode(query);
  const result = await sql<AirportRow>`
    WITH codes AS (
      SELECT code FROM app.travel_airport_reference WHERE code IS NOT NULL
        AND (${query} = '' OR upper(code) = ${code} OR upper(code) LIKE upper(${prefix}) OR name ILIKE ${pattern} OR city ILIKE ${pattern})
      UNION
      SELECT code FROM app.travel_airports WHERE owner_userid=${owner}
        AND (${query} = '' OR upper(code) = ${code} OR upper(code) LIKE upper(${prefix}) OR coalesce(name,'') ILIKE ${pattern} OR coalesce(city,'') ILIKE ${pattern})
      UNION
      SELECT origin AS code FROM app.travel_transport WHERE owner_userid=${owner}
        AND (${query} = '' OR upper(origin) = ${code} OR upper(origin) LIKE upper(${prefix}))
      UNION
      SELECT destination AS code FROM app.travel_transport WHERE owner_userid=${owner}
        AND (${query} = '' OR upper(destination) = ${code} OR upper(destination) LIKE upper(${prefix}))
    ), working AS (
      SELECT c.code,
        curated.id AS "curationId", curated.name AS "curatedName", curated.city AS "curatedCity",
        curated.country AS "curatedCountry", curated.serves_place AS "servesPlace",
        curated.notes, curated.latitude AS "latitudePin", curated.longitude AS "longitudePin",
        curated.reference_airport_id AS "referenceId", curated.standalone,
        ref.id AS "pickedReferenceId", ref.source_id AS "sourceId", ref.name AS "referenceName", ref.city AS "referenceCity",
        ref.country AS "referenceCountry", ref.latitude AS "referenceLatitude",
        ref.longitude AS "referenceLongitude", ref.type AS "referenceType",
        ref.scheduled_service AS "scheduledService", ref.active,
        ref.missing_from_source AS "missingFromSource",
        EXISTS (SELECT 1 FROM app.travel_transport t WHERE t.owner_userid=${owner} AND (t.origin=c.code OR t.destination=c.code)) AS "legReferenced"
      FROM codes c
      LEFT JOIN app.travel_airports curated ON curated.owner_userid=${owner} AND curated.code=c.code
      LEFT JOIN LATERAL (
        SELECT a.id,a.source_id,a.name,a.city,a.country,a.latitude,a.longitude,a.type,
          a.scheduled_service,a.active,a.missing_from_source
        FROM app.travel_airport_reference a WHERE upper(a.code)=upper(c.code)
          AND (curated.reference_airport_id IS NULL OR a.id=curated.reference_airport_id)
        ORDER BY ${sql.raw(referenceRank)} LIMIT 1
      ) ref ON NOT coalesce(curated.standalone,false)
      WHERE (${country}::text IS NULL OR coalesce(curated.country, ref.country, '')=${country})
        AND (${query} <> '' OR curated.id IS NOT NULL OR EXISTS (
          SELECT 1 FROM app.travel_transport t WHERE t.owner_userid=${owner} AND (t.origin=c.code OR t.destination=c.code)
        ))
        AND (${query} = '' OR ref.id IS NOT NULL OR curated.id IS NOT NULL OR EXISTS (
          SELECT 1 FROM app.travel_transport t WHERE t.owner_userid=${owner} AND (t.origin=c.code OR t.destination=c.code)
        ))
    )
    SELECT code, "pickedReferenceId" AS id, "curationId" AS "curationId",
      coalesce("referenceId","pickedReferenceId") AS "referenceId", "sourceId",
      coalesce("curatedName","referenceName") AS name,
      coalesce("servesPlace","referenceCity","curatedCity") AS "servesPlace",
      coalesce("curatedCity","referenceCity") AS city,
      coalesce("curatedCountry","referenceCountry") AS country,
      coalesce("latitudePin","referenceLatitude") AS latitude,
      coalesce("longitudePin","referenceLongitude") AS longitude,
      coalesce("referenceType",CASE WHEN standalone THEN 'station' END) AS type,
      ("curationId" IS NOT NULL) AS curated, "legReferenced", ("pickedReferenceId" IS NOT NULL) AS "inReference",
      coalesce("scheduledService",false) AS "scheduledService", coalesce(active,false) AS active,
      coalesce("missingFromSource",false) AS "missingFromSource",
      (SELECT count(*) FROM app.travel_transport t WHERE t.owner_userid=${owner} AND (t.origin=working.code OR t.destination=working.code)) AS "legCount",
      count(*) OVER () AS total
    FROM working
    WHERE (${query} = '' OR upper(code) = ${code} OR upper(code) LIKE upper(${prefix}) OR coalesce("referenceName","curatedName",'') ILIKE ${pattern} OR coalesce("referenceCity","curatedCity",'') ILIKE ${pattern})
    ORDER BY CASE WHEN upper(code)=${code} THEN 0 WHEN upper(code) LIKE upper(${prefix}) THEN 1 ELSE 2 END,
      coalesce("scheduledService",false) DESC, code
    LIMIT ${input.limit} OFFSET ${input.offset}
  `.execute(db);
  return {
    airports: result.rows,
    total: Number(result.rows[0]?.total ?? 0),
    limit: input.limit,
    offset: input.offset,
    truncated: input.offset + result.rows.length < Number(result.rows[0]?.total ?? 0),
  };
}

export async function updateTravelAirportCuration(
  owner: string,
  input: {
    code: string;
    servesPlace?: string | null;
    notes?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    unpin?: Array<'latitude' | 'longitude'>;
    name?: string;
    city?: string;
    country?: string;
  },
) {
  return runInTransaction(async (trx) => {
    const code = upperCode(input.code);
    if (input.servesPlace != null) {
      const place =
        await sql`SELECT 1 FROM app.places WHERE owner_userid=${owner} AND lower(name)=lower(${input.servesPlace}) LIMIT 1`.execute(
          trx,
        );
      if (!place.rows.length) throw new ValidationError('unknown_place');
    }
    const current =
      await sql<AirportRow>`SELECT * FROM app.travel_airports WHERE owner_userid=${owner} AND code=${code} FOR UPDATE`.execute(
        trx,
      );
    const reference =
      await sql<AirportRow>`SELECT id, name, city, country, latitude, longitude FROM app.travel_airport_reference WHERE upper(code)=${code} ORDER BY ${sql.raw(referenceRank)} LIMIT 1`.execute(
        trx,
      );
    const existing = current.rows[0];
    const ref = reference.rows[0];
    if (!existing && !ref) {
      if (
        !input.name ||
        !input.city ||
        !input.country ||
        input.latitude == null ||
        input.longitude == null
      )
        throw new ValidationError('standalone_airport_requires_name_city_country_coordinates');
    }
    const patch: AirportRow = {
      owner_userid: owner,
      code,
      ...(input.servesPlace !== undefined ? { serves_place: input.servesPlace } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(existing?.standalone && input.name !== undefined ? { name: input.name } : {}),
      ...(existing?.standalone && input.city !== undefined ? { city: input.city } : {}),
      ...(existing?.standalone && input.country !== undefined ? { country: input.country } : {}),
      ...(!ref &&
      existing &&
      input.name &&
      input.city &&
      input.country &&
      input.latitude != null &&
      input.longitude != null
        ? { standalone: true, name: input.name, city: input.city, country: input.country }
        : {}),
      ...(existing
        ? {}
        : ref
          ? { reference_airport_id: ref.id }
          : {
              standalone: true,
              name: input.name,
              city: input.city,
              country: input.country,
              latitude: input.latitude,
              longitude: input.longitude,
            }),
    };
    if (input.unpin?.includes('latitude')) patch.latitude = null;
    if (input.unpin?.includes('longitude')) patch.longitude = null;
    if (existing) {
      const assignments = Object.entries(patch)
        .filter(([key]) => key !== 'owner_userid' && key !== 'code')
        .map(([key, value]) => sql`${sql.ref(key)}=${value}`);
      if (assignments.length)
        await sql`UPDATE app.travel_airports SET ${sql.join(assignments)} WHERE owner_userid=${owner} AND code=${code}`.execute(
          trx,
        );
    } else {
      const fields = { id: randomUUID(), ...patch, standalone: Boolean(!ref) };
      const columns = Object.keys(fields);
      await sql`INSERT INTO app.travel_airports (${sql.join(columns.map((key) => sql.ref(key)))} ) VALUES (${sql.join(Object.values(fields).map((value) => sql.val(value)))})`.execute(
        trx,
      );
    }
    return selectAirport(trx, owner, code);
  });
}

export async function getAirportReferenceProvenance() {
  const result =
    await sql<AirportRow>`SELECT source_name AS "sourceName", source_url AS "sourceUrl", retrieved_at AS "retrievedAt", row_count AS "rowCount" FROM app.travel_airport_reference_refresh_log ORDER BY started_at DESC LIMIT 1`.execute(
      db,
    );
  return result.rows[0] ?? { sourceName: null, sourceUrl: null, retrievedAt: null, rowCount: 0 };
}

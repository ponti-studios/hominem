import { db, sql } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

const HISTORY_TABLE: Record<string, string> = {
  journey: 'travel_journeys',
  segment: 'travel_journey_segments',
  transport: 'travel_transport',
  stay: 'travel_stays',
  place: 'travel_places',
  airport: 'travel_airports',
  idea: 'travel_ideas',
  residence: 'travel_residences',
};
const TABLES = [
  'travel_journeys',
  'travel_journey_segments',
  'travel_transport',
  'travel_stays',
  'travel_airports',
  'travel_ideas',
] as const;
type Row = Record<string, unknown>;
const camel = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_all, letter: string) => letter.toUpperCase()),
      value,
    ]),
  );

export async function travelEntityHistory(
  owner: string,
  input: { entityType: string; id: string; limit: number },
) {
  const entityTable = HISTORY_TABLE[input.entityType];
  if (!entityTable) throw new ValidationError('invalid_entity_type');
  if (input.entityType === 'residence') {
    const rows = await sql<Record<string, unknown>>`
      SELECT history.* FROM (
        SELECT id, owner_userid, entity_table, entity_id, operation, changed_fields, snapshot, created_at
        FROM app.place_entity_history
        WHERE owner_userid = ${owner} AND (
          (entity_table = 'place_residences' AND entity_id = ${input.id}) OR
          (entity_table = 'place_residence_periods' AND snapshot ->> 'residence_id' = ${input.id})
        )
        UNION ALL
        SELECT id, owner_userid, entity_table, entity_id, operation, changed_fields, snapshot, created_at
        FROM app.travel_entity_history
        WHERE owner_userid = ${owner} AND entity_table = 'travel_residences' AND entity_id = ${input.id}
      ) history
      ORDER BY created_at DESC LIMIT ${input.limit}
    `.execute(db);
    return { history: rows.rows.map(camel), count: rows.rows.length };
  }
  if (input.entityType === 'place') {
    const rows = await sql<Record<string, unknown>>`
      SELECT history.* FROM (
        SELECT id, owner_userid, entity_table, entity_id, operation, changed_fields, snapshot, created_at
        FROM app.place_entity_history
        WHERE owner_userid = ${owner} AND entity_table = 'places' AND entity_id = ${input.id}
        UNION ALL
        SELECT id, owner_userid, entity_table, entity_id, operation, changed_fields, snapshot, created_at
        FROM app.travel_entity_history
        WHERE owner_userid = ${owner} AND entity_table = 'travel_places' AND entity_id = ${input.id}
      ) history
      ORDER BY created_at DESC LIMIT ${input.limit}
    `.execute(db);
    return { history: rows.rows.map(camel), count: rows.rows.length };
  }
  const rows = await sql<Record<string, unknown>>`
    SELECT * FROM app.travel_entity_history
    WHERE owner_userid = ${owner} AND entity_table = ${entityTable} AND entity_id = ${input.id}
    ORDER BY created_at DESC LIMIT ${input.limit}
  `.execute(db);
  return { history: rows.rows.map(camel), count: rows.rows.length };
}

export async function travelExport(owner: string) {
  const rows = await Promise.all(
    TABLES.map(async (name) => {
      const result = await sql<
        Record<string, unknown>
      >`SELECT * FROM ${sql.raw(`app.${name}`)} WHERE owner_userid = ${owner} ORDER BY created_at, id`.execute(
        db,
      );
      return [name, result.rows.map(camel)] as const;
    }),
  );
  const canonicalPlaces = await sql<Row>`
    SELECT p.id, p.name, p.name AS place, p.place_type, p.place_type AS type,
      p.formatted_address, p.city, p.state, p.postal_code, p.country, p.country_code,
      p.latitude, p.longitude, p.url, p.geocoded_at, p.metadata, p.first_visited,
      p.last_visited, p.notes, p.createdat, p.updatedat,
      coalesce(t.want_to_go, false) AS want_to_go,
      coalesce(t.archived, false) AS archived, (t.place_id IS NOT NULL) AS travel_relationship
    FROM app.places p
    LEFT JOIN app.travel_places t ON t.place_id=p.id AND t.owner_userid=p.owner_userid
    WHERE p.owner_userid=${owner} AND (
      t.place_id IS NOT NULL OR EXISTS (SELECT 1 FROM app.travel_journey_segments s WHERE s.owner_userid=p.owner_userid AND s.place_id=p.id)
      OR EXISTS (SELECT 1 FROM app.place_residences r WHERE r.owner_userid=p.owner_userid AND r.place_id=p.id)
    ) ORDER BY p.createdat, p.id
  `.execute(db);
  const residences = await sql<Row>`
    SELECT r.id, r.owner_userid, r.place_id, r.notes, r.created_at, r.updated_at,
      coalesce(jsonb_agg(jsonb_build_object('id', rp.id, 'startDate', rp.start_date, 'endDate', rp.end_date,
        'ongoing', rp.ongoing, 'precision', rp.precision, 'note', rp.note)
        ORDER BY rp.start_date, rp.id) FILTER (WHERE rp.id IS NOT NULL), '[]'::jsonb) AS periods
    FROM app.place_residences r LEFT JOIN app.place_residence_periods rp
      ON rp.residence_id=r.id AND rp.owner_userid=r.owner_userid
    WHERE r.owner_userid=${owner} GROUP BY r.id ORDER BY r.created_at, r.id
  `.execute(db);
  const native: Record<string, Row[]> = {
    ...Object.fromEntries(rows),
    places: canonicalPlaces.rows,
    place_residences: residences.rows,
  };
  const provenance =
    await sql<Row>`SELECT source_name AS "sourceName", source_version AS "sourceVersion",
    retrieved_at AS "retrievedAt", row_count AS "rowCount"
    FROM app.travel_airport_reference_refresh_log ORDER BY started_at DESC LIMIT 1`.execute(db);
  return { format: 'native', entities: native, airportReference: provenance.rows[0] ?? null };
}

# Library sync contract (Still ↔ Hominem)

How clients keep an on-device library cache converged with Hominem. The
cache never invents data: Hominem is the source of truth.

## Pull

Every library list endpoint speaks two shapes, selected by `since`:

- **Full pull** (no `since`): all rows, current shape, byte-stable. Use for
  first sync, sign-in, and recovery.
- **Delta pull** (`since=<serverTime>`): rows with `updatedAt`/`createdAt`
  after `since`, plus `tombstones`, plus `serverTime`. The caller stores
  `serverTime` as the next cursor.

Endpoints: `GET /api/possessions`, `GET /api/possessions/containers`,
`GET /api/collections`, `GET /api/collections/membership`. `since` must be
an ISO-8601 datetime with offset; anything else is a 400. Cursors come
from the database clock (`serverTime`), never the device clock.

## Tombstones

Deletes are hard deletes, so removals are recorded in `app.sync_tombstones`
in the same transaction as the delete. A tombstone is:

```json
{ "entity": "possession|container|collection|collectionItem",
  "entityId": "<uuid>", "collectionId": "<uuid>|null",
  "deletedAt": "<iso>" }
```

Rules:

- `collectionId: null` — the entity itself was deleted.
- `collectionItem` — a membership link was removed; the entity lives on.
- Deleting a collection tombstones the collection; its links vanish by FK
  cascade and clients drop them with the collection.
- Deleting a possession leaves orphan links behind (no FK); clients drop
  links pointing at a tombstoned id.
- Tombstones are recorded under the acting user's id. Delta sync is exact
  for that user; other viewers of shared collections see deletes on their
  next full pull. First sync after sign-in, invite acceptance, or an
  offline gap longer than comfortable is always a full pull.
- Tombstones are retained indefinitely (one row per delete). A retention
  prune is future work, not a correctness dependency: clients sync often.

## Push (writes)

Writes are ordinary REST mutations (create/update/delete), unchanged by
this contract. Semantics are **last-write-wins**: concurrent writes
serialize in Postgres and the last commit stands. There is deliberately
**no conflict detection and no rejection shape** in v1 — no versions,
no etags, no `409`. Every mutation response carries the row's `updatedAt`,
so clients can implement read-your-write.

Single-device clients cannot self-conflict: the outbox (see Still
`docs/cross-platform-merge.md`) serializes a device's writes, applies
them optimistically, and surfaces failures as notices with rollback —
never silent loss. Cross-device conflicts resolve to the last writer;
the screens show the converged state on the next pull.

## Client obligations

1. First sync is always full. Delta only advances a cursor from a full baseline.
2. Store `serverTime`, never `Date.now()`, as the next `since`.
3. Apply all four deltas (possessions, containers, collections,
   membership) before rendering; they are consistent only as a set.
4. On any delta failure, fall back to full pull. On 401, sign out.

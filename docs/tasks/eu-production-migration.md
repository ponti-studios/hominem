---
title: 'Move Hominem production workloads and customer data to Amsterdam'
status: 'Proposed'
priority: 'high'
labels: [operations, infrastructure]
depends_on: []
estimated_size: 'L'
---

## Outcome

Hominem production workloads and primary customer data run in Amsterdam (`ams`).
Control-plane metadata and Fly-managed snapshots may remain outside the EU as
accepted exceptions.

## Scope

Move PostgreSQL, Redis, object storage, API, worker, Web, Career, and Finance.
Keep SJC production resources available through the rollback period. The worker
must not consume the EU queue until its final sync is verified.

## Work sequence

| ID    | Work item                                                | Validation / artifact                                            | Done when                                  |
| ----- | -------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| W-001 | Provision EU data stores and copy current data           | DB metadata comparison, Redis key comparison, R2 checksum report | EU copies verified                         |
| W-002 | Add EU deployment configuration and controlled workflows | CI validation; workflow dispatch and target check                | EU release path targets only `ams` apps    |
| W-003 | Final synchronized data copy                             | Maintenance log; DB, Redis, R2 comparisons                       | Writes are paused and final copies match   |
| W-004 | Deploy EU services and verify core flows                 | Health, auth, API, queue and storage checks                      | All EU services pass before traffic switch |
| W-005 | Route production domains to EU and monitor               | DNS/certificate and live health evidence                         | Production traffic served from EU          |
| W-006 | Retire SJC after rollback period                         | No SJC customer data or workload remains                         | SJC resources safely decommissioned        |

## Current evidence

- EU PostgreSQL is running in `ams`, restored from a production snapshot and
  compared against production schema and migration metadata.
- EU Redis is running in `ams`; its existing snapshot was taken before the final
  queue synchronization and must not be consumed by the EU worker yet.
- Eight R2 objects were copied to an EU-jurisdiction bucket and checksums were
  verified. Repeat the sync after writes are paused.
- Private EU API and frontend machines are running and have been smoke-checked.
- Production traffic remains in SJC.

## Acceptance criteria

- [ ] AC-001: Final PostgreSQL, Redis, and R2 copies are synchronized during a
      documented write pause.
- [ ] AC-002: EU services use EU database, queue, and object storage endpoints.
- [ ] AC-003: Login, primary API flows, worker queue processing, and uploads work
      against EU services.
- [ ] AC-004: Production domains resolve to the EU deployment and pass health
      checks.
- [ ] AC-005: Rollback resources and recovery steps are verified before SJC
      retirement.

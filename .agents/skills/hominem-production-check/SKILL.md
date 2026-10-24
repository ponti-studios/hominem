---
name: hominem-production-check
description: Check the health of Hominem’s production Fly apps and public domains without mutating infrastructure. Use for production smoke checks, outage triage, or release verification.
---

# Hominem Production Check

Run this as a read-only check. Do not change variables, deployments, domains, service configuration, or source code.

From the Hominem repository, run:

```bash
.agents/skills/hominem-production-check/scripts/check-production.sh
```

The script uses the authenticated `fly` CLI (needs `fly auth login`). It reports every machine of each `hominem-*` app with its state and health checks, then probes each public domain with redirects disabled.

Expected public behavior:

- `api.ponti.io`, `career.ponti.io`, and `finance.ponti.io`: HTTP `200`.
- `omiro.ponti.io`: HTTP `302` with a `Location` beginning `https://api.ponti.io/login?`.
- `labs.ponti.io`, `ponti.io`, and `newsboy.ponti.io` are not Fly apps from this repo. The script prints them and warns on surprises (`ponti.io` `200`, `newsboy.ponti.io` `302` to `/reality`) but never fails on them.

Treat a `started` machine with `passing` checks (or no checks, for Redis and the database) as healthy. `omiro.ponti.io` is served by the `hominem-web` app. A redirect is not an outage when it matches the expected behavior above. Any unexpected status, malformed `Location`, missing domain response (including a domain that does not resolve), a machine in a state other than `started`, or a failing check is a failure requiring investigation.

Include the timestamp, failed apps or domains, and exact observed status/location in the report. This skill does not authorize remediation; ask separately before making production changes.

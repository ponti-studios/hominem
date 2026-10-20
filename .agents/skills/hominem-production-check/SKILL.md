---
name: hominem-production-check
description: Check the health of Hominem’s production Railway services and public domains without mutating infrastructure. Use for production smoke checks, outage triage, or release verification.
---

# Hominem Production Check

Run this as a read-only check. Do not change variables, deployments, domains, service configuration, or source code.

From the Hominem repository, run:

```bash
.agents/skills/hominem-production-check/scripts/check-production.sh
```

The script resolves the linked Railway project and production environment unless `--project` and `--environment` are supplied. It reports every production service’s latest deployment and replica state, then probes each public domain with redirects disabled.

Expected public behavior:

- `api.ponti.io`, `career.ponti.io`, `labs.ponti.io`, and `ponti.io`: HTTP `200`.
- `omiro.ponti.io`: HTTP `302` with a `Location` beginning `https://api.ponti.io/login?`.
- `newsboy.ponti.io`: HTTP `302` with `Location: /reality`.

Treat a `SUCCESS` or `SLEEPING` deployment with a `RUNNING` instance as healthy. A `SUCCESS` or `SLEEPING` deployment whose instance is `REMOVED` is an idle service, not an outage; the public-domain probes show whether it still wakes and serves (for example `newsboy.ponti.io`). `omiro.ponti.io` is served by the `web` service. A redirect is not an outage when it matches the expected behavior above. Any unexpected status, malformed `Location`, missing domain response (including a domain that does not resolve), failed deployment, or instance in a state other than `RUNNING` or `REMOVED` is a failure requiring investigation. The `finance` service is intentionally stopped (listed in `stopped_services` in the script, so it is reported as `STOPPED` rather than failed, and `finance.ponti.io` is not probed); `deploy-finance` is manual-only until it is restarted. Services without a public custom domain (`worker`, `Redis`, `database`, `public-data`, `nestcraft`) are covered by deployment and instance state only.

Include the timestamp, project/environment, failed services or domains, and exact observed status/location in the report. This skill does not authorize remediation; ask separately before making production changes.

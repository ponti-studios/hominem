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

- `api.ponti.io`, `career.ponti.io`, `finance.ponti.io`, `labs.ponti.io`, `still.ponti.io`, and `ponti.io`: HTTP `200`.
- `omiro.ponti.io`: HTTP `302` with a `Location` beginning `https://api.ponti.io/login?`.
- `what.ponti.io`: HTTP `302` with `Location: /reality`.

Treat a `SUCCESS` deployment with a `RUNNING` instance as healthy. A `SUCCESS` deployment whose instance is `REMOVED` is a stopped or sleeping service, not an outage; the public-domain probes show whether it still serves (for example `what.ponti.io`). `omiro.ponti.io` is served by the `web` service. A redirect is not an outage when it matches the expected behavior above. Any unexpected status, malformed `Location`, missing domain response (including a domain that does not resolve), failed deployment, or instance in a state other than `RUNNING` or `REMOVED` is a failure requiring investigation. Services without a public custom domain (`worker`, `Redis`, `database`, `public-data`, `nestcraft`) are covered by deployment and instance state only.

Include the timestamp, project/environment, failed services or domains, and exact observed status/location in the report. This skill does not authorize remediation; ask separately before making production changes.

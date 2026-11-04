---
name: hominem-production-check
description: Check the health of Hominem’s production Fly apps and public domains without mutating infrastructure. Use for production smoke checks, outage triage, or release verification.
---

# Hominem Production Check

Run this as a read-only check. Do not change variables, deployments, domains, service configuration, or source code.

The current read-only check procedure and expected app/domain inventory are in
the private Notion page **Hominem Production Operations (Private)**. Use the
GitHub `Production` environment values and that reference to run the check.
Include the timestamp, failed services/domains, machine states, and observed
status/location in the report. This skill does not authorize remediation; ask
separately before making production changes.

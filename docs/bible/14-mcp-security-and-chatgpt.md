# MCP security and ChatGPT

## Purpose

Define remote MCP as a secure, read-only external capability surface for Hominem.

## Canonical model

The Hominem API hosts authenticated Streamable HTTP MCP. Better Auth remains the identity authority. ChatGPT uses a distinct OAuth client, consent screen, revocable grants, per-tool scopes, audit logs, and rate limits.

## Invariants

Tools call application services only. Initial scopes are calendar, finance, notes, people, places, and provenance read access. Finance, health, communications, and artifacts are disabled unless explicitly consented; health and communications remain deferred for v1.

## Required AI evidence

Tools return minimal records, source freshness, and structured evidence. They do not return raw paths, credentials, event bodies, attachments, unrestricted messages, or generic data exports.

## Rejected models

- Stdio as the production remote transport.
- MCP mutation tools in v1.
- A shared OAuth client for first-party apps and ChatGPT.

## Implementation readiness

- [ ] Remote MCP uses authenticated Streamable HTTP on top of application services.
- [ ] OAuth consent maps to narrow domain scopes and is revocable.
- [ ] Tools expose capabilities, not tables, SQL, filesystems, imports, or raw artifacts.
- [ ] Tool outputs include evidence, freshness, sensitivity-aware redaction, and capped result sets.
- [ ] Tests include authenticated MCP discovery, tool invocation, scope denial, revocation, and multi-tool natural-language scenarios.
- [ ] Deferred: health, communications, raw artifacts, and all mutation tools.

## Open questions

None.

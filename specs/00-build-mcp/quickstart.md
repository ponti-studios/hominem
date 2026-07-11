# Quickstart: Build MCP

## Prerequisites

- Repository bootstrapped: `just setup`
- Local services running (Postgres, Redis): via Docker Compose
- `@modelcontextprotocol/sdk` installed in `services/api`
- pnpm workspace issue resolved (see [research.md](./research.md) for options)
- Database migrations applied: `just db-migrate`

## Setup

```bash
# 1. Install the MCP SDK dependency
cd services/api
pnpm add @modelcontextprotocol/sdk@^1.29.0

# 2. Create and apply the migration for new schema objects
#    (app.entities, app.entity_links, app.entity_attributes, app.ai_usage_events)
just db-migrate

# 3. Start the API in dev mode
just dev-api
```

## Validation Scenarios

### Scenario 1: MCP Server Discovery

Verify the server starts and reports capabilities.

```bash
# Send a tools/list request via the MCP transport
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <valid-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":"test-1"}'
```

**Expected outcome**: HTTP 200 with a JSON-RPC response containing the list of
registered tools (initially the Career and Omiro workspace tools).

### Scenario 2: Tool Invocation with Valid Scope

Invoke a tool with proper authorization.

```bash
# This requires a Better Auth session token with career:read scope
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <career-read-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"list_career_experiences",
      "arguments":{"limit":5}
    },
    "id":"test-2"
  }'
```

**Expected outcome**: HTTP 200 with tool result containing work experiences and
evidence array — no compensation fields, no raw provider payloads.

### Scenario 3: Scope Denial

Invoke a tool without the required scope.

```bash
# Token without career:read scope
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <no-career-scope-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"list_career_experiences",
      "arguments":{"limit":5}
    },
    "id":"test-3"
  }'
```

**Expected outcome**: HTTP 200 with JSON-RPC error `-32001` — "Scope denied:
career:read".

### Scenario 4: No Data Response

Query a tool that returns no matching data.

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <knowledge-read-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"search_knowledge_facts",
      "arguments":{"query":"nonexistent-topic"}
    },
    "id":"test-4"
  }'
```

**Expected outcome**: HTTP 200 with empty evidence array and text indicating no
matching records.

### Scenario 5: Result Cap Enforcement

Invoke a tool with more results than the cap.

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <knowledge-read-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"get_knowledge_notes",
      "arguments":{"limit":100}
    },
    "id":"test-5"
  }'
```

**Expected outcome**: HTTP 200 with at most 10 notes returned (the result cap)
and `isTruncated: true` if more than 10 exist.

## Running Tests

```bash
# Transport tests (discovery, invocation, denial, revocation, redaction)
cd services/api
pnpm run test -- -- mcp/transport

# Auth tests (scope denial, consent, revocation)
pnpm run test -- -- mcp/auth

# Redaction tests (evidence, no-data, result caps)
pnpm run test -- -- mcp/redaction

# LLM evaluation harness (full suite — may take several minutes)
pnpm run test -- -- mcp/evaluation

# Fast PR subset (deterministic tests only, no LLM eval)
pnpm run test -- -- mcp/transport mcp/auth mcp/redaction
```

## Reference

- [Spec](./spec.md) — Feature specification with user stories and requirements
- [Data Model](./data-model.md) — Entity schema and RLS policies
- [Contracts](./contracts/mcp-tool-contract.md) — MCP protocol contract
- [Research](./research.md) — Technology decisions and resolved unknowns

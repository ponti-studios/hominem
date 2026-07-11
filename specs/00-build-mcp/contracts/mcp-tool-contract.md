# MCP Tool Contract

## Overview

All MCP tools in the Hominem system follow this contract. Each tool is declared
once with runtime schemas, invoked through the authenticated Streamable HTTP
transport, and returns bounded typed responses.

## Transport

**Protocol**: MCP Streamable HTTP (JSON-RPC 2.0 over HTTP POST with SSE streaming)

**Endpoint**: `POST /api/mcp` (at `services/api`)

**Authentication**: Better Auth session (cookie) for web clients; Bearer token
for mobile; OAuth 2.0 client grant for ChatGPT

**Headers**:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Tool Declaration Schema

Every tool is registered via the SDK's `Server.tool()` method:

```typescript
type ToolDeclaration = {
  name: string;           // Unique tool name (e.g., "get_career_portfolio")
  description: string;    // Human-readable description
  inputSchema: ZodSchema; // Zod schema for input validation
  outputSchema: ZodSchema; // Zod schema for output (evidence)
  scope: string;          // Required scope (e.g., "career:read")
  sensitivity: 'standard' | 'sensitive' | 'highly_sensitive';
  resultCap: number;      // Maximum items returned (0 = no cap)
  auditEvent: string;     // Audit event type for logging
};
```

## Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_career_portfolio",
    "arguments": {
      "portfolio_slug": "chase-bridges"
    }
  },
  "id": "req-001"
}
```

## Response Format (Success)

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "... evidentiary response ..."
      }
    ],
    "evidence": [
      {
        "entity_id": "uuid",
        "domain": "career",
        "entity_type": "work_experience",
        "label": "Senior Engineer at Acme Corp",
        "source_timestamp": "2026-01-15T00:00:00Z",
        "confidence": 1.0
      }
    ],
    "isTruncated": false
  }
}
```

## Response Format (No Data)

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "No matching records found."
      }
    ],
    "evidence": [],
    "isTruncated": false
  }
}
```

## Response Format (Error)

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32001,
    "message": "Scope denied: career:read",
    "data": {
      "required_scope": "career:read",
      "granted_scopes": ["knowledge:read"]
    }
  }
}
```

## Evidence Conventions

Every tool response includes an `evidence` array with:

| Field | Type | Description |
|-------|------|-------------|
| `entity_id` | `uuid` | Canonical entity ID from `app.entities` or domain table |
| `domain` | `string` | Domain namespace (e.g., `career`, `knowledge`) |
| `entity_type` | `string` | Type within domain (e.g., `work_experience`, `note`) |
| `label` | `string` | User-visible label (e.g., "Senior Engineer at Acme Corp") |
| `source_timestamp` | `string` (ISO 8601) | When the source record was created/updated |
| `confidence` | `number` (0–1) | Confidence in the evidence (1.0 for deterministic, lower for AI-derived) |

**Exclusion rules**:
- No raw provider payloads (`provider_payload`)
- No storage paths, URLs, or credentials
- No full message bodies or unrestricted content dumps
- No database identifiers beyond the canonical entity ID
- No compensation, salary, or financial details without explicit scope

## Scope Enforcement

Tools check scope before invocation:

1. Resolve authenticated actor from Better Auth session/token
2. Check if actor has a grant covering the tool's declared scope
3. If no grant → return `-32001` scope denied error
4. If grant revoked → same as missing grant
5. If scope granted → proceed to tool invocation

## Result Capping

Tools enforce `resultCap` before returning:

1. Query service with requested parameters
2. Apply result cap: if results > cap, truncate and set `isTruncated: true`
3. Return bounded results with evidence array

## MCP v1 Tool List (initial)

| Tool Name | Scope | Sensitivity | Result Cap | Domain |
|-----------|-------|-------------|------------|--------|
| `get_career_portfolio` | `career:read` | standard | 1 | Career |
| `list_career_experiences` | `career:read` | standard | 20 | Career |
| `get_knowledge_notes` | `knowledge:read` | sensitive | 10 | Workspace |
| `search_knowledge_facts` | `knowledge:read` | sensitive | 10 | Workspace |

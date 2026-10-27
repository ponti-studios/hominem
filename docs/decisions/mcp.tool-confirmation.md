# MCP tool confirmation without elicitation

## Status

Accepted (2026-10-27)

## Decision

Confirmation for destructive MCP tools is enforced in one gate —
`createToolHandler` in `services/api/src/mcp/server.ts` — and every tool that
declares `requiresConfirmation` goes through it. The gate has two transports
and one safety bar:

1. **Elicitation-capable clients** (a 2026-07-28 request whose
   `clientCapabilities` declare `elicitation`) are asked interactively through
   multi-round-trip elicitation. This is unchanged.
2. **Every other client** — a 2025-era client such as a ChatGPT connector or
   the legacy Muse CLI, or a modern client that does not declare the
   capability — receives the tool's preview plus a confirmation token, as an
   `isError: true` tool result. Repeating the same call with
   `confirmToken: "<token>"` executes the action.

The token is minted by `confirmationCodec` (HMAC, `BETTER_AUTH_SECRET`-derived)
and bound to the tool, the method and the authenticated user, with the codec's
ten-minute TTL. It also freezes the arguments at mint time, so what executes is
exactly what the preview showed — a client cannot change the payload between
preview and confirmation. A token that does not verify (tampered, expired,
other user, other tool) is treated as no confirmation and falls through to a
fresh preview; it never executes anything.

`confirmToken` is declared on the input schema of every confirming tool, by
intersecting the tool's schema at registration rather than editing tools. Strict
clients validate the model's arguments against the advertised schema and drop
undeclared arguments, so an undeclared token would never reach the server.

## Consequences

- A client without elicitation can complete a destructive action; it costs one
  extra tool call, and the model drives it from an ordinary tool result.
- Adding `requiresConfirmation` to a tool is still a single declaration; there
  is no per-tool confirmation code to keep in sync, and no new tool may
  implement its own confirmation instead.
- The `iUnderstand: true` flags on the finance import/replace and travel
  maintenance tools remain their own contract — those tools' previews return
  `null` so the gate does not confirm on top of them. Do not copy that pattern
  for new delete tools; use the gate.
- An unconfirmed call never changes data, whichever transport the client has.

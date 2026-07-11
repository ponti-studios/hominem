# hominem-mcp

Claude Code plugin that connects to the Hominem API's MCP server (`services/api/src/mcp`), exposing its registered tools (career/portfolio, etc.) to Claude Code.

## Setup

Set the API's base URL before Claude Code loads this plugin:

```bash
export HOMINEM_API_URL="http://localhost:4040"   # or your deployed API URL
```

Authentication is handled by Claude Code itself, not by this plugin. The API exposes standard OAuth discovery endpoints (`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`) via Better-Auth's MCP plugin (see `services/api/src/mcp/routes.ts`). When Claude Code connects to the `hominem` server for the first time, it follows the discovery metadata and opens a browser login — no manually-obtained token required. Claude Code stores and refreshes the resulting token for you.

## Install locally

From the repo root:

```bash
just mcp-install-claude
```

This registers the `plugins/` directory as a local marketplace and installs `hominem-mcp` from it.

## What it provides

Just the MCP server connection (`hominem`) — no bundled skills or commands. Tools available depend on what's registered in `services/api/src/mcp/tools/` at request time.

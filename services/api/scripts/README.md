# MCP Evaluation Scripts

This directory contains explicit, service-dependent evaluations of the MCP
transport and language-model tool use. These evaluations are not part of the
API Vitest suite or the normal `just check api` command.

## Ollama

Prerequisites:

- Postgres is running with the test database on `127.0.0.1:5434`.
- Test migrations have been applied.
- Ollama is running at `OLLAMA_BASE_URL` (default `http://localhost:11434`).
- `OLLAMA_MODEL` (default `gemma4:12b`) is installed.

Run it with:

```bash
just eval mcp
```

The runner seeds a synthetic career portfolio in the test database, exercises
the real Streamable HTTP MCP transport, asks Ollama to select a tool, and
removes the fixture afterward. It refuses to run against a non-test
`DATABASE_URL`.

Promptfoo evaluations remain under `experiments/promptfoo/`; they are a
separate configuration-based evaluation system.

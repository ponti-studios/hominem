import http from 'node:http';

import {
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  McpRequestSchema,
  mcpError,
  mcpSuccess,
} from './protocol';
import { MCP_TOOLS, callTool } from './tools';

const port = process.env.MCP_PORT ? Number(process.env.MCP_PORT) : 4568;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function respondJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(payload)),
  });
  res.end(payload);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC dispatcher
// ---------------------------------------------------------------------------

function handleMcpRequest(body: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return mcpError('0', MCP_ERROR_CODES.PARSE_ERROR, 'Parse error');
  }

  const request = McpRequestSchema.safeParse(parsed);
  if (!request.success) {
    const id = (parsed as { id?: unknown })?.id ?? '0';
    const safeId = typeof id === 'string' || typeof id === 'number' ? id : '0';
    return mcpError(safeId, MCP_ERROR_CODES.INVALID_REQUEST, 'Invalid request');
  }

  const { id, method, params = {} } = request.data;

  switch (method) {
    case 'initialize':
      return mcpSuccess(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'hominem-mcp-server', version: '1.0.0' },
      });

    case 'tools/list':
      return mcpSuccess(id, { tools: MCP_TOOLS });

    case 'tools/call': {
      const toolName = params.name;
      const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
      if (typeof toolName !== 'string') {
        return mcpError(id, MCP_ERROR_CODES.INVALID_PARAMS, 'Missing tool name');
      }
      const result = callTool(toolName, toolArgs);
      return mcpSuccess(id, result);
    }

    default:
      return mcpError(id, MCP_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  // Health endpoint for the local MCP server.
  if (req.method === 'GET' && req.url === '/health') {
    respondJson(res, 200, { status: 'ok', service: 'hominem-mcp-server' });
    return;
  }

  // MCP JSON-RPC endpoint
  if (req.method === 'POST' && req.url === '/mcp') {
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      respondJson(res, 400, mcpError('0', MCP_ERROR_CODES.PARSE_ERROR, 'Failed to read body'));
      return;
    }
    const response = handleMcpRequest(body);
    respondJson(res, 200, response);
    return;
  }

  // SSE transport — used by Claude Desktop and other MCP clients
  if (req.method === 'GET' && req.url === '/mcp/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(
      `data: ${JSON.stringify({ type: 'endpoint', url: `http://127.0.0.1:${port}/mcp` })}\n\n`,
    );
    // Keep the connection open; the client will POST to /mcp
    req.on('close', () => res.end());
    return;
  }

  respondJson(res, 404, { error: 'Not found' });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`hominem MCP server listening on http://127.0.0.1:${port}\n`);
  process.stdout.write(`  POST http://127.0.0.1:${port}/mcp       — JSON-RPC\n`);
  process.stdout.write(`  GET  http://127.0.0.1:${port}/mcp/sse   — SSE transport\n`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

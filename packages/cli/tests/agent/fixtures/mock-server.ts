/** A loopback JSON server for connector cases. Routes get the parsed URL and return [status, body]. */
import { createServer, type IncomingMessage } from 'node:http';

export type Route = (url: URL, request: IncomingMessage) => [number, unknown];

export async function startMockServer(route: Route) {
  const server = createServer((request, response) => {
    const [status, payload] = route(new URL(request.url ?? '/', 'http://127.0.0.1'), request);
    const body = JSON.stringify(payload);
    response.writeHead(status, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });
    response.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// A tiny deterministic HTTP server the load tests run against. Each route
// behaves like a real failure mode, so the tests can prove the runner
// classifies them correctly.

import { createServer } from 'node:http';

export async function startStub() {
  let flakyCount = 0;

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://stub');

    if (url.pathname === '/healthz' || url.pathname === '/api/status') {
      res.writeHead(200);
      return res.end('ok');
    }

    if (url.pathname === '/api/finance/transactions/list') {
      const authed = (req.headers.cookie ?? '').includes('session=good');
      res.writeHead(authed ? 200 : 401);
      return res.end(authed ? '{"rows":[]}' : '{"error":"unauthorized"}');
    }

    if (url.pathname === '/ok') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('ok');
    }

    if (url.pathname === '/slow') {
      setTimeout(() => {
        res.writeHead(200);
        res.end('slow');
      }, 40);
      return;
    }

    if (url.pathname === '/flaky') {
      // Every third request is a 500, so the error rate is about one third.
      flakyCount += 1;
      const bad = flakyCount % 3 === 0;
      res.writeHead(bad ? 500 : 200);
      return res.end(bad ? 'boom' : 'ok');
    }

    if (url.pathname === '/secure') {
      // Leaks data if the cookie is missing: the security-regression case.
      const cookie = req.headers.cookie ?? '';
      if (cookie.includes('session=good')) {
        res.writeHead(200);
        return res.end('{"rows":[]}');
      }
      res.writeHead(401);
      return res.end('{"error":"unauthorized"}');
    }

    if (url.pathname === '/leaky') {
      // Returns 200 even without auth: the probe must flag this.
      res.writeHead(200);
      return res.end('{"rows":[{"secret":1}]}');
    }

    if (url.pathname === '/echo-json' && req.method === 'POST') {
      let size = 0;
      req.on('data', (c) => (size += c.length));
      req.on('end', () => {
        if (size > 1_000_000) {
          res.writeHead(413);
          return res.end();
        }
        res.writeHead(401);
        res.end();
      });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

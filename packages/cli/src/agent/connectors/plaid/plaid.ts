/**
 * Native Plaid connector.
 *
 * `hominem plaid auth` creates a Link token, opens Plaid Link in the browser,
 * exchanges the resulting public token, and stores only the access token and
 * Item ID in ~/.hominem/env. Read commands use the native Plaid REST client.
 */
import { execFile } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { asRecord } from '../../guards.ts';
import {
  plaidAccounts,
  plaidExchangePublicToken,
  plaidLinkTokenCreate,
  plaidLiabilities,
  plaidSetupStatus,
  plaidTransactionsWindow,
} from './client.ts';

const AUTH_TIMEOUT_MS = 10 * 60_000;

async function openBrowser(url: string): Promise<void> {
  await new Promise<void>((resolve) => {
    execFile('open', [url], () => resolve());
  });
}

function usage(): void {
  process.stderr.write(
    'Usage:\n' +
      '  hominem plaid auth\n' +
      '  hominem plaid status\n' +
      '  hominem plaid accounts\n' +
      '  hominem plaid transactions --since YYYY-MM-DD --until YYYY-MM-DD\n' +
      '  hominem plaid liabilities [--credential-id ID]\n',
  );
}

function send(res: ServerResponse, status: number, body: string, type = 'text/plain'): void {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(asRecord(JSON.parse(raw || '{}')) ?? {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function linkPage(linkToken: string): string {
  const tokenJson = JSON.stringify(linkToken);
  return `<!doctype html>
<meta charset="utf-8">
<title>Hominem Plaid Link</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:40px;color:#171717}
#state{margin-top:16px}
</style>
<h1>Connect a bank</h1>
<p id="state">Opening Plaid Link...</p>
<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
<script>
const Plaid = window.Plaid;
if (!Plaid) {
  document.getElementById("state").textContent = "Plaid Link could not load.";
} else {
  const handler = Plaid.create({
    token: ${tokenJson},
    onSuccess: async (publicToken) => {
      document.getElementById("state").textContent = "Exchanging token...";
      const response = await fetch("/exchange", {
        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify({publicToken})
      });
      document.getElementById("state").textContent =
        response.ok ? "Connected. You can close this tab." : "Connection failed.";
    },
    onExit: () => {
      document.getElementById("state").textContent =
        "Link closed. Return to the terminal.";
    }
  });
  handler.open();
}
</script>`;
}

async function runLink(): Promise<{ accessToken: string; itemId: string }> {
  const { linkToken } = await plaidLinkTokenCreate();
  const server = createServer(async (req, res) => {
    if (req.url === '/' && req.method === 'GET') {
      send(res, 200, linkPage(linkToken), 'text/html');
      return;
    }
    if (req.url === '/exchange' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const publicToken = body.publicToken;
        if (typeof publicToken !== 'string' || !publicToken) {
          send(res, 400, 'Missing public token');
          return;
        }
        const result = await plaidExchangePublicToken(publicToken);
        send(res, 200, 'ok');
        resolveLink(result);
      } catch (error) {
        send(res, 500, error instanceof Error ? error.message : 'Plaid exchange failed');
      }
      return;
    }
    send(res, 404, 'Not found');
  });

  let resolveLink: (value: { accessToken: string; itemId: string }) => void = () => {};
  const resultPromise = new Promise<{ accessToken: string; itemId: string }>((resolve) => {
    resolveLink = resolve;
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not bind the Plaid Link callback.');
  }

  const url = `http://127.0.0.1:${address.port}/`;
  process.stdout.write(`Opening Plaid Link:\n${url}\n`);
  await openBrowser(url).catch(() => undefined);

  const timeout = setTimeout(() => {
    server.close();
  }, AUTH_TIMEOUT_MS);

  try {
    return await Promise.race([
      resultPromise,
      new Promise<{ accessToken: string; itemId: string }>((_, reject) => {
        server.once('close', () => reject(new Error('Timed out waiting for Plaid Link')));
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    server.close();
  }
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const action = argv[0];
  if (!action || !['auth', 'status', 'accounts', 'transactions', 'liabilities'].includes(action)) {
    usage();
    return 2;
  }

  if (action === 'status') {
    const status = plaidSetupStatus();
    process.stdout.write(
      `${JSON.stringify(
        {
          environment: status.environment,
          environmentConfigured: status.environmentConfigured,
          clientIdConfigured: status.clientIdConfigured,
          secretConfigured: status.secretConfigured,
          accessTokenConfigured: status.accessTokenConfigured,
        },
        null,
        2,
      )}\n`,
    );
    return status.environmentConfigured && status.clientIdConfigured && status.secretConfigured
      ? 0
      : 2;
  }

  if (action === 'auth') {
    const status = plaidSetupStatus();
    if (!status.environmentConfigured || !status.clientIdConfigured || !status.secretConfigured) {
      await openBrowser('https://dashboard.plaid.com/developers/keys').catch(() => undefined);
      process.stderr.write(
        (!status.environmentConfigured
          ? 'PLAID_ENV is invalid. Use sandbox or production; development is not an API host.\n'
          : 'Plaid credentials are not configured.\n') +
          '1. Open the Plaid Dashboard and create/select an app.\n' +
          '2. Copy the client_id and the Production secret.\n' +
          '3. Add them to ~/.hominem/env:\n' +
          '   PLAID_CLIENT_ID=...\n' +
          '   PLAID_SECRET=...\n' +
          '   PLAID_ENV=sandbox|production\n' +
          '4. Re-run: hominem plaid auth\n',
      );
      return 2;
    }
    try {
      const result = await runLink();
      process.stdout.write(
        `${JSON.stringify({ ok: true, itemId: result.itemId, accessTokenStored: true }, null, 2)}\n`,
      );
      return 0;
    } catch (error) {
      process.stderr.write(
        `plaid auth: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      return 1;
    }
  }

  try {
    if (action === 'accounts') {
      const body = await plaidAccounts();
      process.stdout.write(`${JSON.stringify({ ok: true, data: body }, null, 2)}\n`);
      return 0;
    }
    if (action === 'liabilities') {
      const credentialId =
        option(argv, '--credential-id') ?? process.env.PLAID_ITEM_ID ?? 'plaid-item';
      const body = await plaidLiabilities(credentialId);
      process.stdout.write(`${JSON.stringify({ ok: true, data: body }, null, 2)}\n`);
      return 0;
    }
    const since = option(argv, '--since');
    const until = option(argv, '--until');
    if (!since || !until || !isDate(since) || !isDate(until)) {
      throw new Error('transactions requires --since YYYY-MM-DD --until YYYY-MM-DD');
    }
    const body = await plaidTransactionsWindow(since, until);
    process.stdout.write(`${JSON.stringify({ ok: true, data: body }, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(
      `plaid ${action}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

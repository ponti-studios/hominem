import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import { handleCallback } from './callback.js';
import { buildAuthUrl, checkLive, exchangeCode, loadClient, makePkce } from './google.js';
import {
  describeHealth,
  exitCodeFor,
  type Health,
  healthFromError,
  shouldNotify,
} from './health.js';
import { escapeXml } from './launchd.js';
import { notify, openUrl, syncRclone } from './system.js';

const CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

function page(message: string): string {
  return `<!doctype html><meta charset="utf-8"><title>hominem</title><p>${escapeXml(message)}</p>`;
}

// Resolves with the auth code Google redirects back with. The server only moves bytes: what each
// request means is decided by handleCallback.
function waitForCode(server: Server, state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for the Google redirect.')),
      CALLBACK_TIMEOUT_MS,
    );
    server.on('request', (req, res) => {
      const action = handleCallback(req.url ?? '/', state);
      if (action.kind === 'ignore') {
        res.writeHead(404).end();
        return;
      }
      clearTimeout(timer);
      if (action.kind === 'fail') {
        res.end(page(`Sign-in failed: ${action.reason}. You can close this tab.`));
        reject(new Error(action.reason));
      } else {
        res.end(page('Signed in to hominem. You can close this tab.'));
        resolve(action.code);
      }
    });
  });
}

export async function googleAuth(): Promise<void> {
  const client = await loadClient();
  const { verifier, challenge } = makePkce();
  const state = randomBytes(16).toString('base64url');

  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    server.close();
    throw new Error('Could not bind the local callback port.');
  }
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;

  try {
    // Attach the listener before the browser can redirect back to it.
    const codePromise = waitForCode(server, state);
    const authUrl = buildAuthUrl({ client, redirectUri, state, challenge });
    console.log('Opening Google sign-in. If it does not open, visit:');
    console.log(authUrl);
    await openUrl(authUrl).catch(() => console.log('(could not open a browser automatically)'));

    const code = await codePromise;
    await exchangeCode({ client, code, redirectUri, verifier });
    console.log('Google auth: re-authenticated.');
    console.log(await syncRclone());
  } finally {
    server.close();
  }
}

// Exit 0 healthy, 1 dead, 2 couldn't check. --notify posts a macOS notification only when the
// token is dead, so being offline at 9am doesn't look like an expired login.
export async function checkAuth(options: { notify: boolean }): Promise<number> {
  const health: Health = await checkLive().then(
    () => ({ status: 'healthy' }) as const,
    healthFromError,
  );
  for (const line of describeHealth(health)) console.log(line);
  if (options.notify && shouldNotify(health)) {
    await notify('Google auth expired', 'Run hominem auth google in Terminal to sign back in.');
  }
  return exitCodeFor(health);
}

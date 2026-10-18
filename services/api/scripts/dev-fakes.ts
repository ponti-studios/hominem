/**
 * Local stand-ins for OpenRouter's key API and Stripe, so the credit flow can be tried end to end
 * without real money or keys (docs/prd/top-up.md in the Thames repo). Development only.
 *
 *   FAKE_API_URL=http://localhost:4040 STRIPE_WEBHOOK_SECRET=whsec_dev pnpm tsx scripts/dev-fakes.ts
 *
 * Point the API at it with OPENROUTER_KEYS_BASE_URL=http://localhost:4050/openrouter and
 * STRIPE_API_BASE_URL=http://localhost:4050/stripe/v1. Stripe's hosted page becomes a page here
 * with links for a UK card, a non-UK card and Cancel; paying posts a signed webhook to the API.
 *
 * Control endpoints (for the test plan):
 *   POST /control/spend  {"hash":"…","usd":0.5}   sets a key's lifetime spend
 *   GET  /control/state                           keys, sessions and refunds
 */
import { createHmac, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const PORT = Number(process.env.FAKE_PORT ?? 4050);
const API = process.env.FAKE_API_URL ?? 'http://localhost:4040';
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_dev';

type Key = { hash: string; key: string; limit: number; usage: number; disabled: boolean };
type Session = {
  id: string;
  intent: string;
  amount: number;
  metadata: Record<string, string>;
  success: string;
  cancel: string;
  country: string;
};
const keys = new Map<string, Key>();
const sessions = new Map<string, Session>();
const intents = new Map<string, string>();
const refunds: string[] = [];

const id = (prefix: string) => `${prefix}_${randomBytes(8).toString('hex')}`;
const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const read = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

async function webhook(session: Session) {
  const event = {
    id: id('evt'),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: session.id,
        payment_status: 'paid',
        payment_intent: session.intent,
        currency: 'gbp',
        amount_total: session.amount,
        metadata: session.metadata,
      },
    },
  };
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  const response = await fetch(`${API}/webhooks/stripe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` },
    body,
  });
  console.log(`webhook for ${session.id} -> ${response.status}`);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    // ---- OpenRouter key API
    if (path === '/openrouter/keys' && req.method === 'POST') {
      const body = JSON.parse(await read(req)) as { limit?: number };
      const hash = id('hash');
      const key = `sk-or-v1-fake-${randomBytes(8).toString('hex')}`;
      keys.set(hash, { hash, key, limit: body.limit ?? 0, usage: 0, disabled: false });
      return send(res, 200, { key, data: { hash } });
    }
    const keyMatch = path.match(/^\/openrouter\/keys\/([^/]+)$/);
    if (keyMatch) {
      // A key the API remembers from before this process started: treat it as new and unspent.
      const hash = decodeURIComponent(keyMatch[1] ?? '');
      const found = keys.get(hash) ?? { hash, key: '', limit: 0, usage: 0, disabled: false };
      keys.set(hash, found);
      if (req.method === 'PATCH') {
        const body = JSON.parse(await read(req)) as { limit?: number; disabled?: boolean };
        if (body.limit !== undefined) found.limit = body.limit;
        if (body.disabled !== undefined) found.disabled = body.disabled;
      }
      return send(res, 200, {
        data: {
          hash: found.hash,
          limit: found.limit,
          usage: found.usage,
          usage_monthly: found.usage,
          disabled: found.disabled,
        },
      });
    }
    // ---- Stripe
    if (path === '/stripe/v1/checkout/sessions' && req.method === 'POST') {
      const form = new URLSearchParams(await read(req));
      const session: Session = {
        id: id('cs_test'),
        intent: id('pi'),
        amount: Number(form.get('line_items[0][price_data][unit_amount]')),
        metadata: {
          user_id: form.get('metadata[user_id]') ?? '',
          amount_pence: form.get('metadata[amount_pence]') ?? '',
          credit_pence: form.get('metadata[credit_pence]') ?? '',
        },
        success: form.get('success_url') ?? '',
        cancel: form.get('cancel_url') ?? '',
        country: 'GB',
      };
      sessions.set(session.id, session);
      return send(res, 200, { id: session.id, url: `http://localhost:${PORT}/pay/${session.id}` });
    }
    const intentMatch = path.match(/^\/stripe\/v1\/payment_intents\/([^/]+)$/);
    if (intentMatch) {
      const sessionId = intents.get(decodeURIComponent(intentMatch[1] ?? ''));
      const country = sessionId ? (sessions.get(sessionId)?.country ?? 'GB') : 'GB';
      return send(res, 200, {
        latest_charge: {
          billing_details: { address: { country } },
          payment_method_details: { card: { country } },
        },
      });
    }
    if (path === '/stripe/v1/refunds' && req.method === 'POST') {
      refunds.push(new URLSearchParams(await read(req)).get('payment_intent') ?? '');
      return send(res, 200, { id: id('re'), status: 'succeeded' });
    }
    // ---- The fake hosted checkout page
    const pay = path.match(/^\/pay\/([^/]+)$/);
    if (pay) {
      const session = sessions.get(pay[1] ?? '');
      if (!session) return send(res, 404, { error: 'no such session' });
      const choice = url.searchParams.get('card');
      if (choice === 'cancel') {
        res.writeHead(303, { location: session.cancel });
        return res.end();
      }
      if (choice) {
        session.country = choice === 'non-uk' ? 'US' : 'GB';
        intents.set(session.intent, session.id);
        await webhook(session);
        res.writeHead(303, {
          location: session.success.replace('{CHECKOUT_SESSION_ID}', session.id),
        });
        return res.end();
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(
        `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:24px;background:#111;color:#eee"><h2>Fake Stripe Checkout</h2><p>£${(session.amount / 100).toFixed(2)} for Thames credit</p><p><a style="color:#8ff0dc" href="?card=uk">Pay with test card 4242 (UK)</a></p><p><a style="color:#8ff0dc" href="?card=non-uk">Pay with a non-UK test card</a></p><p><a style="color:#8ff0dc" href="?card=cancel">Cancel</a></p>`,
      );
    }
    // ---- Test controls
    if (path === '/control/spend' && req.method === 'POST') {
      const body = JSON.parse(await read(req)) as { hash: string; usd: number };
      const found = keys.get(body.hash);
      if (!found) return send(res, 404, { error: 'no such key' });
      found.usage = body.usd;
      return send(res, 200, found);
    }
    if (path === '/control/state') {
      return send(res, 200, {
        keys: [...keys.values()],
        sessions: [...sessions.values()],
        refunds,
      });
    }
    return send(res, 404, { error: 'not found', path });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'internal error' });
  }
}).listen(PORT, () => console.log(`dev fakes on :${PORT}, API at ${API}`));

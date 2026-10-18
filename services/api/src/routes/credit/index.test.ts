import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mode: { value: 'off' | 'test' | 'live' } = { value: 'test' };
  const user: { value: { id: string; email: string } | undefined } = {
    value: { id: 'u1', email: 'dana@work.com' },
  };
  return { mode, user };
});
const more = vi.hoisted(() => ({
  secret: 'a-long-test-secret-for-signing-links',
  webhook: 'whsec_test',
  inCreditMode: { value: true },
  stripe: {
    createCheckoutSession: vi.fn(),
    paymentCountries: vi.fn(),
    refund: vi.fn(),
  },
  recordPayment: vi.fn(),
  confirmation: vi.fn(),
  claim: vi.fn(),
  markSent: vi.fn(),
  release: vi.fn(),
  paymentFor: vi.fn(),
  creditFor: vi.fn(),
}));

const SECRET = more.secret;
const WEBHOOK = more.webhook;

vi.mock('@hominem/db/core', () => ({
  db: {
    selectFrom: () => ({
      select: () => ({
        where: () => ({ executeTakeFirst: async () => mocks.user.value }),
      }),
    }),
  },
}));
vi.mock('../../env', () => ({
  env: {
    get CREDIT_MODE() {
      return mocks.mode.value;
    },
    BETTER_AUTH_SECRET: more.secret,
    API_URL: 'https://api.test',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: more.webhook,
  },
}));
vi.mock('../../application/credit.runtime', () => ({
  personInCreditMode: async () => more.inCreditMode.value,
  stripeProblem: () => null,
  stripeClient: () => more.stripe,
  creditDeps: () => ({
    store: {
      recordPayment: more.recordPayment,
      paymentFor: more.paymentFor,
      claimConfirmation: more.claim,
      markConfirmationSent: more.markSent,
      releaseConfirmation: more.release,
      setLowNotified: async () => undefined,
    },
    credentials: { rows: async () => [] },
    keys: {},
    config: { usdPerPound: 1.25 },
  }),
}));
vi.mock('../../application/credit-email', () => ({
  sendTopUpConfirmationEmail: more.confirmation,
}));
vi.mock('../../application/credit', async () => ({
  ...(await vi.importActual<object>('../../application/credit')),
  creditFor: more.creditFor,
  creditSnapshot: async () => ({
    balancePence: 2672,
    lastAddedPence: 0,
    rows: [],
    usage: new Map(),
  }),
  reconcileLimits: async () => 0,
}));

import { signLinkToken } from '../../application/credit';
import { creditRoutes } from './index';

const token = () => signLinkToken(SECRET, 'u1', new Date());
const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mode.value = 'test';
  mocks.user.value = { id: 'u1', email: 'dana@work.com' };
  more.inCreditMode.value = true;
  more.claim.mockResolvedValue(true);
  more.creditFor.mockResolvedValue({ balancePence: 15, lastAddedPence: 100 });
  more.stripe.createCheckoutSession.mockResolvedValue({
    id: 'cs_1',
    url: 'https://stripe.test/cs_1',
  });
});

describe('GET /credit', () => {
  it('is not there when credit is off', async () => {
    mocks.mode.value = 'off';
    expect((await creditRoutes.request(`/credit?t=${token()}`)).status).toBe(404);
  });

  it('shows the amounts and the balance for a valid link, with a locked-down policy', async () => {
    const response = await creditRoutes.request(`/credit?t=${token()}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toMatch(/script-src 'nonce-/);
    const page = await response.text();
    expect(page).toContain('<span class="n">£0.15</span>');
    expect(page).toContain('£8.19 of credit');
    expect(page).toContain('£17.53 of credit');
    expect(page).toContain('£45.54 of credit');
    expect(page).toContain('Test mode');
  });

  it('says the link has expired for a bad or old one, without naming anyone', async () => {
    const response = await creditRoutes.request('/credit?t=nonsense.nonsense');
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('expired');
  });

  it('is not there for a person the flag does not let in', async () => {
    more.inCreditMode.value = false;
    expect((await creditRoutes.request(`/credit?t=${token()}`)).status).toBe(404);
  });
});

describe('POST /credit/checkout', () => {
  it('starts a checkout for an offered amount with the consent', async () => {
    const response = await creditRoutes.request(
      '/credit/checkout',
      json({ t: token(), amountPounds: 20, consent: true }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: 'https://stripe.test/cs_1' });
    expect(more.stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', amountPence: 2000, creditPence: 1753 }),
    );
  });

  it('refuses without consent, for another amount, or with a bad link', async () => {
    const noConsent = await creditRoutes.request(
      '/credit/checkout',
      json({ t: token(), amountPounds: 20, consent: false }),
    );
    expect(noConsent.status).toBe(400);
    expect(await noConsent.json()).toEqual({ error: 'no_consent' });
    const wrongAmount = await creditRoutes.request(
      '/credit/checkout',
      json({ t: token(), amountPounds: 7, consent: true }),
    );
    expect(await wrongAmount.json()).toEqual({ error: 'bad_amount' });
    const badLink = await creditRoutes.request(
      '/credit/checkout',
      json({ t: 'abcdefghijk.lmnop', amountPounds: 20, consent: true }),
    );
    expect(badLink.status).toBe(400);
    expect(more.stripe.createCheckoutSession).not.toHaveBeenCalled();
  });
});

describe('POST /webhooks/stripe', () => {
  const event = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        payment_status: 'paid',
        payment_intent: 'pi_1',
        currency: 'gbp',
        amount_total: 1000,
        metadata: { user_id: 'u1', amount_pence: '1000', credit_pence: '819' },
      },
    },
  };
  function signed(body: string, secret = WEBHOOK) {
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    return { 'stripe-signature': `t=${t},v1=${v1}` };
  }

  it('rejects a bad signature and does nothing', async () => {
    const body = JSON.stringify(event);
    const response = await creditRoutes.request('/webhooks/stripe', {
      method: 'POST',
      headers: signed(body, 'whsec_wrong'),
      body,
    });
    expect(response.status).toBe(400);
    expect(more.recordPayment).not.toHaveBeenCalled();
  });

  it('credits a verified UK payment', async () => {
    more.stripe.paymentCountries.mockResolvedValue({ cardCountry: 'GB', billingCountry: 'GB' });
    more.recordPayment.mockResolvedValue('new');
    const body = JSON.stringify(event);
    const response = await creditRoutes.request('/webhooks/stripe', {
      method: 'POST',
      headers: signed(body),
      body,
    });
    expect(response.status).toBe(200);
    expect(more.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'cs_1', creditPence: 819, status: 'credited' }),
    );
  });

  it('answers 500 when handling fails, so Stripe retries', async () => {
    more.stripe.paymentCountries.mockRejectedValue(new Error('stripe down'));
    const body = JSON.stringify(event);
    const response = await creditRoutes.request('/webhooks/stripe', {
      method: 'POST',
      headers: signed(body),
      body,
    });
    expect(response.status).toBe(500);
  });

  it('is not there when credit is off', async () => {
    mocks.mode.value = 'off';
    const response = await creditRoutes.request('/webhooks/stripe', { method: 'POST', body: '{}' });
    expect(response.status).toBe(404);
  });
});

describe('the pages after Stripe', () => {
  it('sends the signed link and the session id through the checkout return addresses', async () => {
    await creditRoutes.request(
      '/credit/checkout',
      json({ t: token(), amountPounds: 10, consent: true }),
    );
    const input = more.stripe.createCheckoutSession.mock.calls[0]![0];
    expect(input.successUrl).toContain('/credit/done?t=');
    expect(input.successUrl).toContain('&s={CHECKOUT_SESSION_ID}');
    expect(input.cancelUrl).toContain('/credit/cancelled?t=');
  });

  it('done: polls for the credit when the link and session are valid, else just reassures', async () => {
    const live = await (
      await creditRoutes.request(`/credit/done?t=${token()}&s=cs_test_abc123`)
    ).text();
    expect(live).toContain('/credit/status');
    const bare = await (await creditRoutes.request('/credit/done')).text();
    expect(bare).not.toContain('/credit/status');
    expect(bare).toContain('within a minute');
  });

  it('status: pending, then credited with the balance, or refunded', async () => {
    const url = `/credit/status?t=${token()}&s=cs_test_abc123`;
    more.paymentFor.mockResolvedValueOnce(null);
    expect(await (await creditRoutes.request(url)).json()).toEqual({ state: 'pending' });
    more.paymentFor.mockResolvedValueOnce({ status: 'credited', creditPence: 819 });
    expect(await (await creditRoutes.request(url)).json()).toEqual({
      state: 'credited',
      creditPence: 819,
      balancePence: 2672,
    });
    more.paymentFor.mockResolvedValueOnce({ status: 'refunded_not_uk', creditPence: 819 });
    expect(await (await creditRoutes.request(url)).json()).toEqual({ state: 'refunded' });
  });

  it('status: refuses a bad link or a malformed session id', async () => {
    expect((await creditRoutes.request('/credit/status?t=nope&s=cs_test_abc123')).status).toBe(400);
    expect((await creditRoutes.request(`/credit/status?t=${token()}&s=x`)).status).toBe(400);
  });

  it('cancelled: shows the unchanged balance and a way to try again', async () => {
    const page = await (await creditRoutes.request(`/credit/cancelled?t=${token()}`)).text();
    expect(page).toContain('£26.72');
    expect(page).toContain('Try again');
    expect(page).toContain('Back to account');
  });
});

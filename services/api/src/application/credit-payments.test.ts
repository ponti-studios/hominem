import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { type CreditConfig, type CreditDeps, type CreditStore, type PaymentStatus } from './credit';
import { handleStripeEvent, startCheckout } from './credit-payments';
import {
  StripeError,
  verifyStripeSignature,
  type PaymentCountries,
  type StripeClient,
} from './stripe';

const config: CreditConfig = {
  mode: 'test',
  testers: [],
  usdPerPound: 1.25,
  grantPence: 100,
  grantsPerDay: 50,
};

function world(countries: PaymentCountries = { cardCountry: 'GB', billingCountry: 'GB' }) {
  const payments = new Map<string, { status: PaymentStatus; creditPence: number }>();
  const state: { ledger: number; refunds: string[]; lowCleared: boolean; sessions: unknown[] } = {
    ledger: 0,
    refunds: [],
    lowCleared: false,
    sessions: [],
  };
  const store: CreditStore = {
    ledgerPence: async () => state.ledger,
    lastAddedPence: async () => 0,
    hasLedger: async () => true,
    grantIfRoom: async () => 'has',
    recordPayment: async ({ sessionId, creditPence, status }) => {
      if (payments.has(sessionId)) return 'duplicate';
      payments.set(sessionId, { status, creditPence });
      if (status === 'credited') state.ledger += creditPence;
      return 'new';
    },
    paymentFor: async (_user, sessionId) => payments.get(sessionId) ?? null,
    lowNotifiedAt: async () => null,
    setLowNotified: async (_user, at) => {
      if (at === null) state.lowCleared = true;
    },
  };
  const stripe: StripeClient = {
    createCheckoutSession: async (input) => {
      state.sessions.push(input);
      return { id: 'cs_1', url: 'https://checkout.stripe.test/pay/cs_1' };
    },
    paymentCountries: async () => countries,
    refund: async (id) => {
      state.refunds.push(id);
    },
  };
  const credit: CreditDeps = {
    store,
    credentials: {
      isBlocked: async () => false,
      isAllowed: async () => true,
      rows: async () => [],
      replace: async () => undefined,
      markRevoked: async () => undefined,
      markDisabled: async () => undefined,
      setLimit: async () => undefined,
    },
    keys: {
      create: async () => ({ key: 'k', hash: 'h' }),
      disable: async () => undefined,
      usageMonthly: async () => 0,
      usage: async () => 0,
      setLimit: async () => undefined,
    },
    config,
  };
  return { state, payments, stripe, credit };
}

function completed(overrides: Record<string, unknown> = {}, metadata: Record<string, string> = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        payment_status: 'paid',
        payment_intent: 'pi_1',
        currency: 'gbp',
        amount_total: 1000,
        metadata: { user_id: 'u1', amount_pence: '1000', credit_pence: '819', ...metadata },
        ...overrides,
      },
    },
  };
}

describe('starting a checkout', () => {
  const urls = {
    successUrl: 'https://api.test/credit/done',
    cancelUrl: 'https://api.test/credit/cancelled',
  };
  const person = { userId: 'u1', email: 'dana@work.com' };

  it('works out the credit itself and needs the consent', async () => {
    const { stripe, state } = world();
    const outcome = await startCheckout(
      { stripe, ...urls },
      { ...person, amountPounds: 10, consent: true },
    );
    expect(outcome).toEqual({ kind: 'started', url: 'https://checkout.stripe.test/pay/cs_1' });
    expect(state.sessions[0]).toMatchObject({ amountPence: 1000, creditPence: 819, userId: 'u1' });
    expect(
      await startCheckout({ stripe, ...urls }, { ...person, amountPounds: 10, consent: false }),
    ).toEqual({ kind: 'no_consent' });
  });
  it('only takes the amounts the page offers', async () => {
    const { stripe } = world();
    for (const amountPounds of [0, 5, 15, 51, 10.5, -10]) {
      expect(
        await startCheckout({ stripe, ...urls }, { ...person, amountPounds, consent: true }),
      ).toEqual({ kind: 'bad_amount' });
    }
  });
});

describe('the webhook', () => {
  it('credits a paid UK payment once', async () => {
    const { credit, stripe, state } = world();
    const first = await handleStripeEvent({ credit, stripe }, completed());
    expect(first).toEqual({ kind: 'credited', userId: 'u1', amountPence: 1000, creditPence: 819 });
    expect(state.ledger).toBe(819);
    expect(state.lowCleared).toBe(true);
    const again = await handleStripeEvent({ credit, stripe }, completed());
    expect(again).toEqual({
      kind: 'duplicate',
      confirm: { userId: 'u1', amountPence: 1000, creditPence: 819 },
    });
    expect(state.ledger).toBe(819);
  });
  it('refunds a payment from outside the UK and credits nothing', async () => {
    for (const countries of [
      { cardCountry: 'US', billingCountry: 'GB' },
      { cardCountry: 'GB', billingCountry: 'FR' },
      { cardCountry: null, billingCountry: 'GB' },
    ]) {
      const { credit, stripe, state } = world(countries);
      const outcome = await handleStripeEvent({ credit, stripe }, completed());
      expect(outcome).toEqual({ kind: 'refunded_not_uk', userId: 'u1' });
      expect(state.refunds).toEqual(['pi_1']);
      expect(state.ledger).toBe(0);
    }
  });
  it('treats an already-refunded charge as done, and any other refund failure as an error', async () => {
    const already = world({ cardCountry: 'US', billingCountry: 'US' });
    already.stripe.refund = async () => {
      throw new StripeError('refund', 400, 'charge_already_refunded');
    };
    expect(
      await handleStripeEvent({ credit: already.credit, stripe: already.stripe }, completed()),
    ).toEqual({
      kind: 'refunded_not_uk',
      userId: 'u1',
    });
    const broken = world({ cardCountry: 'US', billingCountry: 'US' });
    broken.stripe.refund = async () => {
      throw new StripeError('refund', 500);
    };
    await expect(
      handleStripeEvent({ credit: broken.credit, stripe: broken.stripe }, completed()),
    ).rejects.toThrow();
    expect(broken.payments.size).toBe(0);
  });
  it('ignores other events and unpaid sessions', async () => {
    const { credit, stripe, state } = world();
    expect(await handleStripeEvent({ credit, stripe }, { type: 'charge.succeeded' })).toEqual({
      kind: 'ignored',
    });
    expect(
      await handleStripeEvent({ credit, stripe }, completed({ payment_status: 'unpaid' })),
    ).toEqual({ kind: 'ignored' });
    expect(state.ledger).toBe(0);
  });
  it('rejects a payment that is not what the page asked for', async () => {
    const { credit, stripe, state } = world();
    const cases: [Record<string, unknown>, Record<string, string>, string][] = [
      [{ currency: 'usd' }, {}, 'not_gbp'],
      [{ amount_total: 700 }, { amount_pence: '700' }, 'unknown_amount'],
      [{}, { amount_pence: '2000' }, 'amount_mismatch'],
      [{ metadata: null }, {}, 'missing_fields'],
    ];
    for (const [overrides, metadata, reason] of cases) {
      expect(await handleStripeEvent({ credit, stripe }, completed(overrides, metadata))).toEqual({
        kind: 'rejected',
        reason,
      });
    }
    expect(state.ledger).toBe(0);
  });
  it('credits what the server works out, not what the metadata claims', async () => {
    const { credit, stripe, state } = world();
    await handleStripeEvent({ credit, stripe }, completed({}, { credit_pence: '99999' }));
    expect(state.ledger).toBe(819);
  });
});

describe('the webhook signature', () => {
  const secret = 'whsec_test_secret';
  const now = new Date('2026-10-18T10:00:00Z');
  const t = Math.floor(now.getTime() / 1000);
  const body = '{"id":"evt_1"}';
  const sig = (time: number, text = body) =>
    createHmac('sha256', secret).update(`${time}.${text}`).digest('hex');

  it('accepts a good, recent signature', () => {
    expect(verifyStripeSignature(body, `t=${t},v1=${sig(t)}`, secret, now)).toBe(true);
    expect(verifyStripeSignature(body, `t=${t},v1=bad,v1=${sig(t)}`, secret, now)).toBe(true);
  });
  it('rejects a changed body, wrong secret, missing header and an old timestamp', () => {
    expect(verifyStripeSignature(`${body} `, `t=${t},v1=${sig(t)}`, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, `t=${t},v1=${sig(t)}`, 'whsec_other', now)).toBe(false);
    expect(verifyStripeSignature(body, undefined, secret, now)).toBe(false);
    expect(verifyStripeSignature(body, `t=${t - 1000},v1=${sig(t - 1000)}`, secret, now)).toBe(
      false,
    );
    expect(verifyStripeSignature(body, `t=${t}`, secret, now)).toBe(false);
  });
});

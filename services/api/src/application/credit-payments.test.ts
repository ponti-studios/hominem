import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { type CreditConfig, type CreditDeps, type CreditStore, type PaymentStatus } from './credit';
import {
  confirmOnce,
  deliverOutcome,
  handleStripeEvent,
  startCheckout,
  sweepHolds,
  type WebhookOutcome,
} from './credit-payments';
import {
  StripeError,
  verifyStripeSignature,
  type CheckoutSession,
  type PaymentFacts,
  type StripeClient,
} from './stripe';

const config: CreditConfig = {
  mode: 'test',
  testers: [],
  usdPerPound: 1.25,
  grantPence: 100,
  grantsPerDay: 50,
};

const held = (countries: Partial<PaymentFacts> = {}): PaymentFacts => ({
  status: 'requires_capture',
  cardCountry: 'GB',
  billingCountry: 'GB',
  ...countries,
});

function world(facts: PaymentFacts = held()) {
  const payments = new Map<string, { status: PaymentStatus; creditPence: number }>();
  const state = {
    ledger: 0,
    refunds: [] as string[],
    captures: [] as string[],
    cancels: [] as string[],
    lowCleared: false,
    sessions: [] as unknown[],
    listed: [] as CheckoutSession[],
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
    claimConfirmation: async () => true,
    markConfirmationSent: async () => undefined,
    releaseConfirmation: async () => undefined,
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
    paymentFacts: async () => facts,
    capture: async (id) => {
      state.captures.push(id);
    },
    cancel: async (id) => {
      state.cancels.push(id);
    },
    refund: async (id) => {
      state.refunds.push(id);
    },
    completedSessions: async () => state.listed,
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
  it('captures a held UK payment and credits it once', async () => {
    const { credit, stripe, state } = world();
    const first = await handleStripeEvent(
      { credit, stripe },
      completed({ payment_status: 'unpaid' }),
    );
    expect(first).toEqual({
      kind: 'credited',
      sessionId: expect.any(String),
      userId: 'u1',
      amountPence: 1000,
      creditPence: 819,
    });
    expect(state.captures).toEqual(['pi_1']);
    expect(state.ledger).toBe(819);
    expect(state.lowCleared).toBe(true);
    const again = await handleStripeEvent({ credit, stripe }, completed());
    expect(again).toEqual({
      kind: 'duplicate',
      confirm: { sessionId: expect.any(String), userId: 'u1', amountPence: 1000, creditPence: 819 },
    });
    expect(state.ledger).toBe(819);
    // The repeat neither asks Stripe again nor takes the money twice.
    expect(state.captures).toEqual(['pi_1']);
  });
  it('credits a payment already taken without capturing it again', async () => {
    const { credit, stripe, state } = world(held({ status: 'succeeded' }));
    const outcome = await handleStripeEvent({ credit, stripe }, completed());
    expect(outcome.kind).toBe('credited');
    expect(state.captures).toEqual([]);
    expect(state.ledger).toBe(819);
  });
  it('treats a capture that lost a race as done when the payment has been taken', async () => {
    const racing = world();
    racing.stripe.capture = async () => {
      throw new StripeError('capture', 400, 'payment_intent_unexpected_state');
    };
    racing.stripe.paymentFacts = vi
      .fn<StripeClient['paymentFacts']>()
      .mockResolvedValueOnce(held())
      .mockResolvedValueOnce(held({ status: 'succeeded' }));
    expect(
      (await handleStripeEvent({ credit: racing.credit, stripe: racing.stripe }, completed())).kind,
    ).toBe('credited');
    const broken = world();
    broken.stripe.capture = async () => {
      throw new StripeError('capture', 400, 'payment_intent_unexpected_state');
    };
    broken.stripe.paymentFacts = vi
      .fn<StripeClient['paymentFacts']>()
      .mockResolvedValueOnce(held())
      .mockResolvedValueOnce(held({ status: 'canceled' }));
    expect(
      await handleStripeEvent({ credit: broken.credit, stripe: broken.stripe }, completed()),
    ).toEqual({ kind: 'rejected', reason: 'capture_failed' });
    expect(broken.state.ledger).toBe(0);
  });
  it('credits nothing when the capture itself fails, so Stripe tries again', async () => {
    const { credit, stripe, state, payments } = world();
    stripe.capture = async () => {
      throw new StripeError('capture', 500);
    };
    await expect(handleStripeEvent({ credit, stripe }, completed())).rejects.toThrow();
    expect(state.ledger).toBe(0);
    expect(payments.size).toBe(0);
  });
  it('releases a held payment from outside the UK: nothing is charged, nothing credited', async () => {
    for (const countries of [
      { cardCountry: 'US', billingCountry: 'GB' },
      { cardCountry: 'GB', billingCountry: 'FR' },
      { cardCountry: null, billingCountry: 'GB' },
    ]) {
      const { credit, stripe, state } = world(held(countries));
      const outcome = await handleStripeEvent({ credit, stripe }, completed());
      expect(outcome).toEqual({ kind: 'not_charged', userId: 'u1' });
      expect(state.cancels).toEqual(['pi_1']);
      expect(state.refunds).toEqual([]);
      expect(state.captures).toEqual([]);
      expect(state.ledger).toBe(0);
    }
  });
  it('refunds a non-UK payment that was already taken, from before holds', async () => {
    const { credit, stripe, state } = world(held({ status: 'succeeded', cardCountry: 'US' }));
    expect(await handleStripeEvent({ credit, stripe }, completed())).toEqual({
      kind: 'not_charged',
      userId: 'u1',
    });
    expect(state.refunds).toEqual(['pi_1']);
    expect(state.cancels).toEqual([]);
  });
  it('treats an already-released or refunded payment as done, and any other failure as an error', async () => {
    const released = world(held({ cardCountry: 'US' }));
    released.stripe.cancel = async () => {
      throw new StripeError('cancel', 400, 'payment_intent_unexpected_state');
    };
    expect(
      await handleStripeEvent({ credit: released.credit, stripe: released.stripe }, completed()),
    ).toEqual({ kind: 'not_charged', userId: 'u1' });
    const refunded = world(held({ status: 'succeeded', cardCountry: 'US' }));
    refunded.stripe.refund = async () => {
      throw new StripeError('refund', 400, 'charge_already_refunded');
    };
    expect(
      await handleStripeEvent({ credit: refunded.credit, stripe: refunded.stripe }, completed()),
    ).toEqual({ kind: 'not_charged', userId: 'u1' });
    const broken = world(held({ cardCountry: 'US' }));
    broken.stripe.cancel = async () => {
      throw new StripeError('cancel', 500);
    };
    await expect(
      handleStripeEvent({ credit: broken.credit, stripe: broken.stripe }, completed()),
    ).rejects.toThrow();
    expect(broken.payments.size).toBe(0);
  });
  it('ignores other events, sessions with nothing to pay, and payments that are not held or taken', async () => {
    const { credit, stripe, state } = world();
    expect(await handleStripeEvent({ credit, stripe }, { type: 'charge.succeeded' })).toEqual({
      kind: 'ignored',
    });
    expect(
      await handleStripeEvent(
        { credit, stripe },
        completed({ payment_status: 'no_payment_required' }),
      ),
    ).toEqual({ kind: 'ignored' });
    for (const status of ['processing', 'requires_payment_method']) {
      const other = world(held({ status }));
      expect(
        await handleStripeEvent({ credit: other.credit, stripe: other.stripe }, completed()),
      ).toEqual({
        kind: 'ignored',
      });
      expect(other.state.captures).toEqual([]);
    }
    expect(state.ledger).toBe(0);
  });
  it('records a hold that was already released as not charged, so a crash mid-release recovers', async () => {
    const { credit, stripe, state, payments } = world(held({ status: 'canceled' }));
    expect(await handleStripeEvent({ credit, stripe }, completed())).toEqual({
      kind: 'not_charged',
      userId: 'u1',
    });
    expect(state.captures).toEqual([]);
    expect(state.ledger).toBe(0);
    expect(payments.size).toBe(1);
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
    expect(state.captures).toEqual([]);
  });
  it('credits what the server works out, not what the metadata claims', async () => {
    const { credit, stripe, state } = world();
    await handleStripeEvent({ credit, stripe }, completed({}, { credit_pence: '99999' }));
    expect(state.ledger).toBe(819);
  });
});

describe('the sweeper', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const nowUnix = Math.floor(now.getTime() / 1000);
  const session = (id: string, ageSeconds: number, intent = `pi_${id}`): CheckoutSession => ({
    id,
    payment_status: 'unpaid',
    payment_intent: intent,
    currency: 'gbp',
    amount_total: 1000,
    metadata: { user_id: 'u1', amount_pence: '1000' },
    created: nowUnix - ageSeconds,
  });

  it('settles a payment the webhook missed, and leaves young and settled ones alone', async () => {
    const { credit, stripe, state, payments } = world();
    payments.set('cs_done', { status: 'credited', creditPence: 819 });
    state.listed = [session('cs_missed', 3600), session('cs_young', 30), session('cs_done', 7200)];
    const delivered: WebhookOutcome[] = [];
    const result = await sweepHolds({ credit, stripe, now: () => now }, async (o) => {
      delivered.push(o);
    });
    expect(result.looked).toBe(3);
    expect(result.failed).toBe(0);
    expect(delivered.map((o) => o.kind)).toEqual(['credited', 'duplicate']);
    expect(state.captures).toEqual(['pi_cs_missed']);
    expect(state.ledger).toBe(819);
  });
  it('sends a confirmation that failed before, for a payment already credited', async () => {
    const { credit, stripe, state, payments } = world();
    payments.set('cs_old', { status: 'credited', creditPence: 819 });
    state.listed = [session('cs_old', 3600)];
    const delivered: WebhookOutcome[] = [];
    const result = await sweepHolds({ credit, stripe, now: () => now }, async (o) => {
      delivered.push(o);
    });
    expect(delivered).toEqual([
      {
        kind: 'duplicate',
        confirm: { sessionId: 'cs_old', userId: 'u1', amountPence: 1000, creditPence: 819 },
      },
    ]);
    expect(result.settled).toEqual([]);
  });
  it('keeps going when one payment fails, and counts it', async () => {
    const { credit, stripe, state } = world();
    state.listed = [session('cs_a', 3600), session('cs_b', 3600)];
    let calls = 0;
    stripe.capture = async () => {
      calls += 1;
      if (calls === 1) throw new StripeError('capture', 500);
    };
    const result = await sweepHolds({ credit, stripe, now: () => now }, async () => undefined);
    expect(result.failed).toBe(1);
    expect(result.settled).toHaveLength(1);
  });
});

describe('telling the person', () => {
  function deps() {
    const sendConfirmation = vi.fn(async () => undefined);
    const sendNotCharged = vi.fn(async () => undefined);
    const notify = vi.fn(async () => undefined);
    const store = world().credit.store;
    return { store, sendConfirmation, sendNotCharged, notify };
  }
  const credited: WebhookOutcome = {
    kind: 'credited',
    sessionId: 'cs_1',
    userId: 'u1',
    amountPence: 1000,
    creditPence: 819,
  };

  it('emails the confirmation once and tells the open app', async () => {
    const d = deps();
    await deliverOutcome(d, credited);
    expect(d.sendConfirmation).toHaveBeenCalledTimes(1);
    expect(d.sendNotCharged).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledWith('u1', 'credited');
  });
  it('says a non-UK payment was not charged', async () => {
    const d = deps();
    await deliverOutcome(d, { kind: 'not_charged', userId: 'u1' });
    expect(d.sendNotCharged).toHaveBeenCalledWith('u1');
    expect(d.sendConfirmation).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledWith('u1', 'not_charged');
  });
  it('does not fail the webhook when the notice or the UK-only email fails', async () => {
    const d = deps();
    d.notify.mockRejectedValue(new Error('down'));
    d.sendNotCharged.mockRejectedValue(new Error('mail down'));
    await expect(deliverOutcome(d, { kind: 'not_charged', userId: 'u1' })).resolves.toBeUndefined();
  });
  it('fails the webhook when the confirmation cannot be sent, so Stripe delivers it again', async () => {
    const d = deps();
    d.sendConfirmation.mockRejectedValue(new Error('mail down'));
    await expect(deliverOutcome(d, credited)).rejects.toThrow('mail down');
    expect(d.notify).not.toHaveBeenCalled();
  });
  it('sends nothing for a repeat delivery that has no confirmation to resend', async () => {
    const d = deps();
    await deliverOutcome(d, { kind: 'duplicate' });
    expect(d.sendConfirmation).not.toHaveBeenCalled();
    expect(d.notify).not.toHaveBeenCalled();
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

describe('confirmOnce', () => {
  const confirmation = { sessionId: 'cs_1', userId: 'u1', amountPence: 1000, creditPence: 819 };
  function claims() {
    let claimed = false;
    let sent = false;
    const store: CreditStore = {
      ledgerPence: async () => 0,
      lastAddedPence: async () => 0,
      hasLedger: async () => false,
      grantIfRoom: async () => 'has',
      recordPayment: async () => 'new',
      paymentFor: async () => null,
      claimConfirmation: async () => {
        if (claimed || sent) return false;
        claimed = true;
        return true;
      },
      markConfirmationSent: async () => {
        sent = true;
      },
      releaseConfirmation: async () => {
        claimed = false;
      },
      lowNotifiedAt: async () => null,
      setLowNotified: async () => undefined,
    };
    return store;
  }

  it('sends once however many times the payment is delivered', async () => {
    const store = claims();
    const send = vi.fn(async () => undefined);
    expect(await confirmOnce({ store }, confirmation, send)).toBe(true);
    expect(await confirmOnce({ store }, confirmation, send)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends once when two deliveries arrive at the same moment', async () => {
    const store = claims();
    const send = vi.fn(async () => undefined);
    await Promise.all([
      confirmOnce({ store }, confirmation, send),
      confirmOnce({ store }, confirmation, send),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('gives the claim back when sending fails, so the next delivery sends it', async () => {
    const store = claims();
    const failing = vi.fn(async () => {
      throw new Error('mail down');
    });
    await expect(confirmOnce({ store }, confirmation, failing)).rejects.toThrow('mail down');
    const send = vi.fn(async () => undefined);
    expect(await confirmOnce({ store }, confirmation, send)).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

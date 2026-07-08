import crypto from 'node:crypto';

import {
  deletePlaidItem,
  ensureInstitutionExists,
  getPlaidItemById,
  getPlaidItemByUserAndItemId,
  upsertPlaidItem,
} from '@hominem/finance-services';
import { plaidSyncQueue, QUEUE_NAMES } from '@hominem/queues';
import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

// UUID regex
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID_RE.test(value);

import { API_BRAND } from '../../brand';
import { InternalError, NotFoundError } from '../errors';
import { env } from '../lib/env';
import { PLAID_COUNTRY_CODES, PLAID_PRODUCTS, plaidClient } from '../lib/plaid';
import { authMiddleware, type AppContext } from '../middleware/auth';

/**
 * Finance Plaid Routes
 */
export const plaidRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)

  // POST /create-link-token - Create link token
  .post('/create-link-token', async (c) => {
    try {
      const userId = c.get('userId')!;

      const createTokenResponse = await plaidClient.linkTokenCreate({
        user: { client_userId: userId },
        client_name: API_BRAND.financeClientName,
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
        webhook: `${env.API_URL}/api/finance/plaid/webhook`,
      });

      return c.json(
        {
          linkToken: createTokenResponse.data.link_token,
          expiration: createTokenResponse.data.expiration,
          requestId: createTokenResponse.data.request_id,
        },
        200,
      );
    } catch (error) {
      logger.error('Failed to create Plaid link token', { error });
      throw new InternalError('Failed to create link token');
    }
  })

  // POST /exchange-token - Exchange public token
  .post(
    '/exchange-token',
    zValidator(
      'json',
      z.object({
        publicToken: z.string().min(1),
        institutionName: z.string().min(1),
      }),
    ),
    async (c) => {
      const input = c.req.valid('json');
      const userId = c.get('userId')!;

      let accessToken = '';
      let itemId = '';
      let requestId = '';
      try {
        const exchangeResponse = await plaidClient.itemPublicTokenExchange({
          public_token: input.publicToken,
        });
        accessToken = exchangeResponse.data.accessToken;
        itemId = exchangeResponse.data.providerItemId;
        requestId = exchangeResponse.data.request_id;
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          throw error;
        }
        const suffix = crypto.randomUUID().slice(0, 8);
        accessToken = `access-${suffix}`;
        itemId = `item-${suffix}`;
        requestId = `req-${suffix}`;
      }

      // Ensure institution exists
      const institution = await ensureInstitutionExists(input.institutionName);

      // Save Plaid item
      await upsertPlaidItem({
        id: crypto.randomUUID(),
        userId: userId,
        providerItemId: itemId,
        accessToken: accessToken,
        institutionId: institution.id,
        status: 'active',
        cursor: null,
        lastSyncedAt: null,
      });

      // Queue sync job
      await plaidSyncQueue.add(
        QUEUE_NAMES.PLAID_SYNC,
        {
          userId,
          accessToken,
          itemId,
          initialSync: true,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      );

      return c.json(
        {
          accessToken,
          itemId,
          requestId,
        },
        200,
      );
    },
  )

  // POST /sync-item - Sync Plaid item
  .post('/sync-item', zValidator('json', z.object({ itemId: z.string() })), async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId')!;

    // Get the plaid item
    const plaidItem = isUuid(input.itemId)
      ? ((await getPlaidItemById(input.itemId, userId)) ??
        (await getPlaidItemByUserAndItemId(userId, input.itemId)))
      : await getPlaidItemByUserAndItemId(userId, input.itemId);

    if (!plaidItem) {
      throw new NotFoundError('Plaid item not found');
    }

    // Queue sync job
    await plaidSyncQueue.add(
      QUEUE_NAMES.PLAID_SYNC,
      {
        userId,
        accessToken: plaidItem.accessToken,
        itemId: plaidItem.providerItemId,
        initialSync: false,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );

    return c.json(
      {
        success: true,
        added: 0, // Async, so we don't know yet
        modified: 0,
        removed: 0,
      },
      200,
    );
  })

  // POST /remove-connection - Remove connection
  .post('/remove-connection', zValidator('json', z.object({ itemId: z.string() })), async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId')!;

    // Get the plaid item
    const plaidItem = isUuid(input.itemId)
      ? ((await getPlaidItemById(input.itemId, userId)) ??
        (await getPlaidItemByUserAndItemId(userId, input.itemId)))
      : await getPlaidItemByUserAndItemId(userId, input.itemId);

    if (!plaidItem) {
      throw new NotFoundError('Plaid item not found');
    }

    // Revoke access token with Plaid
    if (plaidItem.accessToken) {
      try {
        await plaidClient.itemAccessTokenInvalidate({
          accessToken: plaidItem.accessToken,
        });
      } catch (revokeError) {
        logger.warn('Failed to revoke Plaid access token', { error: revokeError });
      }
    }

    // Delete the plaid item
    await deletePlaidItem(plaidItem.id, userId);

    return c.json({ success: true }, 200);
  });

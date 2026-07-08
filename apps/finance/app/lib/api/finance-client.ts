import type { AppType } from '@hominem/api/types';
import type { hc } from 'hono/client';

type AppClient = ReturnType<typeof hc<AppType>>;
export type FinanceClient = AppClient['api']['finance'];

import 'dotenv/config';
import { createServerEnv } from '@hominem/env';
import { apiSchema } from '@hominem/config/api';

export const env = createServerEnv(apiSchema, 'apiServer');

import 'dotenv/config';
import { apiSchema } from '@hominem/config/api';
import { createServerEnv } from '@hominem/env';

export const env = createServerEnv(apiSchema, 'apiServer');

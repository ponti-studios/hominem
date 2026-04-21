import 'dotenv/config';
import { createServerEnv } from '@hakumi/env';
import { apiSchema } from '@hakumi/env/api';

export const env = createServerEnv(apiSchema, 'apiServer');

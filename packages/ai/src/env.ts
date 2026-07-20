import { createServerEnv } from '@hominem/env';
import { baseSchema } from '@hominem/env/base';

export const env = createServerEnv(baseSchema, 'ai');

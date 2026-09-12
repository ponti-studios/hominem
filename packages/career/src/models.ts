import { createServerEnv } from '@hominem/env';
import { aiSchema } from '@hominem/env/ai';

const env = createServerEnv(aiSchema, 'ai');

export const JOB_ANALYSIS_MODEL = env.JOB_ANALYSIS_MODEL;
export const JOB_EXTRACTION_MODEL = env.JOB_EXTRACTION_MODEL;
export const RESUME_CUSTOMIZE_MODEL = env.RESUME_CUSTOMIZE_MODEL;
export const RESUME_PARSE_MODEL = env.RESUME_PARSE_MODEL;
export const SKILLS_DERIVATION_MODEL = env.SKILLS_DERIVATION_MODEL;

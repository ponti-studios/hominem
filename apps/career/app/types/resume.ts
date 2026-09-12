export {
  normalizePortfolioSlug,
  resumeSchema,
  type ConvertedResumeData,
} from '@hominem/career-services/types';

export type ResumeConvertStage =
  | 'auth'
  | 'request'
  | 'file-validation'
  | 'rate-limit'
  | 'pdf-extraction'
  | 'ai-parse'
  | 'schema-validation'
  | 'storage'
  | 'database'
  | 'complete';

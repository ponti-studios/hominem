// Local mirrors of the API's resume-analysis payloads. The platform never imports
// @hominem/queues (server-only), so the SSE consumer types its own events.
export type ResumeAnalysisStage =
  | 'queued'
  | 'pdf-extraction'
  | 'ai-parse'
  | 'schema-validation'
  | 'diffing'
  | 'done'
  | 'error';

export interface ResumeListItemChange {
  key: string;
  group: 'workExperience' | 'skills' | 'projects';
  summary: string;
  payload: unknown;
}

export interface ResumeScalarChange {
  field: string;
  group: 'basics' | 'social';
  label: string;
  current: string | boolean | null;
  proposed: string | boolean | null;
}

export interface ResumeImportDiff {
  scalarChanges: ResumeScalarChange[];
  listChanges: ResumeListItemChange[];
  portfolioSlugProposed: string;
}

export interface SseResumeEvent {
  jobId: string;
  stage: ResumeAnalysisStage;
  label: string;
  percent: number;
  error?: boolean;
  errorMessage?: string;
  diff?: ResumeImportDiff;
}

export type ResumeScalarFieldChange = ResumeScalarChange;

// background job types shared across workers and the UI

export type JobStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'cancelled';

// everything's optional here since we send partial updates as a job progresses
export interface JobStats {
  progress?: number;
  processingTime?: number;
  total?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  merged?: number;
  invalid?: number;
  errors?: string[];
}

export interface BaseJob<TStatus extends string = JobStatus> {
  jobId: string;
  userId: string;
  endTime?: number;
  status: TStatus;
  stats?: JobStats;
  type: string;
}

export interface ChatFileCleanupQueuePayload {
  fileIds: string[];
  userId: string;
}

export type ChatGenerationEffectsQueuePayload = Record<string, never>;

export interface FileProcessingJob {
  jobId: string;
  userId: string;
  fileId: string;
  storageKey: string;
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface EmbeddingGenerationJob {
  jobId: string;
  userId: string;
  entityType: 'note' | 'chat';
  entityId: string;
}

export interface SpeechUsageReconciliationJob {
  speechRunId: string;
}

// stages for parsing a PDF resume and diffing it against the user's existing
// career profile so they can review changes before they get applied
export type ResumeAnalysisStage =
  | 'queued'
  | 'pdf-extraction'
  | 'ai-parse'
  | 'schema-validation'
  | 'diffing'
  | 'done'
  | 'error';

export type ResumeImportMode = 'create' | 'replace';

export interface ResumeAnalysisQueuePayload {
  jobId: string;
  userId: string;
  fileId: string;
  mode: ResumeImportMode;
  existingProfileId?: string;
  createdAt: number;
}

// a changed scalar field on the profile or social-links record
export interface ResumeScalarFieldChange {
  field: string;
  group: 'basics' | 'social';
  label: string;
  current: string | boolean | null;
  proposed: string | boolean | null;
}

// a new list-type record (work experience, skill, or project) parsed from the resume
export interface ResumeListItemChange {
  key: string;
  group: 'workExperience' | 'skills' | 'projects';
  summary: string;
  payload: unknown;
}

export interface ResumeImportDiff {
  scalarChanges: ResumeScalarFieldChange[];
  listChanges: ResumeListItemChange[];
  portfolioSlugProposed: string;
}

export interface ResumeAnalysisJob extends BaseJob {
  type: 'resume-analysis';
  stage: ResumeAnalysisStage;
  fileId: string;
  mode: ResumeImportMode;
  error?: string;
  diff?: ResumeImportDiff;
  startTime: number;
  endTime?: number;
}

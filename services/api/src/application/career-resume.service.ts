import { randomUUID } from 'node:crypto';

import {
  createChatCompletion,
  getChatCompletionText,
  getChatCompletionUsage,
  recordAIUsageEvent,
  startAIUsageTimer,
} from '@hominem/ai';
import { JOB_ANALYSIS_MODEL, RESUME_CUSTOMIZE_MODEL } from '@hominem/career-services';
import {
  extractPdfText,
  parseResumeWithAI,
  ResumeParseError,
} from '@hominem/career-services/resume';
import {
  normalizePortfolioSlug,
  resumeSchema,
  type ConvertedResumeData,
} from '@hominem/career-services/types';
import {
  CareerRepository,
  ProjectRepository,
  SkillRepository,
  SocialLinksRepository,
  type CareerSocialLinksRecord,
} from '@hominem/db/career';
import { db, sql } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import { runInTransaction, type DbHandle } from '@hominem/db/transaction';
import {
  createImportJob,
  getJobStatus,
  removeJobFromQueue,
  resumeAnalysisQueue,
  type ResumeAnalysisJob,
  type ResumeAnalysisQueuePayload,
  type ResumeImportDiff,
  type ResumeListItemChange,
} from '@hominem/queues';
import {
  documentStorageService,
  isStorageServiceError,
  resolveUploadMimeType,
  validateFile,
} from '@hominem/storage';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

const PDF_RESUME_VALIDATION = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedTypes: ['application/pdf'],
} as const;

const MAX_EXTRACTED_RESUME_TEXT_LENGTH = 80_000;

export type ResumeConvertStage =
  | 'request'
  | 'file-validation'
  | 'pdf-extraction'
  | 'ai-parse'
  | 'schema-validation'
  | 'storage'
  | 'database'
  | 'complete';

export class CareerResumeError extends Error {
  constructor(
    message: string,
    readonly status: ContentfulStatusCode,
    readonly stage: ResumeConvertStage,
    readonly retryable: boolean,
    readonly fileUrl?: string,
  ) {
    super(message);
    this.name = 'CareerResumeError';
  }
}

const RESUME_CUSTOMIZE_PROMPT = `You are an expert resume writer and career advisor. Your task is to create a customized resume based on the user's portfolio data and a specific job posting.

Guidelines:

1. Analyze the job posting to identify key requirements, skills, and qualifications
2. Match the user's experience and skills to the job requirements
3. Prioritize and highlight the most relevant experiences
4. Use action verbs and quantifiable achievements when possible
5. Tailor the language and keywords to match the job posting
6. Maintain professional formatting and structure
7. Focus on achievements and impact, not just responsibilities

Return a complete, professional resume in markdown format that is specifically tailored to this job opportunity.`;

const jobAnalysisSchema = z.object({
  requiredSkills: z.array(z.string()),
  qualifications: z.array(z.string()),
  cultureKeywords: z.array(z.string()),
  recommendedKeywords: z.array(z.string()),
});

const customizeResumeSchema = z.object({
  job_posting: z.string().min(100, 'Job posting must be at least 100 characters').optional(),
  resumeFormat: z
    .enum(['professional', 'modern', 'technical', 'executive'])
    .default('professional'),
  focusAreas: z.array(z.string()).optional().default([]),
  targetLength: z.enum(['concise', 'standard', 'detailed']).default('standard'),
});

const workExperiencePayloadSchema = resumeSchema.shape.workExperience.unwrap().element;
const skillPayloadSchema = resumeSchema.shape.skills.unwrap().element;
const projectPayloadSchema = resumeSchema.shape.projects.unwrap().element;

const basicsPatchSchema = z
  .object({
    headline: z.string().nullable(),
    summary: z.string().nullable(),
    tagline: z.string().nullable(),
    location: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    initials: z.string().nullable(),
    availabilityStatus: z.boolean(),
    openToRemote: z.boolean(),
  })
  .partial();

const socialPatchSchema = z
  .object({
    github: z.string().nullable(),
    linkedin: z.string().nullable(),
    twitter: z.string().nullable(),
    website: z.string().nullable(),
  })
  .partial();

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function storageFailureMessage(error: unknown): string {
  if (!isStorageServiceError(error)) {
    return 'Could not store the resume file. Check the storage configuration and try again.';
  }

  switch (error.code) {
    case 'storage.config.missing':
      return 'Resume storage is not configured yet. Check the storage configuration and try again.';
    case 'storage.credentials.invalid':
      return 'Resume storage credentials were rejected. Check the Cloudflare R2 configuration and try again.';
    case 'storage.bucket.access_denied':
      return 'Resume storage access was denied. Check the Cloudflare R2 bucket permissions and try again.';
    case 'storage.bucket.missing':
      return 'Resume storage bucket was not found. Check the Cloudflare R2 bucket name and try again.';
    case 'storage.network.unreachable':
      return 'Resume storage is temporarily unreachable. Try again in a moment.';
    default:
      return 'Could not store the resume file. Check the storage configuration and try again.';
  }
}

interface UploadedResume {
  file: File;
  fileId: string;
  fileUrl: string;
}

async function resolveResumeUpload(
  userId: string,
  input: { file?: File | undefined; fileId?: string | undefined },
): Promise<UploadedResume> {
  if (input.fileId) {
    const bytes = await documentStorageService.getFile(input.fileId, userId);
    if (!bytes) {
      throw new CareerResumeError(
        'That file was not found. It may have been deleted.',
        404,
        'file-validation',
        false,
      );
    }
    const listed = await documentStorageService.listUserFiles(userId);
    const meta = listed.find((entry) => entry.name.startsWith(input.fileId!));
    const fileUrl = (await documentStorageService.getFileUrl(input.fileId, userId)) ?? '';
    return {
      file: new File([Buffer.from(bytes)], meta?.name ?? `${input.fileId}.pdf`, {
        type: 'application/pdf',
      }),
      fileId: input.fileId,
      fileUrl,
    };
  }

  if (!input.file) {
    throw new CareerResumeError(
      'No PDF file was attached. Choose a resume PDF and try again.',
      400,
      'file-validation',
      true,
    );
  }

  const validation = validateFile(input.file, PDF_RESUME_VALIDATION);
  if (!validation.valid) {
    throw new CareerResumeError(
      validation.error ?? 'The selected file is not a valid resume PDF.',
      400,
      'file-validation',
      true,
    );
  }

  try {
    const buffer = Buffer.from(await input.file.arrayBuffer());
    const stored = await documentStorageService.storeFile(
      buffer,
      resolveUploadMimeType(input.file),
      userId,
      { originalName: input.file.name },
    );
    return { file: input.file, fileId: stored.id, fileUrl: stored.url };
  } catch (error) {
    throw new CareerResumeError(storageFailureMessage(error), 503, 'storage', true);
  }
}

/** Parse a resume PDF and replace (or create) the user's portfolio. */
export async function convertResume(
  userId: string,
  input: { file?: File | undefined; fileId?: string | undefined; replaceExisting: boolean },
) {
  const existingProfile = await CareerRepository.getProfile(db, userId);
  if (existingProfile && !input.replaceExisting) {
    throw new CareerResumeError(
      'You already have a portfolio. Replace it from your account or work page instead of creating another.',
      409,
      'request',
      false,
    );
  }
  if (input.replaceExisting && !existingProfile) {
    throw new CareerResumeError(
      'No existing portfolio was found to replace. Create a portfolio first.',
      404,
      'request',
      false,
    );
  }

  const upload = await resolveResumeUpload(userId, input);

  let pdfText: string;
  try {
    pdfText = await extractPdfText(upload.file);
  } catch {
    throw new CareerResumeError(
      'Could not read text from this PDF. Try a searchable PDF instead of a scanned or password-protected file. Your PDF was saved so you can retry.',
      400,
      'pdf-extraction',
      true,
      upload.fileUrl,
    );
  }

  if (!pdfText.trim()) {
    throw new CareerResumeError(
      'This PDF did not contain readable text. Upload a searchable resume PDF instead of a scanned image. Your PDF was saved so you can retry.',
      400,
      'pdf-extraction',
      true,
      upload.fileUrl,
    );
  }
  if (pdfText.length > MAX_EXTRACTED_RESUME_TEXT_LENGTH) {
    throw new CareerResumeError(
      'This resume contains too much text to process safely. Try a shorter resume PDF. Your PDF was saved so you can retry.',
      400,
      'pdf-extraction',
      true,
      upload.fileUrl,
    );
  }

  const eventId = randomUUID();
  const getDurationMs = startAIUsageTimer();
  let parsedResume: ConvertedResumeData;
  try {
    const parsed = await parseResumeWithAI(pdfText);
    await recordAIUsageEvent({
      eventId,
      userId,
      feature: 'career_resume_convert',
      operation: 'structured_output',
      usage: parsed.usage,
      model: parsed.model,
      status: 'succeeded',
      durationMs: getDurationMs(),
      metadata: {
        fileId: upload.fileId,
        extractedCharacterCount: pdfText.length,
        replaceExisting: input.replaceExisting,
      },
    });
    parsedResume = parsed.data;
  } catch (error) {
    if (error instanceof ResumeParseError) {
      throw new CareerResumeError(
        error.message,
        error.kind === 'schema-validation' ? 422 : 502,
        error.kind === 'schema-validation' ? 'schema-validation' : 'ai-parse',
        true,
        upload.fileUrl,
      );
    }
    throw new CareerResumeError(
      'Could not parse the resume with AI right now. Try again in a moment.',
      502,
      'ai-parse',
      true,
      upload.fileUrl,
    );
  }

  let saved: { profileId: string; profileSlug: string };
  try {
    saved = await saveResumeToDatabase(userId, parsedResume, {
      replaceProfileId: input.replaceExisting ? (existingProfile?.id ?? undefined) : undefined,
    });
  } catch {
    throw new CareerResumeError(
      'Your PDF was saved, but saving the portfolio failed. Check the database connection and migrations, then try again.',
      500,
      'database',
      true,
      upload.fileUrl,
    );
  }

  return {
    message: 'Resume uploaded and processed successfully',
    data: parsedResume,
    saved: true as const,
    portfolio_id: saved.profileId,
    portfolioSlug: saved.profileSlug,
    portfolioUrl: `/p/${saved.profileSlug}`,
    fileUrl: upload.fileUrl,
    stage: 'complete' as const,
    retryable: false,
  };
}

/** Store the PDF (if new) and enqueue the paced analysis worker. */
export async function startResumeAnalysis(
  userId: string,
  input: { file?: File | undefined; fileId?: string | undefined },
) {
  const existingProfile = await CareerRepository.getProfile(db, userId);
  const mode: ResumeAnalysisQueuePayload['mode'] = existingProfile ? 'replace' : 'create';
  const upload = await resolveResumeUpload(userId, input);

  const jobId = randomUUID();
  const now = Date.now();

  await createImportJob<ResumeAnalysisJob>({
    jobId,
    userId,
    type: 'resume-analysis',
    status: 'queued',
    stage: 'queued',
    fileId: upload.fileId,
    mode,
    startTime: now,
  });

  await resumeAnalysisQueue.add(
    'resume-analysis',
    {
      jobId,
      userId,
      fileId: upload.fileId,
      mode,
      existingProfileId: existingProfile?.id,
      createdAt: now,
    } satisfies ResumeAnalysisQueuePayload,
    { jobId },
  );

  return { jobId, fileUrl: upload.fileUrl };
}

export async function getResumeJob(userId: string, jobId: string) {
  const job = await getJobStatus<ResumeAnalysisJob>(jobId);
  if (!job || job.userId !== userId) return null;
  return job;
}

interface ResumePortfolio {
  name: string;
  jobTitle: string;
  currentLocation: string;
  email: string;
  phone: string | null;
  bio: string;
  workExperiences: Array<{
    role: string;
    company: string;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
  }>;
  skills: Array<{
    name: string;
    level: number | null;
    category: string | null;
    yearsOfExperience: number | null;
    description: string | null;
  }>;
  projects: Array<{
    title: string;
    status: string | null;
    description: string | null;
    technologies: string[];
    liveUrl: string | null;
    githubUrl: string | null;
  }>;
}

async function getResumePortfolio(userId: string): Promise<ResumePortfolio | null> {
  const [profile, positions, skills, projects] = await Promise.all([
    CareerRepository.getProfile(db, userId),
    CareerRepository.listEngagements(db, userId),
    SkillRepository.list(db, userId),
    ProjectRepository.list(db, userId),
  ]);
  if (!profile) return null;

  return {
    name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    jobTitle: profile.headline ?? '',
    currentLocation: profile.location ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? null,
    bio: profile.summary ?? '',
    workExperiences: positions.map((position) => ({
      role: position.title,
      company: position.company,
      startDate: position.startDate,
      endDate: position.endDate,
      description: position.description,
    })),
    skills: skills.map((skill) => ({
      name: skill.name,
      level: skill.level,
      category: skill.category,
      yearsOfExperience: skill.yearsOfExperience,
      description: skill.description,
    })),
    projects: projects.map((project) => ({
      title: project.title,
      status: project.status,
      description: project.description,
      technologies: jsonStringArray(project.technologies),
      liveUrl: project.liveUrl,
      githubUrl: project.githubUrl,
    })),
  };
}

function formatPortfolioForLLM(
  portfolio: ResumePortfolio,
  socialLinks: CareerSocialLinksRecord | null,
): string {
  let formatted = 'CANDIDATE PROFILE:\n';
  formatted += `Name: ${portfolio.name}\n`;
  formatted += `Current Role: ${portfolio.jobTitle}\n`;
  formatted += `Location: ${portfolio.currentLocation}\n`;
  formatted += `Email: ${portfolio.email}\n`;
  if (portfolio.phone) formatted += `Phone: ${portfolio.phone}\n`;
  formatted += `\nPROFESSIONAL SUMMARY:\n${portfolio.bio}\n`;

  formatted += '\nCONTACT LINKS:';
  if (socialLinks) {
    if (socialLinks.linkedin) formatted += `\n- LinkedIn: ${socialLinks.linkedin}`;
    if (socialLinks.github) formatted += `\n- GitHub: ${socialLinks.github}`;
    if (socialLinks.website) formatted += `\n- Website: ${socialLinks.website}`;
    if (socialLinks.twitter) formatted += `\n- Twitter: ${socialLinks.twitter}`;
  }

  formatted += '\n\nWORK EXPERIENCE:';
  portfolio.workExperiences.forEach((experience, index) => {
    const startDate = experience.startDate
      ? new Date(experience.startDate).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : 'Unknown';
    const endDate = experience.endDate
      ? new Date(experience.endDate).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : 'Present';
    formatted += `\n\n${index + 1}. ${experience.role} at ${experience.company} (${startDate} - ${endDate})\n`;
    formatted += `   Description: ${experience.description}`;
  });

  formatted += '\n\nSKILLS:';
  const skillsByCategory: Record<string, ResumePortfolio['skills']> = {};
  for (const skill of portfolio.skills) {
    const category = skill.category || 'Other';
    (skillsByCategory[category] ??= []).push(skill);
  }
  for (const [category, skills] of Object.entries(skillsByCategory)) {
    formatted += `\n\n${category}:`;
    for (const skill of skills) {
      formatted += `\n- ${skill.name} (${skill.level}% proficiency)`;
      if (skill.yearsOfExperience) formatted += ` - ${skill.yearsOfExperience} years`;
      if (skill.description) formatted += ` - ${skill.description}`;
    }
  }

  formatted += '\n\nPROJECTS:';
  portfolio.projects.forEach((project, index) => {
    formatted += `\n\n${index + 1}. ${project.title} (${project.status})\n`;
    formatted += `   Description: ${project.description}`;
    if (project.technologies.length > 0) {
      formatted += `\n   Technologies: ${project.technologies.join(', ')}`;
    }
    if (project.liveUrl) formatted += `\n   Live URL: ${project.liveUrl}`;
    if (project.githubUrl) formatted += `\n   GitHub: ${project.githubUrl}`;
  });

  return formatted;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(jsonMatch?.[1] ?? trimmed);
}

/** Tailor the portfolio resume to a specific job posting and analyze the posting. */
export async function customizeResume(userId: string, body: unknown) {
  const validation = customizeResumeSchema.safeParse(body);
  if (!validation.success) {
    throw new ValidationError(validation.error.issues[0]?.message ?? 'Invalid input');
  }

  const { job_posting: jobPosting, resumeFormat, focusAreas, targetLength } = validation.data;
  if (!jobPosting) {
    throw new ValidationError('job_posting must be provided');
  }

  const portfolio = await getResumePortfolio(userId);
  if (!portfolio) {
    throw new ValidationError('No portfolio found. Please create your portfolio first.');
  }

  const socialLinks = await SocialLinksRepository.get(db, userId);
  const systemPrompt = `${RESUME_CUSTOMIZE_PROMPT}

Resume Format: ${resumeFormat}
Target Length: ${targetLength}
${focusAreas.length > 0 ? `Focus Areas: ${focusAreas.join(', ')}` : ''}`;

  const userPrompt = `JOB POSTING:
${jobPosting}

USER PORTFOLIO DATA:
${formatPortfolioForLLM(portfolio, socialLinks)}

Please create a customized resume that highlights the most relevant experience and skills for this specific job opportunity.`;

  const resumeEventId = randomUUID();
  const getResumeDurationMs = startAIUsageTimer();
  let result;
  try {
    result = await createChatCompletion({
      model: RESUME_CUSTOMIZE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    });
  } catch (error) {
    await recordAIUsageEvent({
      eventId: resumeEventId,
      userId,
      feature: 'career_resume_customize',
      operation: 'chat_completion',
      status: 'failed',
      error,
      durationMs: getResumeDurationMs(),
      metadata: { call: 'resume_generation' },
    });
    throw error;
  }
  await recordAIUsageEvent({
    eventId: resumeEventId,
    userId,
    feature: 'career_resume_customize',
    operation: 'chat_completion',
    usage: getChatCompletionUsage(result),
    model: result.model,
    status: 'succeeded',
    durationMs: getResumeDurationMs(),
    metadata: { resumeFormat, targetLength, call: 'resume_generation' },
  });

  const analysisEventId = randomUUID();
  const getAnalysisDurationMs = startAIUsageTimer();
  const analysisResult = await createChatCompletion({
    model: JOB_ANALYSIS_MODEL,
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are an expert job posting analyzer. Return only valid JSON with requiredSkills, qualifications, cultureKeywords, and recommendedKeywords arrays.',
      },
      {
        role: 'user',
        content: `Analyze this job posting and extract the most important information:\n\n${jobPosting}`,
      },
    ],
    temperature: 0.1,
  });
  await recordAIUsageEvent({
    eventId: analysisEventId,
    userId,
    feature: 'career_resume_customize',
    operation: 'structured_output',
    usage: getChatCompletionUsage(analysisResult),
    model: analysisResult.model,
    status: 'succeeded',
    durationMs: getAnalysisDurationMs(),
    metadata: { resumeFormat, targetLength, call: 'job_analysis' },
  });

  const parsedAnalysis = jobAnalysisSchema.safeParse(
    parseJsonObject(getChatCompletionText(analysisResult)),
  );

  return {
    customizedResume: getChatCompletionText(result),
    jobAnalysis: parsedAnalysis.success ? parsedAnalysis.data : null,
    metadata: {
      format: resumeFormat,
      targetLength,
      focusAreas,
      generatedAt: new Date().toISOString(),
      portfolio_id: userId,
      job_posting_word_count: jobPosting.split(/\s+/).length,
    },
  };
}

function mapWorkExperiencePayload(payload: ConvertedResumeData['workExperience'][number]) {
  return {
    company: payload.company,
    title: payload.role,
    description: payload.description,
    startDate: payload.start_date ?? null,
    endDate: payload.end_date ?? null,
  };
}

function mapSkillPayload(payload: ConvertedResumeData['skills'][number]) {
  return {
    name: payload.name,
    level: payload.level,
    category: payload.category ?? null,
    description: payload.description ?? null,
    yearsOfExperience: payload.years_of_experience ?? null,
    sortOrder: 0,
  };
}

function mapProjectPayload(payload: ConvertedResumeData['projects'][number]) {
  return {
    title: payload.title,
    description: payload.description,
    shortDescription: payload.short_description ?? null,
    liveUrl: payload.live_url ?? null,
    githubUrl: payload.github_url ?? null,
    technologies: payload.technologies,
    status:
      payload.status === 'in-progress'
        ? ('IN_PROGRESS' as const)
        : payload.status === 'completed'
          ? ('DONE' as const)
          : ('CANCELED' as const),
    isVisible: true,
    isFeatured: false,
    sortOrder: 0,
  };
}

async function applySelectedListItems(tx: DbHandle, userId: string, items: ResumeListItemChange[]) {
  for (const item of items) {
    if (item.group === 'workExperience') {
      await CareerRepository.createEngagement(
        tx,
        userId,
        mapWorkExperiencePayload(workExperiencePayloadSchema.parse(item.payload)),
      );
    } else if (item.group === 'skills') {
      await SkillRepository.create(
        tx,
        userId,
        mapSkillPayload(skillPayloadSchema.parse(item.payload)),
      );
    } else {
      await ProjectRepository.create(
        tx,
        userId,
        mapProjectPayload(projectPayloadSchema.parse(item.payload)),
      );
    }
  }
}

/** Apply only the diff items the user selected; values come from the worker's job record. */
export async function applyResumeImport(
  userId: string,
  jobId: string,
  selection: { scalarKeys: string[]; listKeys: string[] },
) {
  const job = await getJobStatus<ResumeAnalysisJob>(jobId);
  if (!job || job.userId !== userId) {
    throw new ValidationError('Resume analysis job not found.');
  }
  if (job.status !== 'done' || !job.diff) {
    throw new ValidationError('Resume analysis is not complete yet.');
  }

  const diff: ResumeImportDiff = job.diff;
  const scalarKeys = new Set(selection.scalarKeys);
  const listKeys = new Set(selection.listKeys);
  const scalarToApply = diff.scalarChanges.filter((change) =>
    scalarKeys.has(`${change.group}.${change.field}`),
  );
  const listToApply = diff.listChanges.filter((item) => listKeys.has(item.key));
  if (scalarToApply.length === 0 && listToApply.length === 0) {
    throw new ValidationError('Select at least one change to apply.');
  }

  const profileId = await runInTransaction(async (tx) => {
    const basicsPatch = basicsPatchSchema.parse(
      Object.fromEntries(
        scalarToApply
          .filter((change) => change.group === 'basics')
          .map((change) => [change.field, change.proposed]),
      ),
    );
    if (Object.keys(basicsPatch).length > 0) {
      await CareerRepository.saveProfile(tx, userId, basicsPatch);
    }

    const socialPatch = socialPatchSchema.parse(
      Object.fromEntries(
        scalarToApply
          .filter((change) => change.group === 'social')
          .map((change) => [change.field, change.proposed]),
      ),
    );
    if (Object.keys(socialPatch).length > 0) {
      const existing = await SocialLinksRepository.get(tx, userId);
      await SocialLinksRepository.save(tx, userId, {
        github: existing?.github ?? null,
        linkedin: existing?.linkedin ?? null,
        twitter: existing?.twitter ?? null,
        website: existing?.website ?? null,
        ...socialPatch,
      });
    }

    await applySelectedListItems(tx, userId, listToApply);

    const profile = await CareerRepository.getProfile(tx, userId);
    if (!profile) throw new ValidationError('Profile not found after applying resume changes.');
    return profile.id;
  });

  await removeJobFromQueue(jobId, userId);
  return { profileId };
}

async function saveResumeToDatabase(
  ownerUserId: string,
  data: ConvertedResumeData,
  options: { replaceProfileId?: string } = {},
): Promise<{ profileId: string; profileSlug: string }> {
  return runInTransaction(async (tx) => {
    const profileToReplaceId =
      options.replaceProfileId ?? (await CareerRepository.getProfile(tx, ownerUserId))?.id;
    if (profileToReplaceId) {
      await CareerRepository.deleteProfile(tx, ownerUserId);
    }

    const slug = await generateUniqueSlug(tx, data.portfolio.slug, data.portfolio.name);
    const [firstName, ...rest] = data.portfolio.name.split(' ');

    const createdProfile = await CareerRepository.saveProfile(tx, ownerUserId, {
      slug,
      title: data.portfolio.title,
      firstName,
      lastName: rest.join(' ') || null,
      headline: data.portfolio.job_title,
      summary: data.portfolio.bio,
      tagline: data.portfolio.tagline,
      location: data.portfolio.current_location,
      email: data.portfolio.email,
      phone: data.portfolio.phone ?? null,
      initials: data.portfolio.initials ?? null,
      isPublic: data.portfolio.is_public,
      isActive: data.portfolio.is_active,
      availabilityStatus: data.portfolio.availability_status,
      openToRemote: data.portfolio.open_to_remote ?? false,
    });

    if (data.social_links) {
      const existing = await SocialLinksRepository.get(tx, ownerUserId);
      await SocialLinksRepository.save(tx, ownerUserId, {
        github: data.social_links.github ?? existing?.github ?? null,
        linkedin: data.social_links.linkedin ?? existing?.linkedin ?? null,
        twitter: data.social_links.twitter ?? existing?.twitter ?? null,
        website: data.social_links.website ?? existing?.website ?? null,
      });
    }

    for (const workExperience of data.workExperience) {
      await CareerRepository.createEngagement(tx, ownerUserId, {
        company: workExperience.company,
        title: workExperience.role,
        description: workExperience.description,
        startDate: workExperience.start_date ?? null,
        endDate: workExperience.end_date ?? null,
      });
    }
    for (const skill of data.skills) {
      await SkillRepository.create(tx, ownerUserId, {
        name: skill.name,
        level: skill.level,
        category: skill.category ?? null,
        description: skill.description ?? null,
        yearsOfExperience: skill.years_of_experience ?? null,
        sortOrder: 0,
      });
    }
    for (const project of data.projects) {
      await ProjectRepository.create(tx, ownerUserId, {
        title: project.title,
        description: project.description,
        shortDescription: project.short_description ?? null,
        liveUrl: project.live_url ?? null,
        githubUrl: project.github_url ?? null,
        technologies: project.technologies,
        status:
          project.status === 'in-progress'
            ? 'IN_PROGRESS'
            : project.status === 'completed'
              ? 'DONE'
              : 'CANCELED',
        isVisible: true,
        isFeatured: false,
        sortOrder: 0,
      });
    }

    return { profileId: createdProfile.id, profileSlug: slug };
  });
}

function truncateSlugBase(slug: string, suffix = ''): string {
  const maxBaseLength = 50 - suffix.length;
  return slug.slice(0, maxBaseLength).replace(/-$/g, '') || 'portfolio';
}

async function generateUniqueSlug(
  handle: DbHandle,
  base: string,
  fallbackBase = 'portfolio',
): Promise<string> {
  const normalizedBase =
    normalizePortfolioSlug(base) || normalizePortfolioSlug(fallbackBase) || 'portfolio';
  const root = truncateSlugBase(normalizedBase);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = `${truncateSlugBase(root, suffix)}${suffix}`;
    const existing = await handle
      .selectFrom('app.careerProfile')
      .select('id')
      .where(sql`lower(slug)`, '=', candidate.toLowerCase())
      .executeTakeFirst();
    if (!existing) return candidate;
  }

  throw new Error('Could not generate a unique profile slug.');
}

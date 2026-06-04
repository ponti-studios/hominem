import { CareerRepository, getDb } from '@hominem/db';
import { createChatCompletion, getChatCompletionText } from '@hominem/services/ai-model';
import { createStorageService, resolveUploadMimeType, validateFile } from '@hominem/storage';
import type { ActionFunction } from 'react-router';

import { getAuthenticatedUser } from '../lib/auth.server';
import { logger } from '../lib/logger';
import { getRateLimitHeaders, resumeConvertRateLimit } from '../lib/rate-limit';
import { extractPdfText } from '../lib/services/pdf-text.server';
import { saveResumeToDatabase } from '../lib/services/resume-conversion.service';
import type { ConvertedResumeData, ResumeConvertStage, UploadResumeResponse } from '../types/resume';
import { resumeSchema } from '../types/resume';

const MAX_EXTRACTED_RESUME_TEXT_LENGTH = 80_000;
const resumeStorage = createStorageService('documents', {
  maxFileSize: 10 * 1024 * 1024,
  isPublic: false,
});
const PDF_RESUME_VALIDATION = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedTypes: ['application/pdf'],
} as const;
const RESUME_PARSER_SYSTEM_PROMPT =
  'You are an expert resume parser. Return only valid JSON matching the requested resume schema. ' +
  'Required strings must not be blank. Dates must be YYYY-MM-DD, YYYY-MM, or null; use null for present/current roles. ' +
  'Repeatable sections must be arrays, using empty arrays when absent. Slugs must be lowercase kebab-case, 3 to 50 characters.';

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(jsonMatch?.[1] ?? trimmed);
}

function jsonResponse(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function errorResponse(
  error: string,
  status: number,
  stage: ResumeConvertStage,
  retryable: boolean,
  extra?: Omit<UploadResumeResponse, 'error' | 'stage' | 'retryable'>,
  headers?: HeadersInit,
): Response {
  return jsonResponse(
    { error, stage, retryable, ...extra } satisfies UploadResumeResponse,
    status,
    headers,
  );
}

function storageFailureMessage(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'Could not store the resume file. Check the Cloudflare R2 configuration and try again.';
  }

  return 'Could not store the resume file. Start local MinIO and make sure the storage bucket is available, then try again.';
}

function logRouteError(message: string, error: unknown, context?: Record<string, unknown>): void {
  logger.error(
    message,
    error instanceof Error ? error : undefined,
    error instanceof Error ? context : { ...context, error },
  );
}

const resumeJsonShape = {
  portfolio: {
    slug: 'string',
    title: 'string',
    name: 'string',
    initials: 'string | null',
    job_title: 'string',
    bio: 'string',
    tagline: 'string',
    current_location: 'string',
    location_tagline: 'string | null',
    email: 'email string',
    phone: 'string | null',
    availability_status: 'boolean',
    availability_message: 'string | null',
    is_public: 'boolean',
    is_active: 'boolean',
  },
  social_links: {
    github: 'string | null',
    linkedin: 'string | null',
    twitter: 'string | null',
    website: 'string | null',
  },
  workExperience: [
    {
      company: 'string',
      description: 'string',
      role: 'string',
      start_date: 'string | null',
      end_date: 'string | null',
    },
  ],
  skills: [
    {
      name: 'string',
      level: 'number from 1 to 100',
      category: 'string | null',
      description: 'string | null',
      years_of_experience: 'number | null',
      certifications: ['string'],
    },
  ],
  projects: [
    {
      title: 'string',
      description: 'string',
      short_description: 'string | null',
      technologies: ['string'],
      live_url: 'string | null',
      github_url: 'string | null',
      status: 'in-progress | completed | archived',
    },
  ],
  stats: [{ label: 'string', value: 'string' }],
};

export const action: ActionFunction = async ({ request }) => {
  let owner_userid: string | undefined;

  try {
    const sessionUser = await getAuthenticatedUser(request);
    if (!sessionUser) {
      return errorResponse('Please log in to upload your resume.', 401, 'auth', false);
    }
    const user = sessionUser;
    owner_userid = user.id;

    const rateLimit = resumeConvertRateLimit.isAllowed(user.id);
    const rateLimitHeaders = getRateLimitHeaders(rateLimit, resumeConvertRateLimit);
    if (!rateLimit.allowed) {
      return errorResponse(
        'Too many resume conversion attempts. Try again later.',
        429,
        'rate-limit',
        true,
        {
          rateLimit: {
            limit: resumeConvertRateLimit.maxRequests,
            remaining: rateLimit.remaining,
            reset: Math.ceil(rateLimit.resetTime / 1000),
          },
        },
        rateLimitHeaders,
      );
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse(
        'Upload must be sent as multipart form data with a PDF file.',
        400,
        'request',
        true,
      );
    }

    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;
    const replaceExisting = formData.get('replaceExisting') === 'true';
    if (!file) {
      return errorResponse(
        'No PDF file was attached. Choose a resume PDF and try again.',
        400,
        'file-validation',
        true,
      );
    }

    const existingPortfolio = await CareerRepository.getPortfolioByUserId(getDb(), user.id);
    if (existingPortfolio && !replaceExisting) {
      return errorResponse(
        'Uploading this resume will replace your existing portfolio.',
        409,
        'replace-confirmation',
        false,
        {
          existingPortfolio: {
            slug: existingPortfolio.slug,
            title: existingPortfolio.title,
          },
        },
      );
    }

    const validation = validateFile(file, PDF_RESUME_VALIDATION);
    if (!validation.valid) {
      return errorResponse(
        validation.error ?? 'The selected file is not a valid resume PDF.',
        400,
        'file-validation',
        true,
      );
    }
    const uploadMimeType = resolveUploadMimeType(file);

    let pdfText: string;
    try {
      pdfText = await extractPdfText(file);
    } catch (error) {
      logRouteError('Resume PDF text extraction failed', error, {
        owner_userid: user.id,
        fileName: file.name,
        fileSize: file.size,
      });
      return errorResponse(
        'Could not read text from this PDF. Try a searchable PDF instead of a scanned or password-protected file.',
        400,
        'pdf-extraction',
        true,
      );
    }

    if (!pdfText.trim()) {
      return errorResponse(
        'This PDF did not contain readable text. Upload a searchable resume PDF instead of a scanned image.',
        400,
        'pdf-extraction',
        true,
      );
    }

    if (pdfText.length > MAX_EXTRACTED_RESUME_TEXT_LENGTH) {
      return errorResponse(
        'This resume contains too much text to process safely. Try a shorter resume PDF.',
        400,
        'pdf-extraction',
        true,
      );
    }

    let aiContent: string;
    try {
      const result = await createChatCompletion({
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: RESUME_PARSER_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Parse this resume into structured JSON compatible with this shape:

${JSON.stringify(resumeJsonShape, null, 2)}

Resume text:
${pdfText}`,
          },
        ],
      });
      aiContent = getChatCompletionText(result);
    } catch (error) {
      logRouteError('Resume AI parsing request failed', error, {
        owner_userid: user.id,
        fileName: file.name,
      });
      return errorResponse(
        'Could not parse the resume with AI right now. Check the AI service configuration and try again.',
        502,
        'ai-parse',
        true,
      );
    }

    if (!aiContent.trim()) {
      logger.error('Resume AI parsing returned empty content', undefined, {
        owner_userid: user.id,
        fileName: file.name,
      });
      return errorResponse(
        'The AI parser returned an empty response. Try again, or upload a simpler resume PDF.',
        502,
        'ai-parse',
        true,
      );
    }

    let parsedResume: unknown;
    try {
      parsedResume = parseJsonObject(aiContent);
    } catch (error) {
      logRouteError('Resume AI parsing returned invalid JSON', error, {
        owner_userid: user.id,
        fileName: file.name,
      });
      return errorResponse(
        'The AI parser returned malformed resume data. Try again, or upload a simpler resume PDF.',
        502,
        'ai-parse',
        true,
      );
    }

    const {
      success,
      data,
      error: schemaError,
    } = resumeSchema.safeParse(parsedResume as ConvertedResumeData);
    if (!success) {
      logger.error('Resume AI parsing failed schema validation', undefined, {
        owner_userid: user.id,
        fileName: file.name,
        issues: schemaError.issues,
      });
      return errorResponse(
        'The parsed resume data was incomplete or invalid. Try again, or update the PDF with clearer resume sections.',
        422,
        'schema-validation',
        true,
      );
    }

    let uploadResult: { id: string; url: string };
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      uploadResult = await resumeStorage.storeFile(buffer, uploadMimeType, user.id, {
        originalName: file.name,
      });
    } catch (error) {
      logger.error('Resume file upload failed', undefined, {
        owner_userid: user.id,
        fileName: file.name,
        error: error instanceof Error ? error.message : error,
      });
      return errorResponse(storageFailureMessage(), 503, 'storage', true);
    }

    let portfolio_id: string;
    let portfolioSlug: string;
    try {
      const saveResult = await saveResumeToDatabase(user.id, data);
      portfolio_id = saveResult.portfolio_id;
      portfolioSlug = saveResult.portfolioSlug;
    } catch (error) {
      logRouteError('Resume database save failed', error, {
        owner_userid: user.id,
        fileName: file.name,
      });
      if (uploadResult.id) {
        try {
          const deleted = await resumeStorage.deleteFile(uploadResult.id, user.id);
          if (!deleted) {
            logger.error('Resume upload cleanup after database failure failed', undefined, {
              owner_userid: user.id,
              fileName: file.name,
              fileId: uploadResult.id,
              error: 'File not found',
            });
          }
        } catch (cleanupError) {
          logRouteError('Resume upload cleanup after database failure threw', cleanupError, {
            owner_userid: user.id,
            fileName: file.name,
            fileId: uploadResult.id,
          });
        }
      }
      return errorResponse(
        'Resume was parsed and uploaded, but saving the portfolio failed. Check the database connection and migrations.',
        500,
        'database',
        true,
      );
    }

    return jsonResponse({
      message: 'Resume uploaded and processed successfully',
      data,
      saved: true,
      portfolio_id,
      portfolioSlug,
      portfolioUrl: `/p/${portfolioSlug}`,
      fileUrl: uploadResult.url,
      stage: 'complete',
      retryable: false,
    } satisfies UploadResumeResponse);
  } catch (err) {
    logRouteError('Resume conversion request failed before processing', err, { owner_userid });

    return errorResponse(
      'Could not start resume conversion. Please try again.',
      500,
      'request',
      true,
    );
  }
};

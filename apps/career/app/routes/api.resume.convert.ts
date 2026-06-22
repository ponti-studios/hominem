import { readFile } from 'node:fs/promises';

import { createChatCompletion, getChatCompletionText, OpenRouterRequestError } from '@hominem/ai';
import { CareerRepository, db } from '@hominem/db';
import { createStorageService, resolveUploadMimeType, validateFile } from '@hominem/storage';
import { data, type ActionFunction } from 'react-router';
import { z } from 'zod';

import type { UploadResumeApiResponse } from '../lib/api-contracts';
import { logger } from '../lib/logger';
import { userContext } from '../lib/middleware';
import { getRateLimitHeaders, resumeConvertRateLimit } from '../lib/rate-limit';
import { extractPdfText } from '../lib/services/pdf-text.server';
import { saveResumeToDatabase } from '../lib/services/resume-conversion.service';
import type { ConvertedResumeData, ResumeConvertStage } from '../types/resume';
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
const RESUME_PARSER_PROMPT_URL = new URL('../lib/prompts/resume-parser.md', import.meta.url);
let resumeParserSystemPromptPromise: Promise<string> | null = null;
const resumeParserJsonSchema = z.toJSONSchema(resumeSchema);

async function loadResumeParserSystemPrompt(): Promise<string> {
  if (!resumeParserSystemPromptPromise) {
    resumeParserSystemPromptPromise = readFile(RESUME_PARSER_PROMPT_URL, 'utf8').then((content) =>
      content.trim(),
    );
  }

  return resumeParserSystemPromptPromise;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(jsonMatch?.[1] ?? trimmed);
}

function errorResponse(
  error: string,
  status: number,
  stage: ResumeConvertStage,
  retryable: boolean,
  extra?: Omit<UploadResumeApiResponse, 'error' | 'stage' | 'retryable'>,
  headers?: HeadersInit,
): ReturnType<typeof data<UploadResumeApiResponse>> {
  return data({ error, stage, retryable, ...extra } satisfies UploadResumeApiResponse, {
    status,
    headers,
  });
}

function logRouteError(message: string, error: unknown, context?: Record<string, unknown>): void {
  const errorContext =
    error instanceof OpenRouterRequestError
      ? {
          ...context,
          ai_error: {
            status: error.status,
            statusText: error.statusText,
            code: error.code,
            providerMessage: error.providerMessage,
            details: error.details,
          },
        }
      : context;

  logger.error(
    message || (error instanceof Error ? error.message : ''),
    error instanceof Error ? error : undefined,
    errorContext,
  );
}

function resolveAiParseFailure(error: unknown) {
  if (error instanceof OpenRouterRequestError) {
    if (error.code === 'missing_api_key') {
      return {
        error: 'Resume parsing AI is not configured yet. Set OPENROUTER_API_KEY and try again.',
        status: 503,
      };
    }

    if (error.status === 401 || error.status === 402 || error.status === 403) {
      return {
        error:
          'Resume parsing AI is unavailable because the provider credentials were rejected. Check the AI service configuration and try again.',
        status: 502,
      };
    }

    if (error.status === 429) {
      return {
        error: 'Resume parsing AI is temporarily rate limited. Wait a moment and try again.',
        status: 503,
      };
    }
  }

  return {
    error: 'Could not parse the resume with AI right now. Try again in a moment.',
    status: 502,
  };
}

export const action: ActionFunction = async ({ request, context }) => {
  const user = context.get(userContext)!;
  let owner_userid: string | undefined = user.id;

  try {
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
    let existingPortfolio: { id: string } | null = null;
    if (!file) {
      return errorResponse(
        'No PDF file was attached. Choose a resume PDF and try again.',
        400,
        'file-validation',
        true,
      );
    }

    if (replaceExisting) {
      existingPortfolio = await CareerRepository.getPortfolioByUserId(db, user.id);
      if (!existingPortfolio) {
        return errorResponse(
          'No existing portfolio was found to replace. Create a portfolio first.',
          404,
          'request',
          false,
        );
      }
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
      const resumeParserSystemPrompt = await loadResumeParserSystemPrompt();
      const result = await createChatCompletion({
        responseFormat: {
          type: 'json_schema',
          jsonSchema: {
            name: 'resume_parser',
            schema: resumeParserJsonSchema,
            strict: true,
          },
        },
        messages: [
          {
            role: 'system',
            content: resumeParserSystemPrompt,
          },
          {
            role: 'user',
            content: `Parse this resume into structured JSON. Resume text:\n${pdfText}`,
          },
        ],
      });
      aiContent = getChatCompletionText(result);
    } catch (error) {
      logRouteError('Resume AI parsing request failed', error, {
        owner_userid: user.id,
        fileName: file.name,
      });
      const failure = resolveAiParseFailure(error);
      return errorResponse(failure.error, failure.status, 'ai-parse', true);
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
      return errorResponse(
        'Could not store the resume file. Check the storage configuration and try again.',
        503,
        'storage',
        true,
      );
    }

    let portfolio_id: string;
    let portfolioSlug: string;
    try {
      const saveResult = await saveResumeToDatabase(user.id, data, {
        replacePortfolioId: replaceExisting ? (existingPortfolio?.id ?? undefined) : undefined,
      });
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

    return {
      message: 'Resume uploaded and processed successfully',
      data,
      saved: true,
      portfolio_id,
      portfolioSlug,
      portfolioUrl: `/p/${portfolioSlug}`,
      fileUrl: uploadResult.url,
      stage: 'complete',
      retryable: false,
    } satisfies UploadResumeApiResponse;
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

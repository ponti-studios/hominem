import { createChatCompletion, getChatCompletionText } from '@hominem/ai';
import { readFile } from 'node:fs/promises';
import type { ActionFunction } from 'react-router';
import { z } from 'zod';

import { jobScrapingService } from '~/lib/services/job-scraping.service';

import { getAuthenticatedUser, requireAuth } from '../lib/auth.server';
import { logger } from '../lib/logger';
import { getFullUserPortfolio } from '../lib/portfolio.server';
import { formatPortfolioForLLM } from '../lib/utils/portfolio-formatter';

const RESUME_CUSTOMIZE_PROMPT_URL = new URL('../lib/prompts/resume-customize.md', import.meta.url);
let resumeCustomizeSystemPromptPromise: Promise<string> | null = null;

async function loadResumeCustomizeSystemPrompt(): Promise<string> {
  if (!resumeCustomizeSystemPromptPromise) {
    resumeCustomizeSystemPromptPromise = readFile(RESUME_CUSTOMIZE_PROMPT_URL, 'utf8').then(
      (content) => content.trim(),
    );
  }

  return resumeCustomizeSystemPromptPromise;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(jsonMatch?.[1] ?? trimmed);
}

// Input validation schema
const customizeResumeSchema = z.object({
  job_posting: z.string().min(100, 'Job posting must be at least 100 characters').optional(),
  job_posting_url: z.string().url('Invalid job posting URL').optional(),
  jobPostingData: z
    .object({
      job_title: z.string(),
      companyName: z.string(),
      jobDescription: z.string(),
      requirements: z.array(z.string()),
      skills: z.array(z.string()),
      fullText: z.string(),
      url: z.string(),
      scrapedAt: z.string(),
      wordCount: z.number(),
    })
    .optional(),
  resumeFormat: z
    .enum(['professional', 'modern', 'technical', 'executive'])
    .default('professional'),
  focusAreas: z.array(z.string()).optional().default([]),
  targetLength: z.enum(['concise', 'standard', 'detailed']).default('standard'),
});

// Job analysis schema
const jobAnalysisSchema = z.object({
  requiredSkills: z.array(z.string()).describe('Top 5 required skills from the job posting'),
  qualifications: z.array(z.string()).describe('Top 3 most important qualifications'),
  cultureKeywords: z.array(z.string()).describe('Company culture keywords from the posting'),
  recommendedKeywords: z
    .array(z.string())
    .describe('Keywords to include in the resume for ATS optimization'),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

export const action: ActionFunction = async ({ request }) => {
  try {
    const sessionUser = await getAuthenticatedUser(request);
    const user = requireAuth(sessionUser);

    // Validate request method
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate input
    const body = await request.json();
    const validation = customizeResumeSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: validation.error.issues,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { job_posting, job_posting_url, jobPostingData, resumeFormat, focusAreas, targetLength } =
      validation.data;

    // Handle job posting input - either direct text, URL to scrape, or structured data
    let finalJobPosting: string;
    let jobPostingSource: 'text' | 'scraped' | 'structured' = 'text';
    let jobPostingMetadata: {
      job_title?: string;
      companyName?: string;
      requirements?: string[];
      skills?: string[];
    } = {};

    if (jobPostingData) {
      // Use provided structured job posting data
      finalJobPosting = jobPostingData.fullText;
      jobPostingSource = 'structured';
      jobPostingMetadata = {
        job_title: jobPostingData.job_title,
        companyName: jobPostingData.companyName,
        requirements: jobPostingData.requirements,
        skills: jobPostingData.skills,
      };
    } else if (job_posting_url) {
      const scrapingResult = await jobScrapingService.scrapeAndValidateJobPosting(job_posting_url);

      if (!scrapingResult.success || !scrapingResult.job_posting) {
        return new Response(
          JSON.stringify({ error: scrapingResult.error || 'Failed to scrape job posting' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      finalJobPosting = scrapingResult.job_posting.fullText;
      jobPostingSource = 'scraped';
      jobPostingMetadata = {
        job_title: scrapingResult.job_posting.job_title,
        companyName: scrapingResult.job_posting.companyName,
        requirements: scrapingResult.job_posting.requirements,
        skills: scrapingResult.job_posting.skills,
      };
    } else if (job_posting) {
      // Use provided job posting text
      finalJobPosting = job_posting;
    } else {
      return new Response(
        JSON.stringify({
          error: 'Either job_posting, job_posting_url, or jobPostingData must be provided',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Fetch user's portfolio data
    const portfolio = await getFullUserPortfolio(user.id);

    if (!portfolio) {
      return new Response(
        JSON.stringify({
          error: 'No portfolio found. Please create your portfolio first.',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Format portfolio data for better LLM consumption using utility function
    const portfolioContext = formatPortfolioForLLM(portfolio);

    // Create AI prompt for resume customization
    const baseSystemPrompt = await loadResumeCustomizeSystemPrompt();
    const systemPrompt = `${baseSystemPrompt}

Resume Format: ${resumeFormat}
Target Length: ${targetLength}
${focusAreas.length > 0 ? `Focus Areas: ${focusAreas.join(', ')}` : ''}`;

    const userPrompt = `JOB POSTING:
${finalJobPosting}

USER PORTFOLIO DATA:
${portfolioContext}

Please create a customized resume that highlights the most relevant experience and skills for this specific job opportunity.`;

    // Generate customized resume using the shared monorepo AI client
    const result = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.3, // Lower temperature for more consistent, professional output
    });

    // Extract key insights from the job posting for additional context
    const analysisResult = await createChatCompletion({
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert job posting analyzer. Return only valid JSON with requiredSkills, qualifications, cultureKeywords, and recommendedKeywords arrays.',
        },
        {
          role: 'user',
          content: `Analyze this job posting and extract the most important information:

${finalJobPosting}`,
        },
      ],
      temperature: 0.1,
    });

    const parsedAnalysis = parseJsonObject(getChatCompletionText(analysisResult));
    const analysisValidation = jobAnalysisSchema.safeParse(parsedAnalysis);

    if (!analysisValidation.success) {
      logger.warn('Failed to parse job analysis with schema', {
        owner_userid: user.id,
        issues: analysisValidation.error.issues,
      });
    }

    const responseData = {
      customizedResume: getChatCompletionText(result),
      jobAnalysis: analysisValidation.success ? analysisValidation.data : null,
      metadata: {
        format: resumeFormat,
        targetLength,
        focusAreas,
        generatedAt: new Date().toISOString(),
        portfolio_id: portfolio.id,
        jobPostingSource,
        job_posting_url: job_posting_url || null,
        job_posting_word_count: finalJobPosting.split(/\s+/).length,
        jobPostingMetadata,
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error(
      'Resume customization error',
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );

    return new Response(JSON.stringify({ error: 'Unable to customize resume' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

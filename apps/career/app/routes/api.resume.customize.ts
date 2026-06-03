import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import type { ActionFunction } from 'react-router';
import { z } from 'zod';

import { jobScrapingService } from '~/lib/services/job-scraping.service';

import { getAuthenticatedUser, requireAuth } from '../lib/auth.server';
import { getFullUserPortfolio } from '../lib/portfolio.server';
import { formatPortfolioForLLM } from '../lib/utils/portfolio-formatter';

const model = openai('gpt-4o');

// Input validation schema
const customizeResumeSchema = z.object({
  jobPosting: z.string().min(100, 'Job posting must be at least 100 characters').optional(),
  jobPostingUrl: z.string().url('Invalid job posting URL').optional(),
  jobPostingData: z
    .object({
      jobTitle: z.string(),
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

    const { jobPosting, jobPostingUrl, jobPostingData, resumeFormat, focusAreas, targetLength } =
      validation.data;

    // Handle job posting input - either direct text, URL to scrape, or structured data
    let finalJobPosting: string;
    let jobPostingSource: 'text' | 'scraped' | 'structured' = 'text';
    let jobPostingMetadata: {
      jobTitle?: string;
      companyName?: string;
      requirements?: string[];
      skills?: string[];
    } = {};

    if (jobPostingData) {
      // Use provided structured job posting data
      finalJobPosting = jobPostingData.fullText;
      jobPostingSource = 'structured';
      jobPostingMetadata = {
        jobTitle: jobPostingData.jobTitle,
        companyName: jobPostingData.companyName,
        requirements: jobPostingData.requirements,
        skills: jobPostingData.skills,
      };
    } else if (jobPostingUrl) {
      const scrapingResult = await jobScrapingService.scrapeAndValidateJobPosting(jobPostingUrl);

      if (!scrapingResult.success || !scrapingResult.jobPosting) {
        return new Response(
          JSON.stringify({ error: scrapingResult.error || 'Failed to scrape job posting' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      finalJobPosting = scrapingResult.jobPosting.fullText;
      jobPostingSource = 'scraped';
      jobPostingMetadata = {
        jobTitle: scrapingResult.jobPosting.jobTitle,
        companyName: scrapingResult.jobPosting.companyName,
        requirements: scrapingResult.jobPosting.requirements,
        skills: scrapingResult.jobPosting.skills,
      };
    } else if (jobPosting) {
      // Use provided job posting text
      finalJobPosting = jobPosting;
    } else {
      return new Response(
        JSON.stringify({ error: 'Either jobPosting, jobPostingUrl, or jobPostingData must be provided' }),
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
    const systemPrompt = `You are an expert resume writer and career advisor. Your task is to create a customized resume based on the user's portfolio data and a specific job posting.

Guidelines:
1. Analyze the job posting to identify key requirements, skills, and qualifications
2. Match the user's experience and skills to the job requirements
3. Prioritize and highlight the most relevant experiences
4. Use action verbs and quantifiable achievements when possible
5. Tailor the language and keywords to match the job posting
6. Maintain professional formatting and structure
7. Focus on achievements and impact, not just responsibilities

Resume Format: ${resumeFormat}
Target Length: ${targetLength}
${focusAreas.length > 0 ? `Focus Areas: ${focusAreas.join(', ')}` : ''}

Return a complete, professional resume in markdown format that is specifically tailored to this job opportunity.`;

    const userPrompt = `JOB POSTING:
${finalJobPosting}

USER PORTFOLIO DATA:
${portfolioContext}

Please create a customized resume that highlights the most relevant experience and skills for this specific job opportunity.`;

    // Generate customized resume using AI
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 4000,
      temperature: 0.3, // Lower temperature for more consistent, professional output
    });

    // Extract key insights from the job posting for additional context
    const analysisResult = await generateObject({
      model,
      schema: jobAnalysisSchema,
      system:
        'You are an expert job posting analyzer. Analyze the job posting to extract key information that will help optimize a resume for this position.',
      prompt: `Analyze this job posting and extract the most important information:

${finalJobPosting}`,
      temperature: 0.1,
    });

    const { success: analysisSuccess, data: jobAnalysis } = jobAnalysisSchema.safeParse(
      analysisResult.object,
    );

    if (!analysisSuccess) {
      console.warn('Failed to parse job analysis with schema');
    }

    const responseData = {
      customizedResume: result.text,
      jobAnalysis: analysisSuccess ? jobAnalysis : null,
      metadata: {
        format: resumeFormat,
        targetLength,
        focusAreas,
        generatedAt: new Date().toISOString(),
        portfolioId: portfolio.id,
        jobPostingSource,
        jobPostingUrl: jobPostingUrl || null,
        jobPostingWordCount: finalJobPosting.split(/\s+/).length,
        jobPostingMetadata,
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Resume customization error:', error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

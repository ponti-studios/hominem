import { z } from 'zod';

import { serverEnv } from '~/lib/env';
import type { JobPosting } from '~/types/applications';

interface JobScrapingResult {
  success: boolean;
  job_posting?: JobPosting;
  error?: string;
}

const extractedJobSchema = z.object({
  job_title: z.string().optional(),
  companyName: z.string().optional(),
  companyDescription: z.string().optional(),
  jobDescription: z.string().optional(),
  location: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  fullText: z.string().optional(),
});

const JOB_EXTRACTION_PROMPT =
  'Extract the job posting into structured JSON with the following fields: job_title, companyName, companyDescription, jobDescription, location, requirements, skills, and fullText. Return only the job posting content and exclude navigation, ads, footers, cookie banners, and unrelated page chrome.';

const JOB_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    job_title: { type: 'string' },
    companyName: { type: 'string' },
    companyDescription: { type: 'string' },
    jobDescription: { type: 'string' },
    location: { type: 'string' },
    requirements: {
      type: 'array',
      items: { type: 'string' },
    },
    skills: {
      type: 'array',
      items: { type: 'string' },
    },
    fullText: { type: 'string' },
  },
  required: ['fullText', 'job_title'],
};

export class JobScrapingService {
  private readonly cloudflareAccountId: string;
  private readonly cloudflareApiToken: string;

  constructor() {
    try {
      const env = serverEnv();
      this.cloudflareAccountId = env.CLOUDFLARE_ACCOUNT_ID || '';
      this.cloudflareApiToken = env.CLOUDFLARE_API_TOKEN || '';
    } catch {
      this.cloudflareAccountId = '';
      this.cloudflareApiToken = '';
    }

    if (!this.cloudflareAccountId || !this.cloudflareApiToken) {
      console.warn('Cloudflare credentials not configured. Job scraping will not work.');
    }
  }

  async scrapeJobPosting(jobUrl: string): Promise<JobScrapingResult> {
    try {
      if (!this.cloudflareAccountId || !this.cloudflareApiToken) {
        throw new Error('Cloudflare credentials not configured');
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/browser-rendering/json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cloudflareApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: jobUrl,
            prompt: JOB_EXTRACTION_PROMPT,
            gotoOptions: {
              waitUntil: 'networkidle2',
            },
            response_format: {
              type: 'json_schema',
              schema: JOB_EXTRACTION_SCHEMA,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudflare API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const payload = (await response.json()) as {
        success?: boolean;
        result?: unknown;
        errors?: Array<{ message?: string }>;
      };

      if (!payload.success) {
        throw new Error(
          `Cloudflare API returned error: ${payload.errors?.[0]?.message || 'Unknown error'}`,
        );
      }

      const extractedData = extractedJobSchema.parse(payload.result ?? {});
      const fullText = extractedData.fullText ?? '';
      const normalizedFullText = fullText.trim();

      return {
        success: true,
        job_posting: {
          job_title: extractedData.job_title || 'Unknown Position',
          companyName: extractedData.companyName || 'Unknown Company',
          companyDescription: extractedData.companyDescription || '',
          jobDescription: extractedData.jobDescription || normalizedFullText,
          location: extractedData.location || '',
          requirements: extractedData.requirements || [],
          skills: extractedData.skills || [],
          fullText: normalizedFullText,
          url: jobUrl,
          scrapedAt: new Date().toISOString(),
          wordCount: normalizedFullText
            ? normalizedFullText.split(/\s+/).filter(Boolean).length
            : 0,
        },
      };
    } catch (error) {
      console.error('Job posting scraping failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async checkHealth(): Promise<{ status: string; runtime?: string; timestamp?: string }> {
    const isConfigured = Boolean(this.cloudflareAccountId && this.cloudflareApiToken);

    return {
      status: isConfigured ? 'healthy' : 'unhealthy',
      runtime: 'direct-api',
      timestamp: new Date().toISOString(),
    };
  }
}

export const jobScrapingService = new JobScrapingService();

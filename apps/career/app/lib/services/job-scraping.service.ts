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

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const EXTRACTION_MODEL = 'deepseek/deepseek-v4-flash';

export async function scrapeJobPosting(jobUrl: string): Promise<JobScrapingResult> {
  try {
    const apiKey = serverEnv().OPENROUTER_API_KEY;

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              'Extract the job posting at this URL into structured JSON.',
              '',
              `URL: ${jobUrl}`,
              '',
              'First use the web_fetch tool to get the page content, then extract the job details.',
              '',
              'Return a JSON object with these fields:',
              '- job_title: the title of the position',
              '- companyName: the name of the company',
              '- companyDescription: description of the company (optional)',
              '- jobDescription: full description of the job',
              '- location: job location (optional)',
              '- requirements: array of requirement strings (optional)',
              '- skills: array of skill strings (optional)',
              '- fullText: the complete text content of the entire page',
            ].join('\n'),
          },
        ],
        tools: [{ type: 'openrouter:web_fetch' }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    type OpenRouterChoice = {
      message?: {
        content?: string | null;
      };
      finish_reason?: string;
    };

    const payload = (await response.json()) as {
      choices?: OpenRouterChoice[];
      error?: { message?: string };
    };

    if (payload.error) {
      throw new Error(`OpenRouter API error: ${payload.error.message}`);
    }

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenRouter');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error('Failed to parse model response as JSON');
    }

    const extractedData = extractedJobSchema.parse(parsed);
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
        wordCount: normalizedFullText ? normalizedFullText.split(/\s+/).filter(Boolean).length : 0,
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

export async function checkHealth(): Promise<{
  status: string;
  runtime?: string;
  timestamp?: string;
}> {
  try {
    const apiKey = serverEnv().OPENROUTER_API_KEY;

    if (!apiKey) {
      return {
        status: 'unhealthy',
        runtime: 'openrouter',
        timestamp: new Date().toISOString(),
      };
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      runtime: 'openrouter',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'unhealthy',
      runtime: 'openrouter',
      timestamp: new Date().toISOString(),
    };
  }
}

import { z } from 'zod';

import { serverEnv } from '~/lib/env';
import type { JobPosting } from '~/types/applications';

import extractionPrompt from './prompts/job-extraction.prompt.md?raw';

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
  salaryRange: z.string().optional(),
  salaryDetails: z.string().optional(),
  employmentType: z.string().optional(),
  experienceLevel: z.string().optional(),
  education: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  industry: z.string().optional(),
  postedDate: z.string().optional(),
  applicationDeadline: z.string().optional(),
  department: z.string().optional(),
  hiringManager: z.string().optional(),
  companySize: z.string().optional(),
  fundingStage: z.string().optional(),
  technologyStack: z.array(z.string()).optional(),
  cultureAspects: z.array(z.string()).optional(),
  fullText: z.string().optional(),
});

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const EXTRACTION_MODEL = 'qwen/qwen3.5-flash-02-23';

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
            role: 'system',
            content: extractionPrompt,
          },
          {
            role: 'user',
            content: `URL: ${jobUrl}`,
          },
        ],
        tools: [{ type: 'openrouter:web_fetch' }],
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

    // The model may wrap JSON in markdown code blocks — strip them
    const trimmed = content.trim();
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : trimmed;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
      console.error('Failed to parse model response as JSON. Raw response:', content);
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
        salaryRange: extractedData.salaryRange || '',
        salaryDetails: extractedData.salaryDetails || '',
        employmentType: extractedData.employmentType || '',
        experienceLevel: extractedData.experienceLevel || '',
        education: extractedData.education || '',
        requirements: extractedData.requirements || [],
        skills: extractedData.skills || [],
        benefits: extractedData.benefits || [],
        responsibilities: extractedData.responsibilities || [],
        industry: extractedData.industry || '',
        postedDate: extractedData.postedDate || '',
        applicationDeadline: extractedData.applicationDeadline || '',
        department: extractedData.department || '',
        hiringManager: extractedData.hiringManager || '',
        companySize: extractedData.companySize || '',
        fundingStage: extractedData.fundingStage || '',
        technologyStack: extractedData.technologyStack || [],
        cultureAspects: extractedData.cultureAspects || [],
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

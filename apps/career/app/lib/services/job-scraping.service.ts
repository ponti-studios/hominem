import {
  createChatCompletion,
  getChatCompletionText,
  getChatCompletionUsage,
  type AIUsageMetrics,
} from '@hominem/ai';
import { z } from 'zod';

import type { JobPosting } from '~/types/applications';

import extractionPrompt from './prompts/job-extraction.prompt.md?raw';

interface JobScrapingProviderResult {
  success: boolean;
  content?: string;
  usage: AIUsageMetrics | null;
  model?: string;
  durationMs: number;
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

export async function scrapeJobPosting(
  _userId: string,
  jobUrl: string,
): Promise<JobScrapingProviderResult> {
  const startedAt = performance.now();

  try {
    const response = await createChatCompletion({
      model: 'qwen/qwen3.5-flash-02-23',
      responseFormat: { type: 'json_object' },
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
    });

    return {
      success: true,
      content: getChatCompletionText(response),
      usage: getChatCompletionUsage(response),
      model: response.model,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      success: false,
      usage: null,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export function parseScrapedJobPostingContent(content: string, jobUrl: string): JobPosting {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonString = jsonMatch ? jsonMatch[1].trim() : trimmed;
  const parsed = JSON.parse(jsonString) as Record<string, unknown>;
  const extractedData = extractedJobSchema.parse(parsed);
  const fullText = extractedData.fullText ?? '';
  const normalizedFullText = fullText.trim();

  return {
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
  };
}

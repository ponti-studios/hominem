import { Buffer } from 'node:buffer';

import { getSharedAiModelConfig, getSharedOpenAIClient } from '@hominem/services/ai-model';
import PDFParser from 'pdf2json';
import type { ActionFunction } from 'react-router';

import { getAuthenticatedUser, requireAuth } from '../lib/auth.server';
import { saveResumeToDatabase } from '../lib/services/resume-conversion.service';
import { FILE_VALIDATION_PRESETS, uploadFile, validateFile } from '../lib/services/storage.service';
import type { ConvertedResumeData } from '../types/resume';
import { resumeSchema } from '../types/resume';

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(jsonMatch?.[1] ?? trimmed);
}

const resumeJsonShape = {
  portfolio: {
    slug: 'string',
    title: 'string',
    name: 'string',
    initials: 'string | null',
    jobTitle: 'string',
    bio: 'string',
    tagline: 'string',
    currentLocation: 'string',
    locationTagline: 'string | null',
    email: 'email string',
    phone: 'string | null',
    availabilityStatus: 'boolean',
    availabilityMessage: 'string | null',
    isPublic: 'boolean',
    isActive: 'boolean',
  },
  socialLinks: {
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
      startDate: 'string | null',
      endDate: 'string | null',
    },
  ],
  skills: [
    {
      name: 'string',
      level: 'number from 1 to 100',
      category: 'string | null',
      description: 'string | null',
      yearsOfExperience: 'number | null',
      certifications: ['string'],
    },
  ],
  projects: [
    {
      title: 'string',
      description: 'string',
      shortDescription: 'string | null',
      technologies: ['string'],
      liveUrl: 'string | null',
      githubUrl: 'string | null',
      status: 'in-progress | completed | archived',
    },
  ],
  stats: [{ label: 'string', value: 'string' }],
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const sessionUser = await getAuthenticatedUser(request);
    const user = requireAuth(sessionUser);

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Please upload a PDF file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No PDF file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use centralized file validation
    const validation = validateFile(file, FILE_VALIDATION_PRESETS.PDF_RESUME);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // First, extract text from PDF (before uploading to storage)
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfText = await new Promise<string>((resolve, reject) => {
        const parser = new PDFParser(undefined, true);
        parser.on('pdfParser_dataError', (data) => {
          const error = data instanceof Error ? data : data.parserError;
          reject(error);
        });
        parser.on('pdfParser_dataReady', () => {
          try {
            resolve(parser.getRawTextContent());
          } catch (e) {
            reject(e);
          }
        });
        parser.parseBuffer(buffer);
      });

      if (!pdfText.trim()) {
        return new Response(JSON.stringify({ error: 'Could not extract text from PDF.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Generate structured data using the shared monorepo AI client
      const result = await getSharedOpenAIClient().chat.completions.create({
        model: getSharedAiModelConfig().modelId,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are an expert resume parser. Return only valid JSON matching the requested resume schema.',
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

      const parsedResume = parseJsonObject(result.choices[0]?.message.content ?? '');
      const { success, data } = resumeSchema.safeParse(parsedResume as ConvertedResumeData);
      if (!success) {
        return new Response(JSON.stringify({ error: 'Invalid data' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const uploadResult = await uploadFile(file, user.id, 'resumes');

      if (!uploadResult.success) {
        console.error(uploadResult.error);
        return new Response(JSON.stringify({ error: uploadResult.error }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Save to database (this will handle overwriting existing portfolio safely)
      const saveResult = await saveResumeToDatabase(user.id, data);
      const portfolioId = saveResult.portfolioId;

      const responseData = {
        message: 'Resume uploaded and processed successfully',
        data,
        saved: true,
        portfolioId,
        fileUrl: uploadResult.publicUrl,
      };

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (processingError) {
      const msg = processingError instanceof Error ? processingError.message : 'Processing failed';
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('Resume conversion error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

import { Buffer } from 'node:buffer';

import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import PDFParser from 'pdf2json';
import type { ActionFunction } from 'react-router';

import { getAuthenticatedUser, requireAuth } from '../lib/auth.server';
import { saveResumeToDatabase } from '../lib/services/resume-conversion.service';
import { FILE_VALIDATION_PRESETS, uploadFile, validateFile } from '../lib/services/storage.service';
import type { ConvertedResumeData } from '../types/resume';
import { resumeSchema } from '../types/resume';

const model = openai('gpt-4.1');

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

      // Generate structured data using OpenAI
      const result = await generateObject<ConvertedResumeData>({
        model,
        schema: resumeSchema,
        messages: [
          { role: 'system', content: 'You are an expert resume parser.' },
          { role: 'user', content: pdfText },
        ],
      });

      const { success, data } = resumeSchema.safeParse(result.object);
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

      // Return success response
      const responseData = {
        success: true,
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

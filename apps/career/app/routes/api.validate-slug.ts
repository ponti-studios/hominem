import { CareerRepository, db } from '@hominem/db';
import { data, type LoaderFunctionArgs } from 'react-router';

import { createErrorResponse, createSuccessResponse, withAuthLoader } from '../lib/route-utils';

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const currentPortfolioId = url.searchParams.get('currentId');

    if (!slug) {
      return data(createErrorResponse('Slug parameter is required'), { status: 400 });
    }

    // Basic slug validation
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return data(
        createErrorResponse('Slug can only contain lowercase letters, numbers, and hyphens'),
        { status: 400 },
      );
    }

    if (slug.length < 3) {
      return data(createErrorResponse('Slug must be at least 3 characters long'), {
        status: 400,
      });
    }

    if (slug.length > 50) {
      return data(createErrorResponse('Slug must be less than 50 characters long'), {
        status: 400,
      });
    }

    // Check if slug already exists (excluding current portfolio if editing)
    try {
      const isAvailable = await CareerRepository.isSlugAvailable(
        db,
        slug,
        currentPortfolioId || undefined,
      );

      return createSuccessResponse({
        slug,
        isAvailable,
        message: isAvailable ? 'Slug is available' : 'Slug is already taken',
      });
    } catch (error) {
      console.error('Error checking slug availability:', error);
      return data(createErrorResponse('Failed to check slug availability'), { status: 500 });
    }
  });
}

import { db, TestimonialRepository } from '@hominem/db';

import { logger } from '../logger';
import { parseFormData } from '../route-utils';
import {
  normalizeTestimonialMutationValues,
  type TestimonialMutationValues,
} from './testimonial-form';

export async function handleTestimonialMutationAction(request: Request, ownerUserId: string) {
  const formData = await request.formData();
  const operation = formData.get('operation') as string;

  switch (operation) {
    case 'create':
    case 'update': {
      const testimonialDataResult = parseFormData<TestimonialMutationValues>(
        formData,
        'testimonialData',
      );

      if ('success' in testimonialDataResult && !testimonialDataResult.success) {
        return { success: false, operation, error: 'Your testimonial changes couldn’t be read.' };
      }

      const testimonialData = normalizeTestimonialMutationValues(
        testimonialDataResult as TestimonialMutationValues,
      );

      if (!testimonialData.portfolioId) {
        return {
          success: false,
          operation,
          error: 'Choose a portfolio before saving this testimonial.',
        };
      }

      try {
        if (operation === 'create') {
          const { id: _id, ...insertData } = testimonialData;
          const newTestimonial = await TestimonialRepository.createTestimonial(db, {
            ownerUserid: ownerUserId,
            ...insertData,
          });

          return {
            success: true,
            operation,
            message: 'Testimonial created successfully',
            data: newTestimonial,
          };
        }

        const { id, ...updateData } = testimonialData;
        if (!id) {
          return {
            success: false,
            operation,
            error: 'Choose a testimonial before saving your changes.',
          };
        }

        await TestimonialRepository.updateTestimonial(db, {
          ownerUserid: ownerUserId,
          testimonialId: id,
          portfolioId: testimonialData.portfolioId,
          input: updateData,
        });

        return { success: true, operation, message: 'Testimonial updated successfully' };
      } catch (error) {
        logger.error(`Failed to ${operation} testimonial`, error, { owner_userid: ownerUserId });
        return {
          success: false,
          operation,
          error:
            operation === 'create'
              ? 'We couldn’t create this testimonial. Try again.'
              : 'We couldn’t save this testimonial. Try again.',
        };
      }
    }

    case 'delete': {
      const id = formData.get('id') as string;
      const portfolioId = formData.get('portfolioId') as string;

      if (!id || !portfolioId) {
        return { success: false, operation, error: 'Choose a testimonial before deleting it.' };
      }

      try {
        await TestimonialRepository.deleteTestimonial(db, {
          ownerUserid: ownerUserId,
          testimonialId: id,
          portfolioId,
        });
        return { success: true, operation, message: 'Testimonial deleted successfully' };
      } catch (error) {
        logger.error('Failed to delete testimonial', error, {
          testimonialId: id,
          portfolioId,
          owner_userid: ownerUserId,
        });
        return {
          success: false,
          operation,
          error: 'We couldn’t delete this testimonial. Try again.',
        };
      }
    }

    default:
      throw new Response('Invalid operation', { status: 400 });
  }
}

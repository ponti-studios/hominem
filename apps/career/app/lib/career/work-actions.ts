import { db, WorkExperienceRepository } from '@hominem/db';
import { stringToDate } from '@hominem/utils/dates';

import { logger } from '../logger';
import { parseFormData } from '../route-utils';
import type { WorkExperienceMetadata } from './queries/career-progression';

export interface WorkExperienceCreateValues {
  role: string;
  company: string;
  startDate?: string;
  endDate?: string;
  description: string;
  achievements?: { value: string }[];
  action?: string;
  tags?: string[];
  metadata?: WorkExperienceMetadata;
  sortOrder?: number;
  isVisible?: boolean;
  portfolioId: string;
}

export async function handleWorkExperienceCreateAction(request: Request, ownerUserId: string) {
  const formData = await request.formData();
  const workExperienceDataResult = parseFormData<WorkExperienceCreateValues>(
    formData,
    'workExperienceData',
  );

  if ('success' in workExperienceDataResult && !workExperienceDataResult.success) {
    return {
      success: false,
      operation: 'create',
      error: 'Your work experience changes couldn’t be read.',
    };
  }

  const workExperienceData = workExperienceDataResult as WorkExperienceCreateValues;

  if (!workExperienceData.portfolioId) {
    return {
      success: false,
      operation: 'create',
      error: 'Choose a portfolio before saving this work experience.',
    };
  }

  try {
    const newExperience = await WorkExperienceRepository.createWorkExperience(db, {
      ownerUserid: ownerUserId,
      portfolioId: workExperienceData.portfolioId,
      role: workExperienceData.role,
      company: workExperienceData.company,
      description: workExperienceData.description,
      startDate: stringToDate(workExperienceData.startDate),
      endDate: stringToDate(workExperienceData.endDate),
      action: workExperienceData.action,
      tags: workExperienceData.tags,
      metadata: workExperienceData.metadata as Record<string, unknown> | undefined,
      sortOrder: workExperienceData.sortOrder,
      isVisible: workExperienceData.isVisible,
    });

    return {
      success: true,
      operation: 'create',
      message: 'Work experience created successfully',
      data: newExperience,
    };
  } catch (error) {
    logger.error('Failed to create work experience', error, { owner_userid: ownerUserId });
    return {
      success: false,
      operation: 'create',
      error: 'We couldn’t create this work experience. Try again.',
    };
  }
}

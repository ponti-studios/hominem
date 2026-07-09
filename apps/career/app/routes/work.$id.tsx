import type { UpdateWorkExperienceInput } from '@hominem/db';
import { db, WorkExperienceRepository } from '@hominem/db';

import { WorkExperienceDetail } from '~/components/career/work';
import { getWorkExperienceById, updateWorkExperience } from '~/lib/career/queries/base';
import { getProjectsByWorkExperience } from '~/lib/career/queries/projects';
import {
  hasDefinedUpdates,
  normalizeMetadata,
  normalizeWorkExperienceUpdates,
} from '~/lib/career/work-experience-form';
import { jsonObject } from '~/lib/db-json';
import { userContext } from '~/lib/middleware';
import { parseFormData } from '~/lib/route-utils';

import { Route } from './+types/work.$id';

export async function loader({ context, params }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  if (!id) {
    throw new Response('Work experience ID is required', { status: 400 });
  }

  try {
    const workExperience = await getWorkExperienceById(user.id, id);
    if (!workExperience) {
      throw new Response('Work experience not found', { status: 404 });
    }

    const projects = await getProjectsByWorkExperience(workExperience.portfolioId, id);

    return {
      workExperience,
      linkedProjectCount: projects.length,
    };
  } catch (error) {
    console.error('Error loading work experience:', error);
    throw new Response('Failed to load work experience', { status: 500 });
  }
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  if (!id) {
    throw new Response('Work experience ID is required', { status: 400 });
  }

  const formData = await request.formData();
  const operation = formData.get('operation');

  if (operation === 'delete') {
    const portfolioId = formData.get('portfolioId');

    if (typeof portfolioId !== 'string' || !portfolioId) {
      return { success: false, operation, error: 'Choose a work experience before deleting it.' };
    }

    try {
      await WorkExperienceRepository.deleteWorkExperience(db, user.id, id, portfolioId);

      return { success: true, operation };
    } catch (error) {
      console.error('Error deleting work experience:', error);
      return {
        success: false,
        operation,
        error: 'We couldn’t delete this work experience. Try again.',
      };
    }
  }

  if (operation !== 'update') {
    return { success: false, operation, error: 'We couldn’t understand that request.' };
  }

  const updatesResult = parseFormData<UpdateWorkExperienceInput>(formData, 'updates');
  if ('success' in updatesResult && !updatesResult.success) {
    return {
      success: false,
      operation,
      error: 'Your changes couldn’t be read. Refresh and try again.',
    };
  }

  const updates = normalizeWorkExperienceUpdates(updatesResult as UpdateWorkExperienceInput);

  if (!hasDefinedUpdates(updates)) {
    return { success: true, operation };
  }

  try {
    let mergedUpdates = updates;

    if (updates.metadata !== undefined) {
      const current = await getWorkExperienceById(user.id, id);

      if (!current) {
        return {
          success: false,
          operation,
          error: 'We couldn’t find this work experience anymore.',
        };
      }

      const currentMetadata = jsonObject<Record<string, unknown>>(current.metadata) ?? {};
      mergedUpdates = {
        ...updates,
        metadata:
          updates.metadata === null
            ? null
            : { ...currentMetadata, ...normalizeMetadata(updates.metadata) },
      };
    }

    await updateWorkExperience(user.id, id, mergedUpdates);

    return { success: true, operation };
  } catch (error) {
    console.error('Error updating work experience:', error);
    return {
      success: false,
      operation,
      error: 'We couldn’t save your changes. Try again.',
    };
  }
}

export default function WorkExperienceDetailRoute({ loaderData }: Route.ComponentProps) {
  return (
    <WorkExperienceDetail
      workExperience={loaderData.workExperience}
      linkedProjectCount={loaderData.linkedProjectCount}
    />
  );
}

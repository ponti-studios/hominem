import { db, ProjectRepository } from '@hominem/db';
import { stringToDate } from '@hominem/utils/dates';

import { logger } from '../logger';
import { parseFormData } from '../route-utils';
import { type ProjectMutationValues, normalizeProjectMutationValues } from './project-form';

export async function handleProjectMutationAction(request: Request, ownerUserId: string) {
  const formData = await request.formData();
  const operation = formData.get('operation') as string;

  switch (operation) {
    case 'create':
    case 'update': {
      const projectDataResult = parseFormData<ProjectMutationValues>(formData, 'projectData');

      if ('success' in projectDataResult && !projectDataResult.success) {
        return { success: false, operation, error: 'Your project changes couldn’t be read.' };
      }

      const projectData = normalizeProjectMutationValues(
        projectDataResult as ProjectMutationValues,
      );

      if (!projectData.portfolioId) {
        return {
          success: false,
          operation,
          error: 'Choose a portfolio before saving this project.',
        };
      }

      try {
        if (operation === 'create') {
          const { id: _id, ...insertData } = projectData;
          const newProject = await ProjectRepository.createProject(db, ownerUserId, {
            ...insertData,
            startDate: stringToDate(insertData.startDate),
            endDate: stringToDate(insertData.endDate),
          });

          return {
            success: true,
            operation,
            message: 'Project created successfully',
            data: newProject,
          };
        }

        const { id, ...updateData } = projectData;
        if (!id) {
          return {
            success: false,
            operation,
            error: 'Choose a project before saving your changes.',
          };
        }

        await ProjectRepository.updateProject(db, ownerUserId, id, projectData.portfolioId, {
          ...updateData,
          startDate: stringToDate(updateData.startDate),
          endDate: stringToDate(updateData.endDate),
        });

        return { success: true, operation, message: 'Project updated successfully' };
      } catch (error) {
        logger.error(`Failed to ${operation} project`, error, { owner_userid: ownerUserId });
        return {
          success: false,
          operation,
          error:
            operation === 'create'
              ? 'We couldn’t create this project. Try again.'
              : 'We couldn’t save this project. Try again.',
        };
      }
    }

    case 'delete': {
      const id = formData.get('id') as string;
      const portfolioId = formData.get('portfolioId') as string;

      if (!id || !portfolioId) {
        return { success: false, operation, error: 'Choose a project before deleting it.' };
      }

      try {
        await ProjectRepository.deleteProject(db, ownerUserId, id, portfolioId);
        return { success: true, operation, message: 'Project deleted successfully' };
      } catch (error) {
        logger.error('Failed to delete project', error, {
          projectId: id,
          portfolioId,
          owner_userid: ownerUserId,
        });
        return { success: false, operation, error: 'We couldn’t delete this project. Try again.' };
      }
    }

    default:
      throw new Response('Invalid operation', { status: 400 });
  }
}

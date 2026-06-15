import { CareerRepository, db } from '@hominem/db';

import { parseFormData } from '../route-utils';
import { stringToDate } from '@hominem/utils/dates';
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

      if (!projectData.portfolio_id) {
        return {
          success: false,
          operation,
          error: 'Choose a portfolio before saving this project.',
        };
      }

      try {
        if (operation === 'create') {
          const { id: _id, ...insertData } = projectData;
          const newProject = await CareerRepository.createProject(db, ownerUserId, {
            ...insertData,
            start_date: stringToDate(insertData.start_date),
            end_date: stringToDate(insertData.end_date),
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

        await CareerRepository.updateProject(db, ownerUserId, id, projectData.portfolio_id, {
          ...updateData,
          start_date: stringToDate(updateData.start_date),
          end_date: stringToDate(updateData.end_date),
        });

        return { success: true, operation, message: 'Project updated successfully' };
      } catch (error) {
        console.error(`Failed to ${operation} project:`, error);
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
      const portfolio_id = formData.get('portfolio_id') as string;

      if (!id || !portfolio_id) {
        return { success: false, operation, error: 'Choose a project before deleting it.' };
      }

      try {
        await CareerRepository.deleteProject(db, ownerUserId, id, portfolio_id);
        return { success: true, operation, message: 'Project deleted successfully' };
      } catch (error) {
        console.error('Failed to delete project:', error);
        return { success: false, operation, error: 'We couldn’t delete this project. Try again.' };
      }
    }

    default:
      throw new Response('Invalid operation', { status: 400 });
  }
}

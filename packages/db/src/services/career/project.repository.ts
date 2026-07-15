import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppProjects, JsonValue } from '../../types/database';
import { verifyPortfolioOwnership } from './ownership';

type ProjectRow = Selectable<AppProjects>;

function serializeJsonColumn(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}

export interface ProjectRecord {
  id: string;
  portfolioId: string;
  workExperienceId: string | null;
  title: string;
  description: string;
  shortDescription: string | null;
  liveUrl: string | null;
  githubUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  technologies: JsonValue;
  status: string;
  startDate: string | null;
  endDate: string | null;
  isFeatured: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdat: string;
  updatedat: string;
}

export interface CreateProjectInput {
  portfolioId: string;
  workExperienceId?: string | null;
  title: string;
  description: string;
  shortDescription?: string | null;
  liveUrl?: string | null;
  githubUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  technologies?: string[];
  status?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  isFeatured?: boolean;
  isVisible?: boolean;
  sortOrder?: number;
}

export interface UpdateProjectInput {
  workExperienceId?: string | null;
  title: string;
  description: string;
  shortDescription?: string | null;
  liveUrl?: string | null;
  githubUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  technologies?: string[];
  status?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  isFeatured?: boolean;
  isVisible?: boolean;
  sortOrder?: number;
}

export interface CreateProjectCommand extends CreateProjectInput {
  ownerUserid: string;
}

export interface UpdateProjectCommand {
  ownerUserid: string;
  projectId: string;
  portfolioId: string;
  input: UpdateProjectInput;
}

export interface DeleteProjectCommand {
  ownerUserid: string;
  projectId: string;
  portfolioId: string;
}

function toProjectRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    workExperienceId: row.workExperienceId,
    title: row.title,
    description: row.description,
    shortDescription: row.shortDescription,
    liveUrl: row.liveUrl,
    githubUrl: row.githubUrl,
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    technologies: row.technologies,
    status: row.status,
    startDate: row.startDate ? String(row.startDate) : null,
    endDate: row.endDate ? String(row.endDate) : null,
    isFeatured: row.isFeatured,
    isVisible: row.isVisible,
    sortOrder: row.sortOrder,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
  };
}

export const ProjectRepository = {
  async listProjectsByPortfolio(handle: DbHandle, portfolioId: string): Promise<ProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .orderBy('createdat', 'desc')
      .execute();

    return (rows as ProjectRow[]).map(toProjectRecord);
  },

  /** Ordered for full-portfolio composition — see PortfolioRepository.loadFullPortfolio. */
  async listByPortfolioId(handle: DbHandle, portfolioId: string): Promise<ProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .orderBy('sortOrder', 'asc')
      .execute();

    return (rows as ProjectRow[]).map(toProjectRecord);
  },

  async listVisibleByPortfolioId(handle: DbHandle, portfolioId: string): Promise<ProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .where('isVisible', '=', true)
      .orderBy('sortOrder', 'asc')
      .execute();

    return (rows as ProjectRow[]).map(toProjectRecord);
  },

  async listProjectsByWorkExperience(
    handle: DbHandle,
    portfolioId: string,
    workExperienceId: string,
  ): Promise<ProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .where('workExperienceId', '=', workExperienceId)
      .orderBy('createdat', 'desc')
      .execute();

    return (rows as ProjectRow[]).map(toProjectRecord);
  },

  async getProjectById(
    handle: DbHandle,
    ownerUserid: string,
    projectId: string,
  ): Promise<ProjectRecord | null> {
    const row = await handle
      .selectFrom('app.projects as project')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'project.portfolioId')
      .selectAll('project')
      .where('portfolio.ownerUserid', '=', ownerUserid)
      .where('project.id', '=', projectId)
      .executeTakeFirst();

    return row ? toProjectRecord(row as ProjectRow) : null;
  },

  async createProject(handle: DbHandle, command: CreateProjectCommand): Promise<ProjectRecord> {
    await verifyPortfolioOwnership(handle, command.ownerUserid, command.portfolioId);

    const created = await handle
      .insertInto('app.projects')
      .values({
        portfolioId: command.portfolioId,
        workExperienceId: command.workExperienceId ?? null,
        title: command.title,
        description: command.description,
        shortDescription: command.shortDescription ?? null,
        liveUrl: command.liveUrl ?? null,
        githubUrl: command.githubUrl ?? null,
        imageUrl: command.imageUrl ?? null,
        videoUrl: command.videoUrl ?? null,
        technologies: serializeJsonColumn(command.technologies ?? []),
        status: command.status ?? 'completed',
        startDate: command.startDate ? new Date(command.startDate) : null,
        endDate: command.endDate ? new Date(command.endDate) : null,
        isFeatured: command.isFeatured ?? false,
        isVisible: command.isVisible ?? true,
        sortOrder: command.sortOrder ?? 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toProjectRecord(created as ProjectRow);
  },

  async updateProject(handle: DbHandle, command: UpdateProjectCommand): Promise<void> {
    await verifyPortfolioOwnership(handle, command.ownerUserid, command.portfolioId);
    const input = command.input;

    const updated = await handle
      .updateTable('app.projects')
      .set({
        title: input.title,
        description: input.description,
        shortDescription: input.shortDescription ?? null,
        liveUrl: input.liveUrl ?? null,
        githubUrl: input.githubUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        technologies: serializeJsonColumn(input.technologies ?? []),
        status: input.status ?? 'completed',
        workExperienceId: input.workExperienceId ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        isFeatured: input.isFeatured ?? false,
        isVisible: input.isVisible ?? true,
        sortOrder: input.sortOrder ?? 0,
      })
      .where('id', '=', command.projectId)
      .where('portfolioId', '=', command.portfolioId)
      .returning('id')
      .executeTakeFirst();

    if (!updated) throw new NotFoundError('Project', { projectId: command.projectId });
  },

  async deleteProject(handle: DbHandle, command: DeleteProjectCommand): Promise<void> {
    await verifyPortfolioOwnership(handle, command.ownerUserid, command.portfolioId);

    const deleted = await handle
      .deleteFrom('app.projects')
      .where('id', '=', command.projectId)
      .where('portfolioId', '=', command.portfolioId)
      .returning('id')
      .executeTakeFirst();

    if (!deleted) throw new NotFoundError('Project', { projectId: command.projectId });
  },
};

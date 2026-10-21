import { sql, type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type {
  AppCareerEngagements,
  AppCareerProjects,
  AppCareerProjectStatus,
  JsonArray,
} from '../../types/database';
import {
  CAREER_PAGE_DEFAULT_LIMIT,
  decodeCareerCursor,
  encodeCareerCursor,
  toCareerPage,
  type CareerPage,
} from './pagination';

export type CareerEngagementSummary = Pick<
  Selectable<AppCareerEngagements>,
  'id' | 'company' | 'title' | 'kind'
>;

export type CareerProjectRecord = Selectable<AppCareerProjects> & {
  engagements: CareerEngagementSummary[];
};

export type CareerProjectInput = {
  organization?: string | null;
  title: string;
  description?: string | null;
  shortDescription?: string | null;
  liveUrl?: string | null;
  githubUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  technologies?: JsonArray;
  status?: AppCareerProjectStatus | null;
  startDate?: string | null;
  endDate?: string | null;
  isFeatured?: boolean;
  isVisible?: boolean;
  sortOrder?: number;
  engagementIds?: string[];
};

type ProjectRow = Selectable<AppCareerProjects>;

async function withEngagements(
  handle: DbHandle,
  ownerUserId: string,
  projects: ProjectRow[],
): Promise<CareerProjectRecord[]> {
  if (projects.length === 0) return [];

  const links = await handle
    .selectFrom('app.careerProjectEngagements as link')
    .innerJoin('app.careerEngagements as engagement', 'engagement.id', 'link.engagementId')
    .select([
      'link.projectId',
      'engagement.id',
      'engagement.company',
      'engagement.title',
      'engagement.kind',
    ])
    .where('link.ownerUserid', '=', ownerUserId)
    .where(
      'link.projectId',
      'in',
      projects.map((project) => project.id),
    )
    .orderBy('engagement.startDate', 'desc')
    .execute();

  const byProject = new Map<string, CareerEngagementSummary[]>();
  for (const link of links) {
    const entries = byProject.get(link.projectId) ?? [];
    entries.push({
      id: link.id,
      company: link.company,
      title: link.title,
      kind: link.kind,
    });
    byProject.set(link.projectId, entries);
  }

  return projects.map((project) => ({
    ...project,
    engagements: byProject.get(project.id) ?? [],
  }));
}

async function syncEngagements(
  handle: DbHandle,
  ownerUserId: string,
  projectId: string,
  engagementIds: string[],
) {
  await handle
    .deleteFrom('app.careerProjectEngagements')
    .where('ownerUserid', '=', ownerUserId)
    .where('projectId', '=', projectId)
    .execute();

  if (engagementIds.length === 0) return;

  const validEngagements = await handle
    .selectFrom('app.careerEngagements')
    .select('id')
    .where('ownerUserid', '=', ownerUserId)
    .where('id', 'in', engagementIds)
    .execute();
  const validIds = validEngagements.map((engagement) => engagement.id);

  if (validIds.length > 0) {
    await handle
      .insertInto('app.careerProjectEngagements')
      .values(
        validIds.map((engagementId) => ({
          projectId,
          engagementId,
          ownerUserid: ownerUserId,
        })),
      )
      .onConflict((oc) => oc.columns(['projectId', 'engagementId']).doNothing())
      .execute();
  }
}

export const ProjectRepository = {
  async list(handle: DbHandle, ownerUserId: string): Promise<CareerProjectRecord[]> {
    const projects = await handle
      .selectFrom('app.careerProjects')
      .selectAll()
      .where('ownerUserid', '=', ownerUserId)
      .orderBy('sortOrder', 'asc')
      .execute();
    return withEngagements(handle, ownerUserId, projects);
  },

  // Sorted by sort order, with `id` as the tiebreaker that gives the keyset walk a total order.
  // Only the page's rows are enriched with their engagement links.
  async listPage(
    handle: DbHandle,
    ownerUserId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<CareerPage<CareerProjectRecord>> {
    const limit = opts?.limit ?? CAREER_PAGE_DEFAULT_LIMIT;
    const filter = '';
    const cursor = opts?.cursor
      ? decodeCareerCursor(opts.cursor, {
          route: 'career.projects',
          filter,
          keys: ['int', 'uuid'],
        })
      : null;

    let query = handle
      .selectFrom('app.careerProjects')
      .selectAll()
      .where('ownerUserid', '=', ownerUserId);

    if (cursor) {
      const [sortOrder, id] = cursor;
      query = query.where(sql<boolean>`("sort_order", "id") > (${sortOrder}::int, ${id}::uuid)`);
    }

    const rows = await query
      .orderBy('sortOrder', 'asc')
      .orderBy('id', 'asc')
      .limit(limit + 1)
      .execute();

    const page = toCareerPage(rows, limit, (last) =>
      encodeCareerCursor('career.projects', filter, [last.sortOrder, last.id]),
    );
    return { items: await withEngagements(handle, ownerUserId, page.items), next: page.next };
  },

  async get(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
  ): Promise<CareerProjectRecord | null> {
    const row = await handle
      .selectFrom('app.careerProjects')
      .selectAll()
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .executeTakeFirst();
    if (!row) return null;
    return (await withEngagements(handle, ownerUserId, [row]))[0];
  },

  async create(
    handle: DbHandle,
    ownerUserId: string,
    input: CareerProjectInput,
  ): Promise<CareerProjectRecord> {
    const { engagementIds = [], technologies, ...projectInput } = input;
    const project = await handle
      .insertInto('app.careerProjects')
      .values({
        ownerUserid: ownerUserId,
        ...projectInput,
        // pg serializes a bare JS array parameter as a Postgres array literal,
        // not JSON, so a jsonb array column needs the value passed as a JSON
        // string with an explicit ::jsonb cast.
        technologies: sql<JsonArray>`${JSON.stringify(technologies ?? [])}::jsonb`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await syncEngagements(handle, ownerUserId, project.id, engagementIds);
    return (await withEngagements(handle, ownerUserId, [project]))[0];
  },

  async update(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
    input: Partial<CareerProjectInput>,
  ): Promise<CareerProjectRecord | null> {
    const { engagementIds, technologies, ...projectInput } = input;
    const result =
      Object.keys(projectInput).length === 0 && technologies === undefined
        ? await handle
            .selectFrom('app.careerProjects')
            .selectAll()
            .where('id', '=', id)
            .where('ownerUserid', '=', ownerUserId)
            .executeTakeFirst()
        : await handle
            .updateTable('app.careerProjects')
            .set({
              ...projectInput,
              ...(technologies !== undefined
                ? { technologies: sql<JsonArray>`${JSON.stringify(technologies)}::jsonb` }
                : {}),
            })
            .where('id', '=', id)
            .where('ownerUserid', '=', ownerUserId)
            .returningAll()
            .executeTakeFirst();
    if (!result) return null;

    if (engagementIds !== undefined) {
      await syncEngagements(handle, ownerUserId, id, engagementIds);
    }
    return (await withEngagements(handle, ownerUserId, [result]))[0];
  },

  async remove(handle: DbHandle, ownerUserId: string, id: string): Promise<boolean> {
    const deleted = await handle
      .deleteFrom('app.careerProjects')
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .returning('id')
      .executeTakeFirst();
    return deleted !== undefined;
  },
};

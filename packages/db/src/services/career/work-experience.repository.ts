import type { Selectable } from 'kysely';
import { sql } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppWorkExperiences, JsonValue } from '../../types/database';
import { verifyPortfolioOwnership } from './ownership';

type WorkExperienceRow = Selectable<AppWorkExperiences>;

function serializeJsonColumn(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}

export interface WorkExperienceRecord {
  id: string;
  portfolioId: string;
  role: string;
  company: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  action: string | null;
  tags: JsonValue;
  metadata: JsonValue;
  sortOrder: number;
  isVisible: boolean;
  image: string | null;
  gradient: string | null;
  metrics: string | null;
  baseSalary: number | null;
  signingBonus: number | null;
  annualBonus: number | null;
  currency: string;
  bonusHistory: JsonValue;
  salaryAdjustments: JsonValue;
  salaryRange: JsonValue;
  employmentType: string;
  workArrangement: string;
  seniorityLevel: string | null;
  department: string | null;
  teamSize: number | null;
  directReports: number;
  reportsTo: string | null;
  benefits: JsonValue;
  performanceRatings: JsonValue;
  reasonForLeaving: string | null;
  exitNotes: string | null;
  createdat: string;
  updatedat: string;
}

type PublicWorkExperienceExcludedFields =
  | 'annualBonus'
  | 'baseSalary'
  | 'benefits'
  | 'bonusHistory'
  | 'currency'
  | 'directReports'
  | 'exitNotes'
  | 'performanceRatings'
  | 'reasonForLeaving'
  | 'reportsTo'
  | 'salaryAdjustments'
  | 'salaryRange'
  | 'signingBonus'
  | 'teamSize';

export type PublicWorkExperienceRecord = Omit<
  WorkExperienceRecord,
  PublicWorkExperienceExcludedFields
>;

export function redactWorkExperienceForPublic(
  record: WorkExperienceRecord,
): PublicWorkExperienceRecord {
  const {
    annualBonus: _annualBonus,
    baseSalary: _baseSalary,
    benefits: _benefits,
    bonusHistory: _bonusHistory,
    currency: _currency,
    directReports: _directReports,
    exitNotes: _exitNotes,
    performanceRatings: _performanceRatings,
    reasonForLeaving: _reasonForLeaving,
    reportsTo: _reportsTo,
    salaryAdjustments: _salaryAdjustments,
    salaryRange: _salaryRange,
    signingBonus: _signingBonus,
    teamSize: _teamSize,
    ...publicRecord
  } = record;
  return publicRecord;
}

export interface CreateWorkExperienceInput {
  portfolioId: string;
  role: string;
  company: string;
  description: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  action?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  sortOrder?: number;
  isVisible?: boolean;
}

export interface UpdateWorkExperienceInput {
  role?: string;
  company?: string;
  description?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  action?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  sortOrder?: number;
  isVisible?: boolean;
  baseSalary?: number | null;
  signingBonus?: number | null;
  annualBonus?: number | null;
  employmentType?: string | null;
  workArrangement?: string | null;
  seniorityLevel?: string | null;
  department?: string | null;
  teamSize?: number | null;
  directReports?: number | null;
  reportsTo?: string | null;
  reasonForLeaving?: string | null;
  exitNotes?: string | null;
}

function toWorkExperienceRecord(row: WorkExperienceRow): WorkExperienceRecord {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    role: row.role,
    company: row.company,
    description: row.description,
    startDate: row.startDate ? String(row.startDate) : null,
    endDate: row.endDate ? String(row.endDate) : null,
    action: row.action,
    tags: row.tags,
    metadata: row.metadata,
    sortOrder: row.sortOrder,
    isVisible: row.isVisible,
    image: row.image,
    gradient: row.gradient,
    metrics: row.metrics,
    baseSalary: row.baseSalary,
    signingBonus: row.signingBonus,
    annualBonus: row.annualBonus,
    currency: row.currency,
    bonusHistory: row.bonusHistory,
    salaryAdjustments: row.salaryAdjustments,
    salaryRange: row.salaryRange,
    employmentType: row.employmentType,
    workArrangement: row.workArrangement,
    seniorityLevel: row.seniorityLevel,
    department: row.department,
    teamSize: row.teamSize,
    directReports: row.directReports,
    reportsTo: row.reportsTo,
    benefits: row.benefits,
    performanceRatings: row.performanceRatings,
    reasonForLeaving: row.reasonForLeaving,
    exitNotes: row.exitNotes,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
  };
}

export const WorkExperienceRepository = {
  async listUserWorkExperiences(
    handle: DbHandle,
    ownerUserid: string,
    direction: 'asc' | 'desc' = 'desc',
  ): Promise<WorkExperienceRecord[]> {
    let query = handle
      .selectFrom('app.workExperiences as workExperience')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'workExperience.portfolioId')
      .selectAll('workExperience')
      .where('portfolio.ownerUserid', '=', ownerUserid);

    // Use Kysely orderBy (not raw sql aliases): CamelCasePlugin rewrites
    // workExperience → work_experience, so quoted raw identifiers miss the FROM alias.
    query =
      direction === 'desc'
        ? query
            .orderBy('workExperience.endDate', (ob) => ob.desc().nullsFirst())
            .orderBy('workExperience.startDate', 'desc')
        : query
            .orderBy(sql`case when ${sql.ref('workExperience.endDate')} is null then 1 else 0 end`)
            .orderBy('workExperience.startDate', 'asc')
            .orderBy('workExperience.endDate', 'asc');

    const rows = await query.execute();

    return (rows as WorkExperienceRow[]).map(toWorkExperienceRecord);
  },

  /** Ordered for full-portfolio composition — see PortfolioRepository.loadFullPortfolio. */
  async listByPortfolioId(handle: DbHandle, portfolioId: string): Promise<WorkExperienceRecord[]> {
    const rows = await handle
      .selectFrom('app.workExperiences')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .orderBy('startDate', (ob) => ob.asc().nullsLast())
      .execute();

    return (rows as WorkExperienceRow[]).map(toWorkExperienceRecord);
  },

  async listPublicByPortfolioId(
    handle: DbHandle,
    portfolioId: string,
  ): Promise<PublicWorkExperienceRecord[]> {
    const records = await WorkExperienceRepository.listByPortfolioId(handle, portfolioId);
    return records.map(redactWorkExperienceForPublic);
  },

  async getWorkExperienceById(
    handle: DbHandle,
    ownerUserid: string,
    experienceId: string,
  ): Promise<WorkExperienceRecord | null> {
    const row = await handle
      .selectFrom('app.workExperiences as workExperience')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'workExperience.portfolioId')
      .selectAll('workExperience')
      .where('portfolio.ownerUserid', '=', ownerUserid)
      .where('workExperience.id', '=', experienceId)
      .executeTakeFirst();

    return row ? toWorkExperienceRecord(row as WorkExperienceRow) : null;
  },

  async createWorkExperience(
    handle: DbHandle,
    ownerUserid: string,
    input: CreateWorkExperienceInput,
  ): Promise<WorkExperienceRecord> {
    await verifyPortfolioOwnership(handle, ownerUserid, input.portfolioId);

    const created = await handle
      .insertInto('app.workExperiences')
      .values({
        portfolioId: input.portfolioId,
        role: input.role,
        company: input.company,
        description: input.description,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        action: input.action ?? null,
        ...(input.tags !== undefined ? { tags: serializeJsonColumn(input.tags) } : {}),
        ...(input.metadata !== undefined
          ? { metadata: serializeJsonColumn(input.metadata ?? null) }
          : {}),
        sortOrder: input.sortOrder ?? 0,
        isVisible: input.isVisible ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toWorkExperienceRecord(created as WorkExperienceRow);
  },

  async updateWorkExperience(
    handle: DbHandle,
    ownerUserid: string,
    experienceId: string,
    updates: UpdateWorkExperienceInput,
  ): Promise<WorkExperienceRecord> {
    const existing = await WorkExperienceRepository.getWorkExperienceById(
      handle,
      ownerUserid,
      experienceId,
    );
    if (!existing) {
      throw new NotFoundError('WorkExperience', { experienceId, ownerUserid });
    }

    // Build only the columns that were explicitly provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set: Record<string, any> = {};
    if (updates.role !== undefined) set.role = updates.role;
    if (updates.company !== undefined) set.company = updates.company;
    if (updates.description !== undefined) set.description = updates.description;
    if (updates.startDate !== undefined)
      set.startDate = updates.startDate ? new Date(updates.startDate) : null;
    if (updates.endDate !== undefined)
      set.endDate = updates.endDate ? new Date(updates.endDate) : null;
    if (updates.action !== undefined) set.action = updates.action;
    if (updates.tags !== undefined) set.tags = serializeJsonColumn(updates.tags);
    if (updates.metadata !== undefined)
      set.metadata = serializeJsonColumn(updates.metadata ?? null);
    if (updates.sortOrder !== undefined) set.sortOrder = updates.sortOrder;
    if (updates.isVisible !== undefined) set.isVisible = updates.isVisible;
    if (updates.baseSalary !== undefined) set.baseSalary = updates.baseSalary;
    if (updates.signingBonus !== undefined) set.signingBonus = updates.signingBonus;
    if (updates.annualBonus !== undefined) set.annualBonus = updates.annualBonus;
    if (updates.employmentType !== undefined) set.employmentType = updates.employmentType;
    if (updates.workArrangement !== undefined) set.workArrangement = updates.workArrangement;
    if (updates.seniorityLevel !== undefined) set.seniorityLevel = updates.seniorityLevel;
    if (updates.department !== undefined) set.department = updates.department;
    if (updates.teamSize !== undefined) set.teamSize = updates.teamSize;
    if (updates.directReports !== undefined) set.directReports = updates.directReports;
    if (updates.reportsTo !== undefined) set.reportsTo = updates.reportsTo;
    if (updates.reasonForLeaving !== undefined) set.reasonForLeaving = updates.reasonForLeaving;
    if (updates.exitNotes !== undefined) set.exitNotes = updates.exitNotes;

    const updated = await handle
      .updateTable('app.workExperiences')
      // biome-ignore lint/suspicious/noExplicitAny: dynamic column mapping
      .set(set as any)
      .where('id', '=', experienceId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return toWorkExperienceRecord(updated as WorkExperienceRow);
  },

  async deleteWorkExperience(
    handle: DbHandle,
    ownerUserid: string,
    experienceId: string,
    portfolioId: string,
  ): Promise<void> {
    await verifyPortfolioOwnership(handle, ownerUserid, portfolioId);

    await handle
      .deleteFrom('app.workExperiences')
      .where('id', '=', experienceId)
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },
};

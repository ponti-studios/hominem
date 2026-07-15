import type { Selectable } from 'kysely';
import { sql } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppPortfolios } from '../../types/database';
import { verifyPortfolioOwnership } from './ownership';
import { ProjectRepository, type ProjectRecord } from './project.repository';
import { SkillRepository, type SkillRecord } from './skill.repository';
import { TestimonialRepository, type TestimonialRecord } from './testimonial.repository';
import {
  WorkExperienceRepository,
  type PublicWorkExperienceRecord,
  type WorkExperienceRecord,
} from './work-experience.repository';

type PortfolioRow = Selectable<AppPortfolios>;

export interface PortfolioRecord {
  id: string;
  ownerUserid: string;
  slug: string;
  name: string;
  initials: string | null;
  jobTitle: string;
  title: string;
  bio: string;
  tagline: string;
  currentLocation: string;
  email: string;
  phone: string | null;
  availabilityStatus: boolean;
  openToRemote: boolean;
  copyright: string | null;
  isPublic: boolean;
  isActive: boolean;
  profileImageUrl: string | null;
  createdat: string;
  updatedat: string;
}

export interface FullPortfolioRecord extends PortfolioRecord {
  work_experiences: WorkExperienceRecord[];
  skills: SkillRecord[];
  projects: ProjectRecord[];
  testimonials: TestimonialRecord[];
}

/** Work experiences, skills, and projects only — no testimonials. For callers (LLM prompt context) that never read testimonials. */
export interface ResumePortfolioRecord extends PortfolioRecord {
  work_experiences: WorkExperienceRecord[];
  skills: SkillRecord[];
  projects: ProjectRecord[];
}

/** Public-safe work experiences, skills, and projects only — no testimonials. For the public profile page, which doesn't render testimonials. */
export interface PublicPortfolioProfileRecord extends PortfolioRecord {
  work_experiences: PublicWorkExperienceRecord[];
  skills: SkillRecord[];
  projects: ProjectRecord[];
}

export type TimelineEntryKind =
  | 'career_event'
  | 'project'
  | 'testimonial'
  | 'application'
  | 'status_change';

export interface TimelineEntryRecord {
  id: string;
  kind: TimelineEntryKind;
  date: string;
  title: string;
  subtitle?: string;
  statusPill?: string;
  workExperienceId: string | null;
}

export interface ChapterWithEntries {
  workExperience: WorkExperienceRecord;
  entries: TimelineEntryRecord[];
}

export interface PortfolioTimeline {
  chapters: ChapterWithEntries[];
  unattributedEntries: TimelineEntryRecord[];
}

interface TimelineEntryRow {
  id: string;
  kind: TimelineEntryKind;
  date: string;
  title: string;
  subtitle: string | null;
  statusPill: string | null;
  workExperienceId: string | null;
}

function toTimelineEntryRecord(row: TimelineEntryRow): TimelineEntryRecord {
  return {
    id: row.id,
    kind: row.kind,
    date: String(row.date),
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    statusPill: row.statusPill ?? undefined,
    workExperienceId: row.workExperienceId,
  };
}

function byDateDesc(left: { date: string }, right: { date: string }): number {
  return new Date(right.date).getTime() - new Date(left.date).getTime();
}

export interface CreateDefaultPortfolioInput {
  ownerUserid: string;
  email: string;
  name: string;
}

export interface SavePortfolioBasicsInput {
  name: string;
  initials?: string | null;
  jobTitle: string;
  title?: string | null;
  bio: string;
  tagline: string;
  currentLocation: string;
  email: string;
  phone?: string | null;
  availabilityStatus?: boolean;
  openToRemote?: boolean;
  copyright?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
}

function toPortfolioRecord(row: PortfolioRow): PortfolioRecord {
  return {
    id: row.id,
    ownerUserid: row.ownerUserid,
    slug: row.slug,
    name: row.name,
    initials: row.initials,
    jobTitle: row.jobTitle,
    title: row.title,
    bio: row.bio,
    tagline: row.tagline,
    currentLocation: row.currentLocation,
    email: row.email,
    phone: row.phone,
    availabilityStatus: row.availabilityStatus,
    openToRemote: row.openToRemote,
    copyright: row.copyright,
    isPublic: row.isPublic,
    isActive: row.isActive,
    profileImageUrl: row.profileImageUrl,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
  };
}

function createPortfolioSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'portfolio'}-${suffix}`;
}

async function loadFullPortfolio(
  handle: DbHandle,
  portfolio: PortfolioRecord,
): Promise<FullPortfolioRecord> {
  const [work_experiences, skills, projects, testimonials] = await Promise.all([
    WorkExperienceRepository.listByPortfolioId(handle, portfolio.id),
    SkillRepository.listByPortfolioId(handle, portfolio.id),
    ProjectRepository.listByPortfolioId(handle, portfolio.id),
    TestimonialRepository.listByPortfolioId(handle, portfolio.id),
  ]);

  return {
    ...portfolio,
    work_experiences,
    skills,
    projects,
    testimonials,
  };
}

async function loadResumeContext(
  handle: DbHandle,
  portfolio: PortfolioRecord,
): Promise<ResumePortfolioRecord> {
  const [work_experiences, skills, projects] = await Promise.all([
    WorkExperienceRepository.listByPortfolioId(handle, portfolio.id),
    SkillRepository.listByPortfolioId(handle, portfolio.id),
    ProjectRepository.listByPortfolioId(handle, portfolio.id),
  ]);

  return { ...portfolio, work_experiences, skills, projects };
}

async function loadPublicProfile(
  handle: DbHandle,
  portfolio: PortfolioRecord,
): Promise<PublicPortfolioProfileRecord> {
  const [work_experiences, skills, projects] = await Promise.all([
    WorkExperienceRepository.listPublicByPortfolioId(handle, portfolio.id),
    SkillRepository.listVisibleByPortfolioId(handle, portfolio.id),
    ProjectRepository.listVisibleByPortfolioId(handle, portfolio.id),
  ]);

  return { ...portfolio, work_experiences, skills, projects };
}

export const PortfolioRepository = {
  async getPortfolioByUserId(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<PortfolioRecord | null> {
    const row = await handle
      .selectFrom('app.portfolios')
      .selectAll()
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirst();

    return row ? toPortfolioRecord(row as PortfolioRow) : null;
  },

  async getPortfolioBySlug(handle: DbHandle, slug: string): Promise<PortfolioRecord | null> {
    const row = await handle
      .selectFrom('app.portfolios')
      .selectAll()
      .where(sql<string>`lower(slug)`, '=', slug.toLowerCase())
      .executeTakeFirst();

    return row ? toPortfolioRecord(row as PortfolioRow) : null;
  },

  /** Just the id — for callers that only need to resolve or check existence of a user's portfolio, not read its fields. */
  async getPortfolioIdByUserId(handle: DbHandle, ownerUserid: string): Promise<string | null> {
    const row = await handle
      .selectFrom('app.portfolios')
      .select('id')
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirst();

    return row?.id ?? null;
  },

  async loadFullPortfolioByUserId(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<FullPortfolioRecord | null> {
    const portfolio = await PortfolioRepository.getPortfolioByUserId(handle, ownerUserid);
    return portfolio ? loadFullPortfolio(handle, portfolio) : null;
  },

  /** Work experiences, skills, and projects for LLM prompt context — skips the testimonials fetch, which resume generation never reads. */
  async loadResumeContextByUserId(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<ResumePortfolioRecord | null> {
    const portfolio = await PortfolioRepository.getPortfolioByUserId(handle, ownerUserid);
    return portfolio ? loadResumeContext(handle, portfolio) : null;
  },

  /** Work experiences, skills, and projects for the public profile page — skips the testimonials fetch, which that page doesn't render. */
  async loadPublicProfileBySlug(
    handle: DbHandle,
    slug: string,
  ): Promise<PublicPortfolioProfileRecord | null> {
    const portfolio = await PortfolioRepository.getPortfolioBySlug(handle, slug);
    if (!portfolio || !portfolio.isPublic || !portfolio.isActive) {
      return null;
    }
    return loadPublicProfile(handle, portfolio);
  },

  /**
   * Career timeline for a user's portfolio: work-experience chapters, each
   * populated with the career events, projects, testimonials, and job-application
   * status changes that fall within it. Testimonials have no direct FK to a
   * chapter, so they're attributed by date-range containment (most-recently-started
   * chapter wins on overlap). Status changes are never attributed — an interview
   * isn't necessarily at the chapter's employer — so they always land in
   * `unattributedEntries`.
   *
   * All entry sources are pulled in a single UNION ALL query.
   */
  async getTimeline(handle: DbHandle, ownerUserid: string): Promise<PortfolioTimeline | null> {
    const portfolioId = await PortfolioRepository.getPortfolioIdByUserId(handle, ownerUserid);
    if (!portfolioId) return null;

    const [workExperiences, entryRows] = await Promise.all([
      WorkExperienceRepository.listByPortfolioId(handle, portfolioId),
      sql<TimelineEntryRow>`
        SELECT * FROM (
          SELECT
            'career_event:' || ce.id::text AS id,
            'career_event'::text AS kind,
            ce.event_date AS date,
            replace(ce.event_type, '_', ' ') AS title,
            ce.description AS subtitle,
            NULL::text AS "statusPill",
            ce.work_experience_id AS "workExperienceId"
          FROM app.career_events ce
          WHERE ce.owner_userid = ${ownerUserid}

          UNION ALL

          SELECT
            'project:' || p.id::text,
            'project',
            COALESCE(p.end_date, p.start_date, p.createdat),
            (CASE p.status
              WHEN 'completed' THEN 'Shipped'
              WHEN 'in-progress' THEN 'Started'
              WHEN 'archived' THEN 'Archived'
              ELSE 'Updated'
            END) || ' "' || p.title || '"',
            p.short_description,
            NULL::text,
            p.work_experience_id
          FROM app.projects p
          WHERE p.portfolio_id = ${portfolioId}

          UNION ALL

          SELECT
            'testimonial:' || t.id::text,
            'testimonial',
            t.createdat,
            'Feedback from ' || t.name,
            t.content,
            NULL::text,
            attributed.id
          FROM app.testimonials t
          LEFT JOIN LATERAL (
            SELECT we.id
            FROM app.work_experiences we
            WHERE we.portfolio_id = ${portfolioId}
              AND we.start_date IS NOT NULL
              AND we.start_date <= t.createdat
              AND (we.end_date IS NULL OR we.end_date >= t.createdat)
            ORDER BY we.start_date DESC
            LIMIT 1
          ) attributed ON true
          WHERE t.portfolio_id = ${portfolioId}

          UNION ALL

          SELECT
            'application:' || ja.id::text,
            'application',
            COALESCE(ja.application_date, ja.createdat),
            'Applied for ' || ja.position,
            c.name,
            ja.status,
            NULL::uuid
          FROM app.job_applications ja
          LEFT JOIN app.companies c ON c.id = ja.company_id
          WHERE ja.owner_userid = ${ownerUserid}

          UNION ALL

          SELECT
            'status:' || h.id::text,
            'status_change',
            h.changed_at,
            ja.position || ' — status changed to ' || replace(h.new_status, '_', ' '),
            c.name,
            (CASE WHEN h.new_status IN ('OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')
              THEN h.new_status ELSE NULL END),
            NULL::uuid
          FROM app.job_application_status_history h
          INNER JOIN app.job_applications ja ON ja.id = h.application_id
          LEFT JOIN app.companies c ON c.id = ja.company_id
          WHERE ja.owner_userid = ${ownerUserid}
        ) combined
        ORDER BY date DESC
      `.execute(handle),
    ]);

    const chaptersByExperienceId = new Map<string, ChapterWithEntries>();
    for (const workExperience of workExperiences) {
      chaptersByExperienceId.set(workExperience.id, { workExperience, entries: [] });
    }

    const unattributedEntries: TimelineEntryRecord[] = [];

    for (const row of entryRows.rows) {
      const entry = toTimelineEntryRecord(row);
      const chapter = entry.workExperienceId
        ? chaptersByExperienceId.get(entry.workExperienceId)
        : undefined;
      if (chapter) {
        chapter.entries.push(entry);
      } else {
        unattributedEntries.push(entry);
      }
    }

    const chapters = [...chaptersByExperienceId.values()]
      .sort((left, right) => {
        const leftStart = left.workExperience.startDate
          ? new Date(left.workExperience.startDate).getTime()
          : 0;
        const rightStart = right.workExperience.startDate
          ? new Date(right.workExperience.startDate).getTime()
          : 0;
        return rightStart - leftStart;
      })
      .map((chapter) => ({
        ...chapter,
        entries: [...chapter.entries].sort(byDateDesc),
      }));

    return {
      chapters,
      unattributedEntries: unattributedEntries.sort(byDateDesc),
    };
  },

  async isSlugAvailable(
    handle: DbHandle,
    slug: string,
    currentPortfolioId?: string,
  ): Promise<boolean> {
    let query = handle
      .selectFrom('app.portfolios')
      .select('id')
      .where(sql<string>`lower(slug)`, '=', slug.toLowerCase());

    if (currentPortfolioId) {
      query = query.where('id', '!=', currentPortfolioId);
    }

    const existing = await query.executeTakeFirst();
    return !existing;
  },

  async createDefaultPortfolio(
    handle: DbHandle,
    input: CreateDefaultPortfolioInput,
  ): Promise<PortfolioRecord> {
    const existingId = await PortfolioRepository.getPortfolioIdByUserId(handle, input.ownerUserid);
    if (existingId) {
      throw new Error('User already has a portfolio');
    }

    // NOT NULL / not-blank checks require non-empty strings; use quiet placeholders
    // until the user uploads a resume or edits basics.
    const created = await handle
      .insertInto('app.portfolios')
      .values({
        ownerUserid: input.ownerUserid,
        slug: createPortfolioSlug(input.name),
        title: `${input.name}'s Portfolio`,
        name: input.name,
        jobTitle: 'Your title',
        bio: 'Add a short bio.',
        tagline: 'Getting started',
        currentLocation: 'Location',
        email: input.email,
        isPublic: false,
        isActive: true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toPortfolioRecord(created as PortfolioRow);
  },

  async deletePortfolioByUserId(handle: DbHandle, ownerUserid: string): Promise<void> {
    const deleted = await handle
      .deleteFrom('app.portfolios')
      .where('ownerUserid', '=', ownerUserid)
      .returning('id')
      .executeTakeFirst();

    if (!deleted) throw new NotFoundError('Portfolio', { ownerUserid });
  },

  async updatePortfolioSlug(
    handle: DbHandle,
    ownerUserid: string,
    portfolioId: string,
    slug: string,
  ): Promise<void> {
    await verifyPortfolioOwnership(handle, ownerUserid, portfolioId);

    await handle
      .updateTable('app.portfolios')
      .set({ slug })
      .where('id', '=', portfolioId)
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirstOrThrow();
  },

  async updatePortfolioProfileImage(
    handle: DbHandle,
    ownerUserid: string,
    profileImageUrl: string,
  ): Promise<void> {
    const updated = await handle
      .updateTable('app.portfolios')
      .set({ profileImageUrl: profileImageUrl })
      .where('ownerUserid', '=', ownerUserid)
      .returning('id')
      .executeTakeFirst();

    if (!updated) {
      throw new NotFoundError('Portfolio', { ownerUserid });
    }
  },

  async savePortfolioBasics(
    handle: DbHandle,
    ownerUserid: string,
    input: SavePortfolioBasicsInput,
  ): Promise<PortfolioRecord> {
    const existingId = await PortfolioRepository.getPortfolioIdByUserId(handle, ownerUserid);

    if (existingId) {
      const updated = await handle
        .updateTable('app.portfolios')
        .set({
          name: input.name,
          initials: input.initials ?? null,
          jobTitle: input.jobTitle,
          title: input.title ?? `${input.name}'s Portfolio`,
          bio: input.bio,
          tagline: input.tagline,
          currentLocation: input.currentLocation,
          email: input.email,
          phone: input.phone ?? null,
          availabilityStatus: input.availabilityStatus ?? false,
          openToRemote: input.openToRemote ?? false,
          ...(input.copyright !== undefined ? { copyright: input.copyright } : {}),
          ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        })
        .where('id', '=', existingId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return toPortfolioRecord(updated as PortfolioRow);
    }

    const created = await handle
      .insertInto('app.portfolios')
      .values({
        ownerUserid: ownerUserid,
        slug: createPortfolioSlug(input.name),
        name: input.name,
        initials: input.initials ?? null,
        jobTitle: input.jobTitle,
        title: input.title ?? `${input.name}'s Portfolio`,
        bio: input.bio,
        tagline: input.tagline,
        currentLocation: input.currentLocation,
        email: input.email,
        phone: input.phone ?? null,
        availabilityStatus: input.availabilityStatus ?? false,
        openToRemote: input.openToRemote ?? false,
        ...(input.copyright !== undefined ? { copyright: input.copyright } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toPortfolioRecord(created as PortfolioRow);
  },
};

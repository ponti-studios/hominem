import type { Selectable } from 'kysely';
import { sql } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppPortfolios } from '../../types/database';
import { verifyPortfolioOwnership } from './ownership';
import { ProjectRepository, type ProjectRecord } from './project.repository';
import { SkillRepository, type SkillRecord } from './skill.repository';
import { TestimonialRepository, type TestimonialRecord } from './testimonial.repository';
import { WorkExperienceRepository, type WorkExperienceRecord } from './work-experience.repository';

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

  async loadFullPortfolioByUserId(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<FullPortfolioRecord | null> {
    const portfolio = await PortfolioRepository.getPortfolioByUserId(handle, ownerUserid);
    return portfolio ? loadFullPortfolio(handle, portfolio) : null;
  },

  async loadFullPortfolioBySlug(
    handle: DbHandle,
    slug: string,
  ): Promise<FullPortfolioRecord | null> {
    const portfolio = await PortfolioRepository.getPortfolioBySlug(handle, slug);
    if (!portfolio || !portfolio.isPublic || !portfolio.isActive) {
      return null;
    }
    return loadFullPortfolio(handle, portfolio);
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
    const existing = await PortfolioRepository.getPortfolioByUserId(handle, input.ownerUserid);
    if (existing) {
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
    await handle.deleteFrom('app.portfolios').where('ownerUserid', '=', ownerUserid).execute();
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
    const portfolio = await PortfolioRepository.getPortfolioByUserId(handle, ownerUserid);
    if (!portfolio) {
      throw new NotFoundError('Portfolio', { ownerUserid });
    }

    await handle
      .updateTable('app.portfolios')
      .set({ profileImageUrl: profileImageUrl })
      .where('id', '=', portfolio.id)
      .executeTakeFirstOrThrow();
  },

  async savePortfolioBasics(
    handle: DbHandle,
    ownerUserid: string,
    input: SavePortfolioBasicsInput,
  ): Promise<PortfolioRecord> {
    const existing = await PortfolioRepository.getPortfolioByUserId(handle, ownerUserid);

    if (existing) {
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
        .where('id', '=', existing.id)
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

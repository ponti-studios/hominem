import type { Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppTestimonials } from '../../types/database';
import { verifyPortfolioOwnership } from './ownership';

type TestimonialRow = Selectable<AppTestimonials>;

export interface TestimonialRecord {
  id: string;
  portfolioId: string;
  name: string;
  title: string | null;
  company: string | null;
  content: string;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  rating: number | null;
  isVerified: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdat: string;
  updatedat: string;
}

export interface CreateTestimonialInput {
  portfolioId: string;
  name: string;
  title?: string | null;
  company?: string | null;
  content: string;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
  rating?: number | null;
}

export interface UpdateTestimonialInput {
  name: string;
  title?: string | null;
  company?: string | null;
  content: string;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
  rating?: number | null;
}

function toTestimonialRecord(row: TestimonialRow): TestimonialRecord {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    name: row.name,
    title: row.title,
    company: row.company,
    content: row.content,
    avatarUrl: row.avatarUrl,
    linkedinUrl: row.linkedinUrl,
    rating: row.rating,
    isVerified: row.isVerified,
    isVisible: row.isVisible,
    sortOrder: row.sortOrder,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
  };
}

export const TestimonialRepository = {
  /** Ordered for full-portfolio composition — see PortfolioRepository.loadFullPortfolio. */
  async listByPortfolioId(handle: DbHandle, portfolioId: string): Promise<TestimonialRecord[]> {
    const rows = await handle
      .selectFrom('app.testimonials')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .orderBy('sortOrder', 'asc')
      .execute();

    return (rows as TestimonialRow[]).map(toTestimonialRecord);
  },

  async createTestimonial(
    handle: DbHandle,
    ownerUserid: string,
    input: CreateTestimonialInput,
  ): Promise<TestimonialRecord> {
    await verifyPortfolioOwnership(handle, ownerUserid, input.portfolioId);

    const created = await handle
      .insertInto('app.testimonials')
      .values({
        portfolioId: input.portfolioId,
        name: input.name,
        title: input.title ?? null,
        company: input.company ?? null,
        content: input.content,
        avatarUrl: input.avatarUrl ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        rating: input.rating ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toTestimonialRecord(created as TestimonialRow);
  },

  async updateTestimonial(
    handle: DbHandle,
    ownerUserid: string,
    testimonialId: string,
    portfolioId: string,
    input: UpdateTestimonialInput,
  ): Promise<void> {
    await verifyPortfolioOwnership(handle, ownerUserid, portfolioId);

    await handle
      .updateTable('app.testimonials')
      .set({
        name: input.name,
        title: input.title ?? null,
        company: input.company ?? null,
        content: input.content,
        avatarUrl: input.avatarUrl ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        rating: input.rating ?? null,
      })
      .where('id', '=', testimonialId)
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async deleteTestimonial(
    handle: DbHandle,
    ownerUserid: string,
    testimonialId: string,
    portfolioId: string,
  ): Promise<void> {
    await verifyPortfolioOwnership(handle, ownerUserid, portfolioId);

    await handle
      .deleteFrom('app.testimonials')
      .where('id', '=', testimonialId)
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },
};

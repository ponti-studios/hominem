import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
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

export interface CreateTestimonialCommand extends CreateTestimonialInput {
  ownerUserid: string;
}

export interface UpdateTestimonialCommand {
  ownerUserid: string;
  testimonialId: string;
  portfolioId: string;
  input: UpdateTestimonialInput;
}

export interface DeleteTestimonialCommand {
  ownerUserid: string;
  testimonialId: string;
  portfolioId: string;
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

  async getTestimonialById(
    handle: DbHandle,
    ownerUserid: string,
    testimonialId: string,
  ): Promise<TestimonialRecord | null> {
    const row = await handle
      .selectFrom('app.testimonials as testimonial')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'testimonial.portfolioId')
      .selectAll('testimonial')
      .where('portfolio.ownerUserid', '=', ownerUserid)
      .where('testimonial.id', '=', testimonialId)
      .executeTakeFirst();

    return row ? toTestimonialRecord(row as TestimonialRow) : null;
  },

  async createTestimonial(
    handle: DbHandle,
    command: CreateTestimonialCommand,
  ): Promise<TestimonialRecord> {
    await verifyPortfolioOwnership(handle, command.ownerUserid, command.portfolioId);

    const created = await handle
      .insertInto('app.testimonials')
      .values({
        portfolioId: command.portfolioId,
        name: command.name,
        title: command.title ?? null,
        company: command.company ?? null,
        content: command.content,
        avatarUrl: command.avatarUrl ?? null,
        linkedinUrl: command.linkedinUrl ?? null,
        rating: command.rating ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toTestimonialRecord(created as TestimonialRow);
  },

  async updateTestimonial(handle: DbHandle, command: UpdateTestimonialCommand): Promise<void> {
    await verifyPortfolioOwnership(handle, command.ownerUserid, command.portfolioId);
    const input = command.input;

    const updated = await handle
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
      .where('id', '=', command.testimonialId)
      .where('portfolioId', '=', command.portfolioId)
      .returning('id')
      .executeTakeFirst();

    if (!updated) throw new NotFoundError('Testimonial', { testimonialId: command.testimonialId });
  },

  async deleteTestimonial(handle: DbHandle, command: DeleteTestimonialCommand): Promise<void> {
    await verifyPortfolioOwnership(handle, command.ownerUserid, command.portfolioId);

    const deleted = await handle
      .deleteFrom('app.testimonials')
      .where('id', '=', command.testimonialId)
      .where('portfolioId', '=', command.portfolioId)
      .returning('id')
      .executeTakeFirst();

    if (!deleted) throw new NotFoundError('Testimonial', { testimonialId: command.testimonialId });
  },
};

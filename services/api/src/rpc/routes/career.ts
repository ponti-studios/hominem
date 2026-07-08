import { CareerRepository, db } from '@hominem/db';
import { Hono } from 'hono';

import { authMiddleware, type AppContext } from '../middleware/auth';

// Plain, wire-format response type — deliberately not `CareerPortfolioRecord`
// (Kysely's `Selectable<AppPortfolios>`). The generated `Database` type's
// `Generated<ColumnType<...>>` wrappers cause tsgo to blow past its type
// instantiation depth limit once the response flows through Hono's `hc`
// client inference in consuming apps. Keeping API responses on plain,
// hand-written types (rather than re-exporting ORM-derived types over the
// wire) avoids that and is also the right boundary: callers shouldn't
// depend on Kysely's internal representation.
export interface CareerPortfolioResponse {
  availabilityMessage: string | null;
  availabilityStatus: boolean;
  bio: string;
  copyright: string | null;
  createdat: string;
  currentLocation: string;
  email: string;
  id: string;
  initials: string | null;
  isActive: boolean;
  isPublic: boolean;
  jobTitle: string;
  locationTagline: string | null;
  name: string;
  ownerUserid: string;
  phone: string | null;
  profileImageUrl: string | null;
  slug: string;
  tagline: string;
  theme: unknown | null;
  title: string;
  updatedat: string;
}

export const careerRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/portfolio', async (c) => {
    const userId = c.get('userId')!;
    const record = await CareerRepository.getPortfolioByUserId(db, userId);
    const portfolio: CareerPortfolioResponse | null = record;
    return c.json({ portfolio });
  });

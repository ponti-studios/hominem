import { db, sql } from '@hominem/db';
import { data } from 'react-router';

import { COMMON_SKILLS } from '~/lib/career/common-skills';
import { userContext } from '~/lib/middleware';

import type { Route } from './+types/api.skills.search';

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    return data({ suggestions: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get('q') ?? '';
  const query = raw.trim().toLowerCase();
  if (!query || query.length < 1) {
    return data({ suggestions: [] });
  }

  // 1. Search user's portfolio skills from DB
  const portfolio = await db
    .selectFrom('app.portfolios')
    .select('id')
    .where('ownerUserid', '=', user.id)
    .executeTakeFirst();

  let dbSkills: string[] = [];
  if (portfolio) {
    const rows = await db
      .selectFrom('app.skills')
      .select('name')
      .where('portfolioId', '=', portfolio.id)
      .where(sql<boolean>`name ILIKE ${'%' + query + '%'}`)
      .limit(10)
      .execute();
    dbSkills = rows.map((r) => r.name);
  }

  // 2. Search curated list
  const curated = COMMON_SKILLS.filter(
    (s) => s.toLowerCase().includes(query) && !dbSkills.includes(s),
  ).slice(0, 10);

  // 3. Merge, dedupe, limit
  const seen = new Set<string>();
  const suggestions = [...dbSkills, ...curated].filter((s) => {
    if (seen.has(s.toLowerCase())) return false;
    seen.add(s.toLowerCase());
    return true;
  });

  return data({ suggestions: suggestions.slice(0, 10) });
}

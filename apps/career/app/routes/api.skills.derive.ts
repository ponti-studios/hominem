import { db, PortfolioRepository, runInTransaction, SkillRepository } from '@hominem/db';
import { data } from 'react-router';

import { logger } from '~/lib/logger';
import { userContext } from '~/lib/middleware';
import { deriveSkillsFromCareerHistory } from '~/lib/services/skills-derivation.service';

import type { Route } from './+types/api.skills.derive';

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  const user = context.get(userContext);
  if (!user) {
    return data({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const portfolio = await PortfolioRepository.getPortfolioByUserId(db, user.id);
  if (!portfolio) {
    return data({ success: false, error: 'No portfolio found.' }, { status: 404 });
  }

  let derived: Awaited<ReturnType<typeof deriveSkillsFromCareerHistory>>;
  try {
    derived = await deriveSkillsFromCareerHistory(user.id, portfolio.id);
  } catch (error) {
    logger.error('Skills derivation failed', error, {
      owner_userid: user.id,
      portfolioId: portfolio.id,
    });
    return data({ success: false, error: 'Failed to derive skills. Try again.' }, { status: 500 });
  }

  if (derived.length === 0) {
    return data(
      {
        success: false,
        error: 'No skills could be derived. Add some work experience or projects first.',
      },
      { status: 422 },
    );
  }

  try {
    await runInTransaction((tx) =>
      SkillRepository.replaceSkills(tx, {
        ownerUserid: user.id,
        portfolioId: portfolio.id,
        skills: derived.map((skill) => ({
          name: skill.name,
          category: skill.category,
          level: skill.level,
          ai_derived: true,
          proof: skill.proof,
        })),
      }),
    );
  } catch (error) {
    logger.error('Failed to save derived skills', error, {
      owner_userid: user.id,
      portfolioId: portfolio.id,
    });
    return data({ success: false, error: 'Failed to save skills. Try again.' }, { status: 500 });
  }

  return data({ success: true, skills: derived });
}

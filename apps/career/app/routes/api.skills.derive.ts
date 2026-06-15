import { CareerRepository, runInTransaction } from '@hominem/db';
import { data } from 'react-router';

import { portfolioContext, userContext } from '~/lib/middleware';
import { deriveSkillsFromCareerHistory } from '~/lib/services/skills-derivation.service';

import type { Route } from './+types/api.skills.derive';

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  const user = context.get(userContext);
  const portfolio = context.get(portfolioContext);

  if (!user || !portfolio) {
    return data({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let derived: Awaited<ReturnType<typeof deriveSkillsFromCareerHistory>>;
  try {
    derived = await deriveSkillsFromCareerHistory(user.id, portfolio.id);
  } catch (error) {
    console.error('Skills derivation failed', error);
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
      CareerRepository.replaceSkills(
        tx,
        user.id,
        portfolio.id,
        derived.map((skill, index) => ({
          name: skill.name,
          category: skill.category,
          level: skill.level,
          ai_derived: true,
          proof: skill.proof,
        })),
      ),
    );
  } catch (error) {
    console.error('Failed to save derived skills', error);
    return data({ success: false, error: 'Failed to save skills. Try again.' }, { status: 500 });
  }

  return data({ success: true, skills: derived });
}

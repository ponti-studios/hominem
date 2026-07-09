import type { Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppSkills } from '../../types/database';
import { verifyPortfolioOwnership } from './ownership';

type SkillRow = Selectable<AppSkills>;

export interface SkillRecord {
  id: string;
  portfolioId: string;
  name: string;
  description: string | null;
  category: string | null;
  level: number;
  yearsOfExperience: number | null;
  icon: string | null;
  proof: string | null;
  aiDerived: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdat: string;
  updatedat: string;
}

export interface ReplaceSkillInput {
  id?: string;
  name: string;
  category?: string | null;
  level: number;
  aiDerived?: boolean;
  proof?: string | null;
}

function toSkillRecord(row: SkillRow): SkillRecord {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    name: row.name,
    description: row.description,
    category: row.category,
    level: row.level,
    yearsOfExperience: row.yearsOfExperience,
    icon: row.icon,
    proof: row.proof,
    aiDerived: row.aiDerived,
    isVisible: row.isVisible,
    sortOrder: row.sortOrder,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
  };
}

export const SkillRepository = {
  /** Ordered for full-portfolio composition — see PortfolioRepository.loadFullPortfolio. */
  async listByPortfolioId(handle: DbHandle, portfolioId: string): Promise<SkillRecord[]> {
    const rows = await handle
      .selectFrom('app.skills')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .orderBy('sortOrder', 'asc')
      .execute();

    return (rows as SkillRow[]).map(toSkillRecord);
  },

  async replaceSkills(
    handle: DbHandle,
    ownerUserid: string,
    portfolioId: string,
    skills: ReplaceSkillInput[],
  ): Promise<void> {
    await verifyPortfolioOwnership(handle, ownerUserid, portfolioId);

    const current = await handle
      .selectFrom('app.skills')
      .select(['id'])
      .where('portfolioId', '=', portfolioId)
      .execute();

    const currentIds = current.map((item) => item.id);
    const submittedIds = skills.flatMap((item) => (item.id ? [item.id] : []));
    const toDelete = currentIds.filter((id) => !submittedIds.includes(id));

    if (toDelete.length > 0) {
      await handle
        .deleteFrom('app.skills')
        .where('portfolioId', '=', portfolioId)
        .where('id', 'in', toDelete)
        .execute();
    }

    for (const [index, skill] of skills.entries()) {
      if (skill.id) {
        await handle
          .updateTable('app.skills')
          .set({
            name: skill.name,
            category: skill.category ?? null,
            level: skill.level,
            sortOrder: index,
            ...(skill.proof !== undefined && { proof: skill.proof }),
          })
          .where('id', '=', skill.id)
          .where('portfolioId', '=', portfolioId)
          .execute();
      } else {
        await handle
          .insertInto('app.skills')
          .values({
            portfolioId: portfolioId,
            name: skill.name,
            category: skill.category ?? null,
            level: skill.level,
            sortOrder: index,
            aiDerived: skill.aiDerived ?? false,
            proof: skill.proof ?? null,
          })
          .execute();
      }
    }
  },
};

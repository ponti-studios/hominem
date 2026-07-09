import type { Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppCareerEvents, JsonValue } from '../../types/database';

type CareerEventRow = Selectable<AppCareerEvents>;

export interface CareerEventRecord {
  id: string;
  ownerUserid: string;
  workExperienceId: string | null;
  eventType: string;
  eventDate: string;
  description: string | null;
  previousTitle: string | null;
  newTitle: string | null;
  previousLevel: string | null;
  newLevel: string | null;
  previousSalary: number | null;
  newSalary: number | null;
  salaryIncrease: number | null;
  increasePercentage: string | null;
  previousTotalComp: number | null;
  newTotalComp: number | null;
  totalCompIncrease: number | null;
  bonusAmount: number | null;
  bonusType: string | null;
  equityGranted: number | null;
  equityVesting: string | null;
  performanceRating: string | null;
  managerFeedback: string | null;
  selfAssessment: string | null;
  achievements: JsonValue;
  skillsGained: JsonValue;
  careerGoals: JsonValue;
  marketSalaryRange: JsonValue;
  createdat: string;
  updatedat: string;
}

function toCareerEventRecord(row: CareerEventRow): CareerEventRecord {
  return {
    id: row.id,
    ownerUserid: row.ownerUserid,
    workExperienceId: row.workExperienceId,
    eventType: row.eventType,
    eventDate: String(row.eventDate),
    description: row.description,
    previousTitle: row.previousTitle,
    newTitle: row.newTitle,
    previousLevel: row.previousLevel,
    newLevel: row.newLevel,
    previousSalary: row.previousSalary,
    newSalary: row.newSalary,
    salaryIncrease: row.salaryIncrease,
    increasePercentage: row.increasePercentage,
    previousTotalComp: row.previousTotalComp,
    newTotalComp: row.newTotalComp,
    totalCompIncrease: row.totalCompIncrease,
    bonusAmount: row.bonusAmount,
    bonusType: row.bonusType,
    equityGranted: row.equityGranted,
    equityVesting: row.equityVesting,
    performanceRating: row.performanceRating,
    managerFeedback: row.managerFeedback,
    selfAssessment: row.selfAssessment,
    achievements: row.achievements,
    skillsGained: row.skillsGained,
    careerGoals: row.careerGoals,
    marketSalaryRange: row.marketSalaryRange,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
  };
}

export const CareerEventRepository = {
  async listUserCareerEvents(
    handle: DbHandle,
    ownerUserid: string,
    limit?: number,
  ): Promise<CareerEventRecord[]> {
    let query = handle
      .selectFrom('app.careerEvents')
      .selectAll()
      .where('ownerUserid', '=', ownerUserid)
      .orderBy('eventDate', 'desc');

    if (limit) {
      query = query.limit(limit);
    }

    const rows = await query.execute();
    return (rows as CareerEventRow[]).map(toCareerEventRecord);
  },
};

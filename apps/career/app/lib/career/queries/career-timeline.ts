import type { PortfolioTimeline } from '@hominem/db';
import { db, PortfolioRepository } from '@hominem/db';

export type { TimelineEntryRecord as TimelineEntry } from '@hominem/db';

export type CareerStoryTimeline = PortfolioTimeline;

export async function getCareerStoryTimeline(ownerUserid: string): Promise<CareerStoryTimeline> {
  return PortfolioRepository.getTimeline(db, ownerUserid);
}

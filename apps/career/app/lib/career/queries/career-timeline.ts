import { db, PortfolioRepository } from '@hominem/db';
import type { PortfolioTimeline } from '@hominem/db';

export type {
  ChapterWithEntries,
  TimelineEntryKind,
  TimelineEntryRecord as TimelineEntry,
} from '@hominem/db';

export type CareerStoryTimeline = PortfolioTimeline;

export async function getCareerStoryTimeline(ownerUserid: string): Promise<CareerStoryTimeline> {
  const timeline = await PortfolioRepository.getTimeline(db, ownerUserid);
  return timeline ?? { chapters: [], unattributedEntries: [] };
}

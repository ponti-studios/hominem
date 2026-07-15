import type { WorkExperienceRecord } from '@hominem/db';
import {
  CareerEventRepository,
  db,
  JobApplicationRepository,
  JobApplicationStatusHistoryRepository,
  PortfolioRepository,
  ProjectRepository,
  SkillRepository,
  TestimonialRepository,
  WorkExperienceRepository,
} from '@hominem/db';

export type TimelineEntryKind =
  | 'career_event'
  | 'project'
  | 'skill'
  | 'testimonial'
  | 'status_change';

export interface TimelineEntry {
  id: string;
  date: string;
  kind: TimelineEntryKind;
  title: string;
  subtitle?: string;
  statusPill?: string;
  workExperienceId: string | null;
}

export interface ChapterWithEntries {
  workExperience: WorkExperienceRecord;
  entries: TimelineEntry[];
}

export interface CareerStoryTimeline {
  chapters: ChapterWithEntries[];
  unattributedEntries: TimelineEntry[];
}

const STATUS_PILL_STATUSES = new Set(['OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']);

const PROJECT_STATUS_VERB: Record<string, string> = {
  completed: 'Shipped',
  'in-progress': 'Started',
  archived: 'Archived',
};

function byDateDesc(left: { date: string }, right: { date: string }): number {
  return new Date(right.date).getTime() - new Date(left.date).getTime();
}

/**
 * A chapter's active range for attribution purposes: from its start date
 * through its end date, or through now for an ongoing chapter.
 */
function isWithinChapterRange(date: string, chapter: WorkExperienceRecord): boolean {
  if (!chapter.startDate) return false;
  const time = new Date(date).getTime();
  const start = new Date(chapter.startDate).getTime();
  const end = chapter.endDate ? new Date(chapter.endDate).getTime() : Date.now();
  return time >= start && time <= end;
}

/** Attributes a dateless-FK entry to a chapter by range containment, most-recently-started wins ties. */
function attributeByDateRange(date: string, chapters: WorkExperienceRecord[]): string | null {
  const matches = chapters.filter((chapter) => isWithinChapterRange(date, chapter));
  if (matches.length === 0) return null;

  return matches.reduce((mostRecent, candidate) => {
    const mostRecentStart = mostRecent.startDate ? new Date(mostRecent.startDate).getTime() : 0;
    const candidateStart = candidate.startDate ? new Date(candidate.startDate).getTime() : 0;
    return candidateStart > mostRecentStart ? candidate : mostRecent;
  }).id;
}

export async function getCareerStoryTimeline(ownerUserid: string): Promise<CareerStoryTimeline> {
  const portfolio = await PortfolioRepository.getPortfolioByUserId(db, ownerUserid);
  if (!portfolio) {
    return { chapters: [], unattributedEntries: [] };
  }

  const [workExperiences, projects, testimonials, careerEvents, applications] = await Promise.all([
    WorkExperienceRepository.listByPortfolioId(db, portfolio.id),
    SkillRepository.listByPortfolioId(db, portfolio.id),
    ProjectRepository.listByPortfolioId(db, portfolio.id),
    TestimonialRepository.listByPortfolioId(db, portfolio.id),
    CareerEventRepository.listUserCareerEvents(db, ownerUserid),
    JobApplicationRepository.listUserJobApplicationsWithCompany(db, ownerUserid),
  ]);

  const statusHistory = await JobApplicationStatusHistoryRepository.listForApplications(
    db,
    applications.map((application) => application.id),
  );
  const applicationsById = new Map(
    applications.map((application) => [application.id, application]),
  );

  const chaptersByExperienceId = new Map<string, ChapterWithEntries>();
  for (const workExperience of workExperiences) {
    chaptersByExperienceId.set(workExperience.id, { workExperience, entries: [] });
  }

  const unattributedEntries: TimelineEntry[] = [];

  function assign(entry: TimelineEntry) {
    const chapter = entry.workExperienceId
      ? chaptersByExperienceId.get(entry.workExperienceId)
      : undefined;
    if (chapter) {
      chapter.entries.push(entry);
    } else {
      unattributedEntries.push(entry);
    }
  }

  for (const event of careerEvents) {
    assign({
      id: `career_event:${event.id}`,
      date: event.eventDate,
      kind: 'career_event',
      title: event.eventType.replace(/_/g, ' '),
      subtitle: event.description ?? undefined,
      workExperienceId: event.workExperienceId,
    });
  }

  for (const project of projects) {
    const date = project.endDate ?? project.startDate ?? project.createdat;
    const verb = PROJECT_STATUS_VERB[project.status] ?? 'Updated';
    assign({
      id: `project:${project.id}`,
      date,
      kind: 'project',
      title: `${verb} "${project.title}"`,
      subtitle: project.shortDescription ?? undefined,
      workExperienceId: project.workExperienceId,
    });
  }

  for (const testimonial of testimonials) {
    assign({
      id: `testimonial:${testimonial.id}`,
      date: testimonial.createdat,
      kind: 'testimonial',
      title: `Feedback from ${testimonial.name}`,
      subtitle: testimonial.content,
      workExperienceId: attributeByDateRange(testimonial.createdat, workExperiences),
    });
  }

  // Job applications have no work_experience_id and no reliable company-match
  // signal to a chapter (an interview isn't necessarily at the chapter's
  // employer), so status-change entries always land in unattributedEntries.
  for (const historyRow of statusHistory) {
    const application = applicationsById.get(historyRow.applicationId);
    if (!application) continue;

    unattributedEntries.push({
      id: `status:${historyRow.id}`,
      date: historyRow.changedAt,
      kind: 'status_change',
      title: `${application.position} — status changed to ${historyRow.newStatus.replace(/_/g, ' ')}`,
      subtitle: application.company?.name ?? undefined,
      statusPill: STATUS_PILL_STATUSES.has(historyRow.newStatus) ? historyRow.newStatus : undefined,
      workExperienceId: null,
    });
  }

  const chapters = [...chaptersByExperienceId.values()]
    .sort((left, right) => {
      const leftStart = left.workExperience.startDate
        ? new Date(left.workExperience.startDate).getTime()
        : 0;
      const rightStart = right.workExperience.startDate
        ? new Date(right.workExperience.startDate).getTime()
        : 0;
      return rightStart - leftStart;
    })
    .map((chapter) => ({
      ...chapter,
      entries: [...chapter.entries].sort(byDateDesc),
    }));

  return {
    chapters,
    unattributedEntries: unattributedEntries.sort(byDateDesc),
  };
}

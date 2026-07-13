import type { CareerStoryTimeline } from '~/lib/career/queries/career-timeline';

import { ChapterMarker } from './ChapterMarker';
import { TimelineEntryCard } from './TimelineEntryCard';

export function TimelineSpine({ timeline }: { timeline: CareerStoryTimeline }) {
  const { chapters, unattributedEntries } = timeline;
  const isEmpty = chapters.length === 0 && unattributedEntries.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center">
        <p className="body-2 text-muted-foreground">
          Your story starts as soon as you add a role, a project, or a skill.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-2 bottom-2 left-[5px] w-px bg-border" />

      {chapters.map((chapter) => (
        <div key={chapter.workExperience.id}>
          <ChapterMarker workExperience={chapter.workExperience} />
          {chapter.entries.map((entry) => (
            <TimelineEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      ))}

      {unattributedEntries.length > 0 && (
        <div>
          <div className="relative pb-4 pl-7">
            <p className="ui-eyebrow text-muted-foreground">Other moments</p>
          </div>
          {unattributedEntries.map((entry) => (
            <TimelineEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <div className="relative pl-7">
        <div className="absolute top-0.5 left-0 h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/50 bg-background" />
        <p className="footnote text-muted-foreground">
          That's the beginning of what's logged. Your career started well before this — add it
          whenever you're ready.
        </p>
      </div>
    </div>
  );
}

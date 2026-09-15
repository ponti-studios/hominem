import { AnimatePresence, m } from 'motion/react';

import { Badge } from '~/components/ui/badge';
import type { TaskFormDraft } from '~/hooks/use-task-form-draft';
import { taskPriorityVariant } from '~/lib/task-badges';

export function TaskPreviewCard({
  draft,
  completed = false,
  childCount,
  spacious = false,
}: {
  draft: TaskFormDraft;
  completed?: boolean;
  childCount?: number;
  spacious?: boolean;
}) {
  const when = draft.scheduledStartAt
    ? new Date(draft.scheduledStartAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      })
    : draft.dueAt
      ? `Due ${new Date(draft.dueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
      : null;
  return (
    <div
      className={`rounded-xl border border-border/70 bg-background/60 ${spacious ? 'p-4' : 'px-3 py-2.5'}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`min-w-0 truncate font-medium ${completed ? 'text-muted-foreground line-through' : ''}`}
        >
          {draft.title || 'Untitled task'}
        </span>
        <AnimatePresence mode="wait">
          <m.span
            animate={{ opacity: 1 }}
            className="shrink-0"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={draft.priority}
            transition={{ duration: 0.15 }}
          >
            <Badge variant={taskPriorityVariant[draft.priority]}>{draft.priority}</Badge>
          </m.span>
        </AnimatePresence>
        {childCount ? <Badge variant="outline">{childCount} sub-tasks</Badge> : null}
        {when ? (
          <AnimatePresence mode="wait">
            <m.span
              animate={{ opacity: 1 }}
              className="ml-auto shrink-0 text-xs text-muted-foreground"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={when}
              transition={{ duration: 0.15 }}
            >
              {when}
            </m.span>
          </AnimatePresence>
        ) : null}
      </div>
      {draft.description ? (
        <p className="mt-1 truncate text-sm text-muted-foreground">{draft.description}</p>
      ) : null}
      {draft.location ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{draft.location}</p>
      ) : null}
    </div>
  );
}

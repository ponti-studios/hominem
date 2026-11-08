import { Inbox, Plus, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

import { Container } from '~/components/design/container';
import { List, RowLink } from '~/components/design/lists';
import { PageHeader } from '~/components/design/page-header';
import { ListSkeleton } from '~/components/design/skeleton';
import { PanelState, SectionCard, SegmentedControl } from '~/components/design/surfaces';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { useTasksList } from '~/hooks/use-tasks';
import { formatTaskDate, taskPriorityVariant } from '~/lib/task-badges';

import { CreateTaskDialog } from './create-task-dialog';

type StatusFilter = 'all' | 'pending' | 'completed';

const FILTER_OPTIONS = [
  { value: 'pending', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
] as const;

export function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const { data, error, isPending, refetch } = useTasksList();
  const tasks = data?.tasks ?? [];
  const openCount = tasks.filter((task) => task.status === 'pending').length;
  const filteredTasks =
    statusFilter === 'all' ? tasks : tasks.filter((task) => task.status === statusFilter);

  function handleRetry() {
    // eslint-disable-next-line no-void -- fire-and-forget refetch, result intentionally unused
    void refetch();
  }

  return (
    <main className="h-full overflow-auto">
      <Container size="sm">
        <PageHeader
          actions={<CreateTaskDialog trigger={<NewTaskButton />} />}
          description={
            openCount === 0
              ? 'A clean slate. Enjoy the quiet.'
              : `${openCount} open ${openCount === 1 ? 'thing' : 'things'} on your plate.`
          }
          eyebrow="Tasks"
          title="What needs doing"
        />

        <div className="mb-4 flex items-center justify-between gap-3">
          <SegmentedControl
            ariaLabel="Filter tasks by status"
            onChange={setStatusFilter}
            options={FILTER_OPTIONS}
            value={statusFilter}
          />
          <p className="hidden font-mono text-[11px] tracking-[0.12em] text-[#5e6678] uppercase sm:block">
            {filteredTasks.length} shown
          </p>
        </div>

        <SectionCard>
          {isPending ? <ListSkeleton rows={4} /> : null}
          {error ? (
            <PanelState
              action={
                <Button onClick={handleRetry} variant="secondary">
                  Try again
                </Button>
              }
              description="We couldn't reach your list. Check your connection and retry."
              icon={<TriangleAlert />}
              title="Tasks unavailable"
            />
          ) : null}
          {!isPending && !error && filteredTasks.length === 0 ? (
            <PanelState
              action={<CreateTaskDialog />}
              description={
                statusFilter === 'completed'
                  ? 'Nothing finished yet — open tasks are waiting above.'
                  : 'Capture the first thing on your mind. It takes two seconds.'
              }
              icon={<Inbox />}
              title={statusFilter === 'completed' ? 'No completed tasks yet' : 'Nothing here yet'}
            />
          ) : null}
          {!isPending && !error && filteredTasks.length > 0 ? (
            <List ariaLabel="Tasks">
              {filteredTasks.map((task, i) => (
                <motion.li
                  key={task.id}
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 10 }}
                  transition={{
                    delay: Math.min(i * 0.03, 0.3),
                    type: 'spring',
                    stiffness: 380,
                    damping: 32,
                  }}
                >
                  <RowLink
                    to={`/tasks/${task.id}`}
                    title={
                      <span
                        className={
                          task.status === 'completed'
                            ? 'truncate text-[#5e6678] line-through'
                            : 'truncate'
                        }
                      >
                        {task.title}
                      </span>
                    }
                    subtitle={task.description ?? undefined}
                    badges={
                      <>
                        {task.priority ? (
                          <Badge variant={taskPriorityVariant[task.priority] ?? 'outline'}>
                            {task.priority}
                          </Badge>
                        ) : null}
                        {task.childCount > 0 ? (
                          <Badge variant="outline">{task.childCount} sub-tasks</Badge>
                        ) : null}
                      </>
                    }
                    meta={
                      <>
                        {task.dueAt ? <span>Due {formatTaskDate(task.dueAt)}</span> : null}
                        {task.scheduledStartAt ? (
                          <span>{formatTaskDate(task.scheduledStartAt)}</span>
                        ) : null}
                      </>
                    }
                  />
                </motion.li>
              ))}
            </List>
          ) : null}
        </SectionCard>
      </Container>
    </main>
  );
}

function NewTaskButton() {
  return (
    <span
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#d7ff3e] px-4 text-sm font-semibold text-[#101300] transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
      style={{ boxShadow: '0 8px 32px -8px rgb(215 255 62 / 0.55)' }}
    >
      <Plus aria-hidden className="size-4" />
      New task
    </span>
  );
}

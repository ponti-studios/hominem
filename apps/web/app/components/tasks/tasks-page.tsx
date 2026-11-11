import { Inbox, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

import {
  AddButton,
  Container,
  FilterTabs,
  List,
  ListSkeleton,
  PageHeader,
  PanelState,
  RowLink,
  SectionCard,
} from '~/components/design';
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
          actions={<CreateTaskDialog trigger={<AddButton label="New task" />} />}
          eyebrow="Tasks"
          title={<span className="sr-only">Tasks</span>}
        />

        <div className="mb-4 flex justify-center">
          <FilterTabs
            ariaLabel="Filter tasks by status"
            onChange={setStatusFilter}
            options={FILTER_OPTIONS}
            value={statusFilter}
          />
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
            <List.Items ariaLabel="Tasks">
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
                            ? 'truncate text-muted-foreground line-through'
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
            </List.Items>
          ) : null}
        </SectionCard>
      </Container>
    </main>
  );
}

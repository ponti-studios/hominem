import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { useTasksList } from '~/hooks/use-tasks';

import { CreateTaskDialog } from './create-task-dialog';

type StatusFilter = 'all' | 'pending' | 'completed';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
});

const priorityVariant: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <Button aria-label="Back to chat" asChild size="icon-sm" variant="ghost">
          <Link to="/" viewTransition>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Things to do, scheduled or not.</p>
        </div>
        <CreateTaskDialog />
      </div>

      <div className="mb-4 flex gap-1">
        {(['pending', 'completed', 'all'] as const).map((filter) => (
          <Button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            size="sm"
            variant={statusFilter === filter ? 'default' : 'ghost'}
          >
            {filter === 'pending' ? 'Open' : filter === 'completed' ? 'Completed' : 'All'}
          </Button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {isPending ? <p className="p-5 text-sm text-muted-foreground">Loading tasks…</p> : null}
        {error ? (
          <div className="space-y-3 p-5">
            <p className="text-sm text-destructive">Tasks unavailable.</p>
            <Button onClick={handleRetry} variant="secondary">
              Try again
            </Button>
          </div>
        ) : null}
        {!isPending && !error && filteredTasks.length === 0 ? (
          <div className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'completed' ? 'No completed tasks yet.' : 'No tasks here.'}
            </p>
            <CreateTaskDialog />
          </div>
        ) : null}
        {!isPending && !error && filteredTasks.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredTasks.map((task) => (
              <Link
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted"
                key={task.id}
                to={`/tasks/${task.id}`}
                viewTransition
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        task.status === 'completed'
                          ? 'truncate font-medium text-muted-foreground line-through'
                          : 'truncate font-medium'
                      }
                    >
                      {task.title}
                    </span>
                    {task.priority ? (
                      <Badge variant={priorityVariant[task.priority] ?? 'outline'}>
                        {task.priority}
                      </Badge>
                    ) : null}
                    {task.childCount > 0 ? (
                      <Badge variant="outline">{task.childCount} sub-tasks</Badge>
                    ) : null}
                  </div>
                  {task.description ? (
                    <p className="truncate text-sm text-muted-foreground">{task.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
                  {task.dueAt ? (
                    <span>Due {dateFormatter.format(new Date(task.dueAt))}</span>
                  ) : null}
                  {task.scheduledStartAt ? (
                    <span>{dateFormatter.format(new Date(task.scheduledStartAt))}</span>
                  ) : null}
                  <ChevronRight className="size-4" />
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

import { Check, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { useCompleteTask, useDeleteTask, useTaskDetail, useUpdateTask } from '~/hooks/use-tasks';
import { taskPriorityVariant } from '~/lib/task-badges';

import { TaskForm } from './task-form';

export function TaskDetailPage({ taskId }: { taskId: string }) {
  const navigate = useNavigate();
  const { data, error, isPending, refetch } = useTaskDetail(taskId);
  const updateTask = useUpdateTask(taskId);
  const completeTask = useCompleteTask(taskId);
  const deleteTask = useDeleteTask(taskId);

  const task = data?.task;
  const children = data?.children ?? [];

  if (!task) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {isPending ? <p className="text-sm text-muted-foreground">Loading task…</p> : null}
        {error ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-destructive">Task unavailable.</p>
            <Button
              onClick={() => {
                // eslint-disable-next-line no-void -- fire-and-forget refetch, result intentionally unused
                void refetch();
              }}
              variant="secondary"
            >
              Try again
            </Button>
          </div>
        ) : null}
        {!isPending && !error ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              This task doesn't exist, or you don't have access to it.
            </p>
          </div>
        ) : null}
      </main>
    );
  }

  const isCompleted = task.status === 'completed';

  function goToTasksList() {
    // eslint-disable-next-line no-void -- fire-and-forget navigation, result intentionally unused
    void navigate('/tasks', { viewTransition: true });
  }

  function handleToggleComplete() {
    completeTask.mutate(!isCompleted);
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${task?.title}"? This can't be undone.`)) return;
    deleteTask.mutate(undefined, { onSuccess: goToTasksList });
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{task.title}</h1>
          {isCompleted ? (
            <p className="text-sm text-muted-foreground">Completed</p>
          ) : task.priority ? (
            <Badge variant={taskPriorityVariant[task.priority] ?? 'outline'}>{task.priority}</Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            disabled={completeTask.isPending}
            onClick={handleToggleComplete}
            size="sm"
            variant={isCompleted ? 'outline' : 'default'}
          >
            {isCompleted ? (
              <>
                <RotateCcw className="size-4" /> Reopen
              </>
            ) : (
              <>
                <Check className="size-4" /> Complete
              </>
            )}
          </Button>
          <Button
            aria-label="Delete task"
            disabled={deleteTask.isPending}
            onClick={handleDelete}
            size="icon-sm"
            variant="ghost"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <TaskForm
          hideSubmitUntilDirty
          initialTask={task}
          key={task.id}
          mode="edit"
          onSubmit={(input) => updateTask.mutate(input)}
          pending={updateTask.isPending}
          serverError={updateTask.isError ? 'Could not save changes.' : null}
          submitLabel="Save changes"
          variant="spacious"
        />
      </div>

      {task.artifactType === 'task_list' ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">
              Sub-tasks · {children.length} item{children.length === 1 ? '' : 's'}
            </h2>
          </div>
          {children.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No sub-tasks yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {children.map((child) => (
                <Link
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted"
                  key={child.id}
                  to={`/tasks/${child.id}`}
                  viewTransition
                >
                  <span
                    className={
                      child.status === 'completed'
                        ? 'truncate text-sm text-muted-foreground line-through'
                        : 'truncate text-sm'
                    }
                  >
                    {child.title}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

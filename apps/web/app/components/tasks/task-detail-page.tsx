import { ArrowLeft, Check, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { useCompleteTask, useDeleteTask, useTaskDetail, useUpdateTask } from '~/hooks/use-tasks';

type Priority = 'low' | 'medium' | 'high';

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'medium' || value === 'high';
}

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in local time, with no
// timezone suffix; the API wants a full ISO-8601 string with an offset.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function TaskDetailPage({ taskId }: { taskId: string }) {
  const navigate = useNavigate();
  const { data, error, isPending, refetch } = useTaskDetail(taskId);
  const updateTask = useUpdateTask(taskId);
  const completeTask = useCompleteTask(taskId);
  const deleteTask = useDeleteTask(taskId);

  const task = data?.task;
  const children = data?.children ?? [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueAt, setDueAt] = useState('');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [location, setLocation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPriority(isPriority(task.priority) ? task.priority : 'medium');
    setDueAt(toLocalInputValue(task.dueAt));
    setScheduledStartAt(toLocalInputValue(task.scheduledStartAt));
    setScheduledEndAt(toLocalInputValue(task.scheduledEndAt));
    setDurationMinutes(task.durationMinutes ? String(task.durationMinutes) : '');
    setLocation(task.location ?? '');
  }, [task]);

  if (!task) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <BackLink />
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

  const trimmedTitle = title.trim();
  const isCompleted = task.status === 'completed';

  const isDirty =
    trimmedTitle !== task.title ||
    description.trim() !== (task.description ?? '') ||
    priority !== task.priority ||
    dueAt !== toLocalInputValue(task.dueAt) ||
    scheduledStartAt !== toLocalInputValue(task.scheduledStartAt) ||
    scheduledEndAt !== toLocalInputValue(task.scheduledEndAt) ||
    durationMinutes !== (task.durationMinutes ? String(task.durationMinutes) : '') ||
    location.trim() !== (task.location ?? '');

  function goToTasksList() {
    // eslint-disable-next-line no-void -- fire-and-forget navigation, result intentionally unused
    void navigate('/tasks', { viewTransition: true });
  }

  function handleSave() {
    setFormError(null);
    if (!trimmedTitle) {
      setFormError('Title is required.');
      return;
    }

    const nextStart = fromLocalInputValue(scheduledStartAt);
    const nextEnd = fromLocalInputValue(scheduledEndAt);
    if ((nextStart === null) !== (nextEnd === null)) {
      setFormError('Set both a start and an end time, or neither.');
      return;
    }
    if (nextStart && nextEnd && new Date(nextEnd) <= new Date(nextStart)) {
      setFormError('End time must be after the start time.');
      return;
    }

    const duration = durationMinutes.trim() ? Number(durationMinutes) : null;
    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
      setFormError('Duration must be a whole number of minutes.');
      return;
    }

    updateTask.mutate({
      title: trimmedTitle,
      description: description.trim() || null,
      priority,
      dueAt: fromLocalInputValue(dueAt),
      scheduledStartAt: nextStart,
      scheduledEndAt: nextEnd,
      durationMinutes: duration,
      location: location.trim() || null,
    });
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
        <BackLink />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{task.title}</h1>
          {isCompleted ? (
            <p className="text-sm text-muted-foreground">Completed</p>
          ) : task.priority ? (
            <Badge variant="secondary">{task.priority}</Badge>
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

      <div className="space-y-6 rounded-xl border border-border bg-card p-5">
        <label className="block space-y-2 text-xs">
          <span className="text-muted-foreground">Title</span>
          <Input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>

        <label className="block space-y-2 text-xs">
          <span className="text-muted-foreground">Description</span>
          <Textarea
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            value={description}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-2 text-xs">
            <span className="text-muted-foreground">Priority</span>
            <Select
              onValueChange={(value) => {
                if (isPriority(value)) setPriority(value);
              }}
              value={priority}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-xs">
            <span className="text-muted-foreground">Due</span>
            <Input
              onChange={(event) => setDueAt(event.target.value)}
              type="datetime-local"
              value={dueAt}
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">When (optional schedule)</span>
          <div className="grid grid-cols-2 gap-4">
            <Input
              aria-label="Scheduled start"
              onChange={(event) => setScheduledStartAt(event.target.value)}
              type="datetime-local"
              value={scheduledStartAt}
            />
            <Input
              aria-label="Scheduled end"
              onChange={(event) => setScheduledEndAt(event.target.value)}
              type="datetime-local"
              value={scheduledEndAt}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-2 text-xs">
            <span className="text-muted-foreground">Duration (minutes)</span>
            <Input
              inputMode="numeric"
              onChange={(event) => setDurationMinutes(event.target.value)}
              type="number"
              value={durationMinutes}
            />
          </label>
          <label className="block space-y-2 text-xs">
            <span className="text-muted-foreground">Location</span>
            <Input onChange={(event) => setLocation(event.target.value)} value={location} />
          </label>
        </div>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        {updateTask.isError ? (
          <p className="text-sm text-destructive">Could not save changes.</p>
        ) : null}

        {isDirty ? (
          <div className="flex justify-end">
            <Button disabled={updateTask.isPending} onClick={handleSave}>
              {updateTask.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        ) : null}
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

function BackLink() {
  return (
    <Button aria-label="Back to tasks" asChild size="icon-sm" variant="ghost">
      <Link to="/tasks" viewTransition>
        <ArrowLeft />
      </Link>
    </Button>
  );
}

import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';

import { BackLink, DetailHero, DetailSection, SectionHeader } from '~/components/design';
import { BlockSkeleton, PanelState, SectionCard } from '~/components/design';
import { Container } from '~/components/design/container';
import { List, RowLink } from '~/components/design/lists';
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
      <main className="h-full overflow-auto">
        <Container size="xs">
          <BackLink to="/tasks" label="Tasks" variant="icon" />
          {isPending ? (
            <div className="flex flex-col gap-2">
              <BlockSkeleton className="h-12" label="Loading task" />
              <BlockSkeleton className="h-12" label="Loading task" />
              <BlockSkeleton className="h-12" label="Loading task" />
            </div>
          ) : null}
          {error ? (
            <PanelState
              title="Task unavailable"
              action={
                <Button
                  onClick={() => {
                    // eslint-disable-next-line no-void -- fire-and-forget refetch, result intentionally unused
                    void refetch();
                  }}
                  variant="secondary"
                >
                  Try again
                </Button>
              }
            />
          ) : null}
          {!isPending && !error ? (
            <PanelState
              title="Not found"
              description="This task doesn't exist, or you don't have access to it."
            />
          ) : null}
        </Container>
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
    <main className="h-full overflow-auto">
      <Container size="xs">
        <div className="mb-6 flex items-center gap-3">
          <BackLink to="/tasks" label="Back to tasks" variant="icon" />
          <div className="min-w-0 flex-1">
            <DetailHero
              title={task.title}
              badges={
                isCompleted ? (
                  <span className="text-sm text-[#9ba3b4]">Completed</span>
                ) : task.priority ? (
                  <Badge variant={taskPriorityVariant[task.priority] ?? 'outline'}>
                    {task.priority}
                  </Badge>
                ) : undefined
              }
              actions={
                <>
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
                    <Trash2 className="size-4 text-[#ff9d9d]" />
                  </Button>
                </>
              }
            />
          </div>
        </div>

        <DetailSection title="Task">
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
        </DetailSection>

        {task.artifactType === 'task_list' ? (
          <SectionCard>
            <SectionHeader
              title={`Sub-tasks · ${children.length} item${children.length === 1 ? '' : 's'}`}
            />
            <div className="mt-3">
              {children.length === 0 ? (
                <PanelState title="No sub-tasks yet" />
              ) : (
                <List ariaLabel="Sub-tasks">
                  {children.map((child) => (
                    <li key={child.id}>
                      <RowLink
                        to={`/tasks/${child.id}`}
                        title={
                          <span
                            className={
                              child.status === 'completed'
                                ? 'truncate text-sm text-[#5e6678] line-through'
                                : 'truncate text-sm'
                            }
                          >
                            {child.title}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </List>
              )}
            </div>
          </SectionCard>
        ) : null}
      </Container>
    </main>
  );
}

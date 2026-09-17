import type { Task, TaskDetailOutput, TaskListItem } from './task-types';

export function mapTaskList(
  tasks: TaskListItem[] | undefined,
  taskId: string,
  update: (task: TaskListItem) => TaskListItem,
): TaskListItem[] | undefined {
  return tasks?.map((task) => (task.id === taskId ? update(task) : task));
}

export function mapTaskDetail(
  detail: TaskDetailOutput | undefined,
  taskId: string,
  update: (task: Task) => Task,
): TaskDetailOutput | undefined {
  if (!detail || detail.task.id !== taskId) {
    return detail;
  }
  return { ...detail, task: update(detail.task) };
}

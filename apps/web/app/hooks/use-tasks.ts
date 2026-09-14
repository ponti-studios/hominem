import { useApiClient } from '@hominem/rpc/react';
import type { TasksCreateInput, TasksUpdateInput } from '@hominem/rpc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const tasksKey = ['tasks'] as const;
const taskDetailKey = (id: string) => [...tasksKey, id] as const;

// The API returns `{ error, code, message }` JSON on failure — but without
// an ok-check that error body would be parsed as success data and cached
// as if it were tasks. Throw instead so react-query surfaces it via the
// `error` state, preferring the server's message when it has one.
async function throwIfFailed(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  let message: string;
  try {
    const body = (await response.json()) as { message?: unknown };
    message = typeof body.message === 'string' && body.message.length > 0 ? body.message : fallback;
  } catch {
    message = `${fallback} (status ${response.status})`;
  }
  throw new Error(message);
}

export function useTasksList() {
  const client = useApiClient();

  return useQuery({
    queryKey: tasksKey,
    staleTime: 1000 * 15,
    queryFn: async () => {
      const response = await client.api.tasks.$get();
      await throwIfFailed(response, 'Tasks unavailable.');
      return response.json();
    },
  });
}

export function useTaskDetail(taskId: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: taskDetailKey(taskId),
    staleTime: 1000 * 15,
    queryFn: async () => {
      const response = await client.api.tasks[':id'].$get({ param: { id: taskId } });
      await throwIfFailed(response, 'Task unavailable.');
      return response.json();
    },
  });
}

export function useCreateTask() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TasksCreateInput) => {
      const response = await client.api.tasks.$post({ json: input });
      await throwIfFailed(response, 'Task creation failed.');
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

export function useUpdateTask(taskId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TasksUpdateInput) => {
      const response = await client.api.tasks[':id'].$patch({
        param: { id: taskId },
        json: input,
      });
      await throwIfFailed(response, 'Task update failed.');
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

export function useCompleteTask(taskId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (completed: boolean) => {
      const response = await client.api.tasks[':id'].complete.$patch({
        param: { id: taskId },
        json: { completed },
      });
      await throwIfFailed(response, 'Task completion failed.');
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskDetailKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

export function useDeleteTask(taskId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await client.api.tasks[':id'].$delete({ param: { id: taskId } });
      await throwIfFailed(response, 'Task deletion failed.');
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

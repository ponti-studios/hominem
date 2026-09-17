import {
  buildExtractedTasksProposal as buildSharedProposal,
  useTaskExtraction as useSharedTaskExtraction,
  type CreatedTaskRef,
  type CreateTasksInput,
  type ExtractedTask,
  type ExtractedTasksCreated,
  type ExtractedTasksOutput,
} from '@hominem/chat/react';
import type { ChatMessageItem, SessionSource } from '@hominem/chat/types';
import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { taskKeys } from '~/services/tasks/query-keys';
import { remindersGateway } from '~/services/tasks/reminders-gateway';
import t from '~/translations';

export type { ExtractedTasksCreated };

interface UseTaskExtractionInput {
  chatId: string;
  source: SessionSource;
  messages: ChatMessageItem[];
  onContentCreated?: (content: ExtractedTasksCreated) => Promise<void>;
}

async function createReminderRef(task: ExtractedTask): Promise<CreatedTaskRef> {
  const reminder = await remindersGateway.createReminder({
    title: task.title,
    notes: task.description ?? null,
  });
  return {
    id: reminder.id,
    title: reminder.title,
    type: 'task',
    ...(reminder.createdAt ? { updatedAt: reminder.createdAt } : {}),
  };
}

export function buildExtractedTasksProposal(
  previewContent: string,
  extraction: ExtractedTasksOutput,
) {
  return buildSharedProposal(previewContent, extraction, {
    noTasksFoundTitle: t.chat.actions.noTasksFoundTitle,
    noTasksFoundDescription: t.chat.actions.noTasksFoundDescription,
    tasksFoundTitle: (count: number) => t.chat.actions.tasksFoundTitle(count),
  });
}

export function useTaskExtraction({
  chatId,
  source,
  messages,
  onContentCreated,
}: UseTaskExtractionInput) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  // Normalized transcript messages for the shared hook.
  const proposalMessages = useMemo(
    () => messages.map((message) => ({ role: message.role, content: message.message })),
    [messages],
  );

  const extractTasksFromTranscript = async (input: { transcript: string }) => {
    const res = await client.api.tasks.extract.$post({ json: input });
    const json = await res.json();
    if ('error' in json) {
      throw new Error(json.error);
    }
    return json;
  };

  // EventKit has no public parent/child reminder API, so a group's tasks are
  // created as independent reminders -- the grouping only survives in this
  // response, for the review UI to display, not in Reminders itself.
  const createTasksBatch = useMutation({
    mutationKey: ['chat-task-batch', chatId],
    mutationFn: async ({ groups, tasks }: CreateTasksInput) => {
      const createdGroups = await Promise.all(
        groups.map(async (group) => ({
          parent: await createReminderRef({ title: group.title }),
          tasks: await Promise.all(group.tasks.map(createReminderRef)),
        })),
      );
      const createdTasks = await Promise.all(tasks.map(createReminderRef));
      return { groups: createdGroups, tasks: createdTasks };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  });

  return useSharedTaskExtraction({
    messages: proposalMessages,
    source,
    extractTasks: (transcript: string) => extractTasksFromTranscript({ transcript }),
    createTasks: (input: CreateTasksInput) => createTasksBatch.mutateAsync(input),
    strings: {
      noTasksFoundTitle: t.chat.actions.noTasksFoundTitle,
      noTasksFoundDescription: t.chat.actions.noTasksFoundDescription,
      tasksFoundTitle: (count: number) => t.chat.actions.tasksFoundTitle(count),
      prepareReviewErrorTitle: 'Could not prepare review',
      saveContentErrorTitle: 'Could not save content',
      errorMessage: 'Please try again.',
    },
    onErrorNotice: (title: string, message: string) => Alert.alert(title, message),
    onContentCreated,
  });
}

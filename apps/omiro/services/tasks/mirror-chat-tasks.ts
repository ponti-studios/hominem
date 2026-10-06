import type { ChatMessageToolCallRecord } from '@hominem/chat';
import type { QueryClient } from '@tanstack/react-query';

import { storage } from '~/services/storage/mmkv';

import { taskKeys } from './query-keys';
import { remindersGateway } from './reminders-gateway';
import type { TaskPriority } from './task-types';

const MIRRORED_KEY = 'mirrored-chat-task-calls';
const MAX_REMEMBERED = 500;

function readMirrored(): string[] {
  try {
    const raw = storage.getString(MIRRORED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberMirrored(toolCallId: string) {
  storage.set(MIRRORED_KEY, JSON.stringify([...readMirrored(), toolCallId].slice(-MAX_REMEMBERED)));
}

function toPriority(value: string | null): TaskPriority | undefined {
  switch (value) {
    case 'none':
    case 'high':
    case 'medium':
    case 'low':
      return value;
    default:
      return undefined;
  }
}

function stringArg(args: ChatMessageToolCallRecord['args'], key: string): string | null {
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Chat's task_create tool saves to the server, but the Tasks tab lists the
// device's Reminders, so a task made in chat never appears there. Once the
// tool call has completed, create the same task as a reminder (once per tool
// call) and refresh the list. Call this only for tool calls that completed in
// this session -- running it over a loaded transcript would resurrect every
// historical task.
export async function mirrorCompletedChatTasks(
  queryClient: QueryClient,
  toolCalls: ChatMessageToolCallRecord[] | null | undefined,
) {
  const pending = (toolCalls ?? []).filter(
    (call) =>
      call.toolName === 'task_create' &&
      call.executionStatus === 'completed' &&
      !readMirrored().includes(call.toolCallId),
  );
  if (pending.length === 0) {
    return;
  }

  try {
    const permission = await remindersGateway.getPermission();
    const granted =
      permission === 'authorized' || (await remindersGateway.requestPermission()) === 'authorized';
    if (!granted) {
      return;
    }
    for (const call of pending) {
      const title = stringArg(call.args, 'title');
      if (!title) {
        continue;
      }
      const priority = toPriority(stringArg(call.args, 'priority'));
      await remindersGateway.createReminder({
        title,
        notes: stringArg(call.args, 'description'),
        dueAt: stringArg(call.args, 'dueAt'),
        location: stringArg(call.args, 'location'),
        ...(priority ? { priority } : {}),
      });
      rememberMirrored(call.toolCallId);
    }
  } catch {
    // The task still exists on the server; a failed local mirror must not
    // break the chat.
  } finally {
    await queryClient.invalidateQueries({ queryKey: taskKeys.all });
  }
}

import type { ChatMessageToolCallRecord } from '@hominem/chat';

import { getTaskService } from './task-service-instance';

// Chat's task_create tool saves the task on the server. The Tasks tab reads
// the local database, so once such a call completes, sync to pull it in
// instead of waiting for the next foreground or reconnect.
export function syncAfterChatTasks(toolCalls: ChatMessageToolCallRecord[] | null | undefined) {
  const created = (toolCalls ?? []).some(
    (call) => call.toolName === 'task_create' && call.executionStatus === 'completed',
  );
  if (created) {
    void getTaskService().sync();
  }
}

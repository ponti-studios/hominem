// Shared task-extraction flow for chat surfaces (mobile + web).
//
// The generic lifecycle machine lives in use-chat-lifecycle.ts; this hook
// wires it to the task extract → review → batch-create flow. Everything
// platform-specific — the RPC calls, cache invalidation, user-facing copy,
// and error presentation — is injected by the caller, so this module stays
// free of transport, i18n, and native dependencies.

import type { ArtifactType, SessionSource } from './capture-types';
import type { ChatMessageSnapshot } from './generation-schemas';
import { buildArtifactProposal } from './session-artifacts';
import { useChatLifecycle, type PendingReview } from './use-chat-lifecycle';

export interface ExtractedTask {
  title: string;
  description?: string;
}

export interface ExtractedTaskGroup {
  title: string;
  tasks: ExtractedTask[];
}

export interface ExtractedTasksOutput {
  groups: ExtractedTaskGroup[];
  tasks: ExtractedTask[];
}

// A group tag on a flattened review item — undefined for a standalone task.
export interface TaskProposalItem extends ExtractedTask {
  id: string;
  groupTitle?: string;
}

export interface CreatedTaskRef {
  id: string;
  title: string;
  type: ArtifactType;
  updatedAt?: string;
}

export interface CreatedTaskGroupRef {
  parent: CreatedTaskRef;
  tasks: CreatedTaskRef[];
}

export interface CreatedTasksResult {
  groups: CreatedTaskGroupRef[];
  tasks: CreatedTaskRef[];
}

export interface CreateTasksInput {
  groups: { title: string; tasks: ExtractedTask[] }[];
  tasks: ExtractedTask[];
}

export interface ExtractedTasksCreated {
  source: { kind: 'artifact'; id: string; type: ArtifactType; title: string };
  updatedAt?: string;
}

export interface TaskExtractionStrings {
  noTasksFoundTitle: string;
  noTasksFoundDescription: string;
  tasksFoundTitle: (count: number) => string;
  prepareReviewErrorTitle: string;
  saveContentErrorTitle: string;
  errorMessage: string;
}

export interface TaskExtractionReview extends PendingReview {
  items: TaskProposalItem[];
}

export interface UseTaskExtractionInput {
  // Normalized transcript messages — map the platform's message type to
  // `{ role, content }` before passing it in.
  messages: readonly Pick<ChatMessageSnapshot, 'role' | 'content'>[];
  source: SessionSource;
  extractTasks: (transcript: string) => Promise<ExtractedTasksOutput>;
  createTasks: (input: CreateTasksInput) => Promise<CreatedTasksResult>;
  onTasksChanged?: () => void;
  strings: TaskExtractionStrings;
  onErrorNotice: (title: string, message: string, error: unknown) => void;
  onContentCreated?: (content: ExtractedTasksCreated) => Promise<void>;
}

type ProposalStrings = Pick<
  TaskExtractionStrings,
  'noTasksFoundTitle' | 'noTasksFoundDescription' | 'tasksFoundTitle'
>;

export function buildExtractedTasksProposal(
  previewContent: string,
  extraction: ExtractedTasksOutput,
  strings: ProposalStrings,
): TaskExtractionReview {
  const { groups, tasks } = extraction;
  const totalCount = groups.reduce((count, group) => count + group.tasks.length, 0) + tasks.length;

  const items: TaskProposalItem[] = [
    ...groups.flatMap((group, groupIndex) =>
      group.tasks.map((task, taskIndex) => ({
        ...task,
        id: `task-proposal-group${groupIndex}-${taskIndex}`,
        groupTitle: group.title,
      })),
    ),
    ...tasks.map((task, taskIndex) => ({
      ...task,
      id: `task-proposal-standalone-${taskIndex}`,
    })),
  ];

  const proposedTitle =
    totalCount === 0
      ? strings.noTasksFoundTitle
      : groups.length === 1 && tasks.length === 0
        ? groups[0]!.title
        : totalCount === 1
          ? (items[0]?.title ?? strings.noTasksFoundTitle)
          : strings.tasksFoundTitle(totalCount);

  const proposedChanges =
    totalCount === 0
      ? [strings.noTasksFoundDescription]
      : [
          ...groups.map((group) => `${group.title} (${group.tasks.length} tasks)`),
          ...tasks.map((task) => task.title),
        ];

  return {
    proposedType: 'task_list' as const,
    proposedTitle,
    proposedChanges,
    previewContent,
    items,
  };
}

// Reconstitute the {groups, tasks} shape the batch-create endpoint expects
// from the flat, possibly partially-rejected review items. A group left with
// fewer than 2 items after rejection is demoted to standalone tasks, since
// the server requires at least 2 tasks per group.
function regroupAcceptedItems(items: TaskProposalItem[]): CreateTasksInput {
  const groupOrder: string[] = [];
  const groupedByTitle = new Map<string, ExtractedTask[]>();
  const standalone: ExtractedTask[] = [];

  for (const { id: _id, groupTitle, ...task } of items) {
    if (groupTitle === undefined) {
      standalone.push(task);
      continue;
    }
    if (!groupedByTitle.has(groupTitle)) {
      groupOrder.push(groupTitle);
      groupedByTitle.set(groupTitle, []);
    }
    groupedByTitle.get(groupTitle)!.push(task);
  }

  const groups: { title: string; tasks: ExtractedTask[] }[] = [];
  for (const title of groupOrder) {
    const groupTasks = groupedByTitle.get(title)!;
    if (groupTasks.length < 2) {
      standalone.push(...groupTasks);
    } else {
      groups.push({ title, tasks: groupTasks });
    }
  }

  return { groups, tasks: standalone };
}

// This hook only sends task_list; other ArtifactType values remain in the
// shared lifecycle contract for other transforms.
export function useTaskExtraction({
  messages,
  source,
  extractTasks,
  createTasks,
  onTasksChanged,
  strings,
  onErrorNotice,
  onContentCreated,
}: UseTaskExtractionInput) {
  return useChatLifecycle<TaskExtractionReview>({
    messages,
    source,
    onTransform: async (type: ArtifactType): Promise<TaskExtractionReview> => {
      if (type === 'task_list') {
        const { previewContent } = buildArtifactProposal(messages, 'task_list');
        const extraction = await extractTasks(previewContent);
        return buildExtractedTasksProposal(previewContent, extraction, strings);
      }

      throw new Error(`Unsupported extraction type: ${type}`);
    },
    onAcceptReview: async (review): Promise<SessionSource> => {
      if (review.items) {
        if (review.items.length === 0) {
          throw new Error('No tasks to create');
        }

        const result = await createTasks(regroupAcceptedItems(review.items));
        onTasksChanged?.();
        // Anchor to the first group (or first standalone task if none). When
        // the extraction produced multiple top-level items, only the first
        // is linked from chat — the rest are still created, just not
        // individually reflected as a session source.
        const created = result.groups[0]?.parent ?? result.tasks[0];
        if (!created) {
          throw new Error('No tasks to create');
        }
        if (onContentCreated) {
          await onContentCreated({
            source: {
              kind: 'artifact',
              id: created.id,
              title: created.title,
              type: created.type,
            },
            ...(created.updatedAt ? { updatedAt: created.updatedAt } : {}),
          });
        }

        return {
          kind: 'artifact' as const,
          id: created.id,
          type: created.type,
          title: created.title,
        };
      }

      // This hook only produces task_list reviews with items.
      throw new Error(`Unsupported review type: ${review.proposedType}`);
    },
    onRejectReview: async () => {},
    onError: (phase, error) => {
      onErrorNotice(
        phase === 'accept' ? strings.saveContentErrorTitle : strings.prepareReviewErrorTitle,
        strings.errorMessage,
        error,
      );
    },
  });
}

import type { ArtifactType } from '@hominem/rpc/types';

export type ConversationActionType = ArtifactType;

export type ConversationActionKind = 'search' | 'toggle-debug' | 'transform' | 'archive';

export interface ConversationActionItem {
  kind: ConversationActionKind;
  label: string;
  type?: Exclude<ConversationActionType, 'tracker'>;
}

export interface ConversationActionSection {
  title: string;
  items: ConversationActionItem[];
}

export interface ConversationActionsModelInput {
  canTransform: boolean;
  isArchiving: boolean;
  showDebug: boolean;
  transformTypes: Exclude<ConversationActionType, 'tracker'>[];
}

export const TRANSFORM_LABELS: Record<Exclude<ConversationActionType, 'tracker'>, string> = {
  note: 'Transform to note',
  task: 'Transform to task',
  task_list: 'Transform to task list',
};

export function buildConversationActionsModel(
  input: ConversationActionsModelInput,
): ConversationActionSection[] {
  const sections: ConversationActionSection[] = [
    {
      title: 'Conversation',
      items: [
        { kind: 'search', label: 'Search messages' },
        {
          kind: 'toggle-debug',
          label: input.showDebug ? 'Hide debug metadata' : 'Show debug metadata',
        },
      ],
    },
  ];

  if (input.canTransform) {
    sections.push({
      title: 'Transform',
      items: input.transformTypes.map((type) => ({
        kind: 'transform',
        label: TRANSFORM_LABELS[type],
        type,
      })),
    });
  }

  sections.push({
    title: 'Danger',
    items: [
      {
        kind: 'archive',
        label: input.isArchiving ? 'Archiving…' : 'Archive chat',
      },
    ],
  });

  return sections;
}

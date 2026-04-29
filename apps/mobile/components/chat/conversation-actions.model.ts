import { ENABLED_ARTIFACT_TYPES, type ArtifactType } from '@hominem/rpc/types';

import t from '~/translations';

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
}

const TRANSFORM_TYPES = ENABLED_ARTIFACT_TYPES.filter(
  (t): t is Exclude<ArtifactType, 'tracker'> => t !== 'tracker',
);

const TRANSFORM_LABELS: Record<Exclude<ConversationActionType, 'tracker'>, string> = {
  note: t.chat.actions.transformToNote,
  task: t.chat.actions.transformToTask,
  task_list: t.chat.actions.transformToTaskList,
};

export function buildConversationActionsModel(
  input: ConversationActionsModelInput,
): ConversationActionSection[] {
  const sections: ConversationActionSection[] = [
    {
      title: t.chat.actions.sectionConversation,
      items: [
        { kind: 'search', label: t.chat.actions.searchMessages },
        {
          kind: 'toggle-debug',
          label: input.showDebug
            ? t.chat.actions.hideDebugMetadata
            : t.chat.actions.showDebugMetadata,
        },
      ],
    },
  ];

  if (input.canTransform) {
    sections.push({
      title: t.chat.actions.sectionTransform,
      items: TRANSFORM_TYPES.map((type) => ({
        kind: 'transform',
        label: TRANSFORM_LABELS[type],
        type,
      })),
    });
  }

  sections.push({
    title: t.chat.actions.sectionDanger,
    items: [
      {
        kind: 'archive',
        label: input.isArchiving ? t.chat.actions.archiving : t.chat.actions.archiveChat,
      },
    ],
  });

  return sections;
}

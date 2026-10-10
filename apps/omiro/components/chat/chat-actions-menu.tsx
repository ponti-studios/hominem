import type { ChatMessageItem } from '@hominem/chat';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { buildNoteDraft } from '~/components/chat/build-note-draft';
import { buildConversationActionsModel } from '~/components/chat/conversation-actions.model';
import type { ActionMenuItem, ActionMenuSection } from '~/components/ui/action-menu';
import { useChatArchiveAction } from '~/hooks/use-chat-archive-action';
import t from '~/translations';

function getConversationActionIcon(kind: string, type?: string): ActionMenuItem['icon'] {
  if (kind === 'search') {
    return 'magnifyingglass';
  }
  if (kind === 'toggle-debug') {
    return 'ladybug';
  }
  if (kind === 'settings') {
    return 'slider.horizontal.3';
  }
  if (kind === 'sources') {
    return 'doc.text.magnifyingglass';
  }
  if (kind === 'archive') {
    return 'archivebox';
  }
  if (type === 'note') {
    return 'doc.text';
  }
  if (type === 'task') {
    return 'checkmark.circle';
  }
  return 'ellipsis.circle';
}

interface ChatActionsMenuInput {
  chatId: string;
  messages: ChatMessageItem[];
  isConversationGone: boolean;
  canTransform: boolean;
  showDebug: boolean;
  onChatArchive: () => void;
  onOpenSearch: () => void;
  onToggleDebug: () => void;
  onOpenSettings: () => void;
  onOpenSources: () => void;
}

// Builds the sections the designed `ActionMenu` renders from the shared
// conversation-actions model.
export function useChatActionsMenu({
  chatId,
  messages,
  isConversationGone,
  canTransform,
  showDebug,
  onChatArchive,
  onOpenSearch,
  onToggleDebug,
  onOpenSettings,
  onOpenSources,
}: ChatActionsMenuInput): ActionMenuSection[] {
  const router = useRouter();
  const { handleArchiveChat, isArchiving } = useChatArchiveAction({ chatId, onChatArchive });
  const conversationActions = buildConversationActionsModel({
    canTransform,
    isArchiving,
    showDebug,
  });

  const transformToNote = () => {
    const draft = buildNoteDraft(messages);
    if (draft.transcript.trim().length === 0) {
      Alert.alert(t.chat.noteDraft.emptyChat);
      return;
    }
    router.push({
      pathname: '/chat-to-note-sheet',
      params: {
        transcript: draft.transcript,
        title: draft.title,
        isTruncated: draft.isTruncated.toString(),
        chatId,
      },
    });
  };

  const sections = isConversationGone ? [] : conversationActions;
  return sections.map((section) => ({
    key: section.title,
    title: section.title,
    items: section.items.map((item): ActionMenuItem => {
      const key = item.type ? `${item.kind}:${item.type}` : item.kind;
      const icon = getConversationActionIcon(item.kind, item.type);
      const base = { key, label: item.label, icon };
      switch (item.kind) {
        case 'search':
          return { ...base, onPress: onOpenSearch };
        case 'toggle-debug':
          return { ...base, isOn: showDebug, onPress: onToggleDebug };
        case 'settings':
          return { ...base, onPress: onOpenSettings };
        case 'sources':
          return { ...base, onPress: onOpenSources };
        case 'transform':
          return {
            ...base,
            onPress: () => {
              if (item.type === 'note') {
                transformToNote();
              }
            },
          };
        default:
          return { ...base, destructive: true, disabled: isArchiving, onPress: handleArchiveChat };
      }
    }),
  }));
}

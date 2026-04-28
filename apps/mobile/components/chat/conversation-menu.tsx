import { Button, Menu } from '@expo/ui/swift-ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import type { ArtifactType } from '@hominem/rpc/types';
import { Pressable } from 'react-native';

import AppIcon from '~/components/ui/icon';

import { buildConversationActionsModel } from './conversation-actions.model';

type ConversationActionType = ArtifactType;

interface ConversationMenuProps {
  showDebug: boolean;
  isArchiving: boolean;
  canTransform: boolean;
  transformTypes?: Exclude<ConversationActionType, 'tracker'>[];
  onOpenSearch: () => void;
  onToggleDebug: () => void;
  onTransform: (type: ConversationActionType) => void;
  onArchive: () => void;
}

export function ConversationMenu({
  showDebug,
  isArchiving,
  canTransform,
  transformTypes,
  onOpenSearch,
  onToggleDebug,
  onTransform,
  onArchive,
}: ConversationMenuProps) {
  const sections = buildConversationActionsModel({
    canTransform,
    isArchiving,
    showDebug,
    transformTypes: transformTypes ?? ['note', 'task', 'task_list'],
  });

  const handleAction = (
    item: ReturnType<typeof buildConversationActionsModel>[number]['items'][number],
  ) => {
    if (item.kind === 'search') {
      onOpenSearch();
    } else if (item.kind === 'toggle-debug') {
      onToggleDebug();
    } else if (item.kind === 'transform' && item.type) {
      onTransform(item.type);
    } else if (item.kind === 'archive') {
      onArchive();
    }
  };

  return (
    <Menu
      label={
        <Pressable
          accessibilityLabel="Conversation actions"
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.iconButtonPressed : null]}
        >
          <AppIcon name="ellipsis" size={18} />
        </Pressable>
      }
      modifiers={[buttonStyle('borderless')]}
    >
      {sections.flatMap((section) =>
        section.items.map((item) => (
          <Button
            key={`${section.title}:${item.label}`}
            label={item.label}
            role={item.kind === 'archive' ? 'destructive' : undefined}
            onPress={() => handleAction(item)}
          />
        )),
      )}
    </Menu>
  );
}

const styles = {
  iconButton: {
    alignItems: 'center' as const,
    height: 32,
    justifyContent: 'center' as const,
    width: 32,
  },
  iconButtonPressed: {
    opacity: 0.65,
  },
};

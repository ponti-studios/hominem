import { Button, Image, Menu } from '@expo/ui/swift-ui';
import { buttonStyle, frame } from '@expo/ui/swift-ui/modifiers';
import type { ArtifactType } from '@hominem/rpc/types';

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

  const handleAction = (item: ReturnType<typeof buildConversationActionsModel>[number]['items'][number]) => {
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
      label={<Image systemName="ellipsis" size={18} />}
      modifiers={[buttonStyle('borderless'), frame({ width: 44, height: 44 })]}
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

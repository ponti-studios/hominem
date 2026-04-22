import type { ArtifactType } from '@hominem/rpc/types';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '~/components/theme/tokens';

import { Text } from '~/components/theme';
import { Button } from '../ui/Button';
import { buildConversationActionsModel } from './conversation-actions.model';

type ConversationActionType = ArtifactType;

interface ConversationActionsSheetProps {
  visible: boolean;
  title: string;
  statusCopy?: string;
  showDebug: boolean;
  isArchiving: boolean;
  canTransform: boolean;
  transformTypes?: Exclude<ConversationActionType, 'tracker'>[];
  onClose: () => void;
  onOpenSearch: () => void;
  onToggleDebug: () => void;
  onTransform: (type: ConversationActionType) => void;
  onArchive: () => void;
}

export function ConversationActionsSheet({
  visible,
  title,
  statusCopy,
  showDebug,
  isArchiving,
  canTransform,
  transformTypes,
  onClose,
  onOpenSearch,
  onToggleDebug,
  onTransform,
  onArchive,
}: ConversationActionsSheetProps) {
  const insets = useSafeAreaInsets();
  const sections = buildConversationActionsModel({
    canTransform,
    isArchiving,
    showDebug,
    transformTypes: transformTypes ?? ['note', 'task', 'task_list'],
  });

  if (!visible) return null;

  const handlePress = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent statusBarTranslucent>
      <Pressable onPress={onClose} style={styles.overlay}>
        <Pressable onPress={() => {}} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {statusCopy ? (
              <Text color="text-tertiary" style={styles.status}>
                {statusCopy}
              </Text>
            ) : null}
          </View>

          {sections.map((section) => (
            <View key={section.title} style={styles.group}>
              <Text color="text-tertiary" style={styles.groupLabel}>
                {section.title}
              </Text>
              {section.items.map((item) => (
                <Button
                  key={`${section.title}:${item.label}`}
                  onPress={() =>
                    handlePress(() => {
                      if (item.kind === 'search') {
                        onOpenSearch();
                      } else if (item.kind === 'toggle-debug') {
                        onToggleDebug();
                      } else if (item.kind === 'transform' && item.type) {
                        onTransform(item.type);
                      } else if (item.kind === 'archive') {
                        onArchive();
                      }
                    })
                  }
                  style={styles.actionButton}
                  variant={item.kind === 'archive' ? 'destructive' : 'outline'}
                  isLoading={item.kind === 'archive' && isArchiving}
                >
                  {item.label}
                </Button>
              ))}
            </View>
          ))}

          <Button onPress={onClose} style={styles.cancelButton} variant="ghost">
            Cancel
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignSelf: 'stretch',
    width: '100%',
  },
  cancelButton: {
    alignSelf: 'stretch',
    borderColor: colors['border-default'],
    width: '100%',
  },
  group: {
    gap: spacing[2],
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors['border-default'],
    borderRadius: radii.sm,
    height: 4,
    marginBottom: spacing[1],
    width: 36,
  },
  header: {
    gap: spacing[1],
  },
  overlay: {
    backgroundColor: colors['overlay-modal-high'],
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderColor: colors['border-default'],
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderTopWidth: 1,
    gap: spacing[4],
    padding: spacing[5],
  },
  status: {
    fontSize: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});

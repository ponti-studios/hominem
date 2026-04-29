import type { ArtifactType } from '@hominem/rpc/types';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, radii, spacing, useThemeColors } from '~/components/theme';
import t from '~/translations';

import { buildConversationActionsModel } from './conversation-actions.model';

type ConversationActionType = ArtifactType;

interface ConversationActionsSheetProps {
  visible: boolean;
  title: string;
  statusCopy?: string;
  showDebug: boolean;
  isArchiving: boolean;
  canTransform: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
  onToggleDebug: () => void;
  onTransform: (type: ConversationActionType) => void;
  onArchive: () => void;
}

function SheetActionButton({
  disabled = false,
  emphasized = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  emphasized?: boolean;
  label: string;
  onPress: () => void;
}) {
  const themeColors = useThemeColors();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          backgroundColor: emphasized ? themeColors.foreground : 'transparent',
          borderColor: themeColors['border-default'],
          borderRadius: radii.md,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 44,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
        },
      ]}
    >
      <Text
        style={{
          color: emphasized ? themeColors.background : themeColors.foreground,
          fontSize: 16,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ConversationActionsSheet({
  visible,
  title,
  statusCopy,
  showDebug,
  isArchiving,
  canTransform,
  onClose,
  onOpenSearch,
  onToggleDebug,
  onTransform,
  onArchive,
}: ConversationActionsSheetProps) {
  const styles = useConvActionsStyles();
  const insets = useSafeAreaInsets();
  const sections = buildConversationActionsModel({
    canTransform,
    isArchiving,
    showDebug,
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
          <View style={styles.content}>
            <View style={styles.headerBlock}>
              <Text style={styles.title}>{title}</Text>
              {statusCopy ? <Text style={styles.statusCopy}>{statusCopy}</Text> : null}
            </View>

            {sections.map((section) => (
              <View key={section.title} style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
                {section.items.map((item) => {
                  const isArchiveAction = item.kind === 'archive';

                  return (
                    <SheetActionButton
                      key={`${section.title}:${item.label}`}
                      disabled={isArchiveAction && isArchiving}
                      emphasized={isArchiveAction}
                      label={isArchiveAction && isArchiving ? 'Archiving...' : item.label}
                      onPress={() =>
                        handlePress(() => {
                          if (item.kind === 'search') {
                            onOpenSearch();
                          } else if (item.kind === 'toggle-debug') {
                            onToggleDebug();
                          } else if (item.kind === 'transform' && item.type) {
                            onTransform(item.type);
                          } else if (isArchiveAction) {
                            onArchive();
                          }
                        })
                      }
                    />
                  );
                })}
              </View>
            ))}

            <SheetActionButton label={t.chat.input.actionSheet.cancel} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useConvActionsStyles = makeStyles((theme) => ({
  content: {
    gap: 16,
    paddingHorizontal: spacing[4],
    paddingVertical: 4,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: theme.colors['border-default'],
    borderRadius: radii.sm,
    height: 4,
    marginBottom: spacing[1],
    width: 36,
  },
  headerBlock: {
    gap: 4,
  },
  overlay: {
    backgroundColor: theme.colors['overlay-modal-high'],
    flex: 1,
    justifyContent: 'flex-end',
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitle: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    fontWeight: '600',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors['border-default'],
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderTopWidth: 1,
    paddingHorizontal: spacing[1],
    paddingTop: spacing[5],
  },
  statusCopy: {
    color: theme.colors['text-secondary'],
    fontSize: 13,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: 20,
    fontWeight: '600',
  },
}));

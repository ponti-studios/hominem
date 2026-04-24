import {
  Button as SwiftUIButton,
  Host as SwiftUIHost,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import type { ArtifactType } from '@hominem/rpc/types';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, radii, spacing } from '~/components/theme';

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
  const styles = useConvActionsStyles();
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
          <SwiftUIHost matchContents style={styles.host}>
            <VStack spacing={16} modifiers={[padding({ horizontal: spacing[4], vertical: 4 })]}>
              <VStack spacing={4}>
                <SwiftUIText modifiers={[font({ size: 20, weight: 'semibold' })]}>
                  {title}
                </SwiftUIText>
                {statusCopy ? (
                  <SwiftUIText
                    modifiers={[
                      font({ size: 13 }),
                      foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                    ]}
                  >
                    {statusCopy}
                  </SwiftUIText>
                ) : null}
              </VStack>

              {sections.map((section) => (
                <VStack key={section.title} spacing={8}>
                  <SwiftUIText
                    modifiers={[
                      font({ size: 12, weight: 'semibold' }),
                      foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                    ]}
                  >
                    {section.title.toUpperCase()}
                  </SwiftUIText>
                  {section.items.map((item) => {
                    const isArchiveAction = item.kind === 'archive';

                    return (
                      <SwiftUIButton
                        key={`${section.title}:${item.label}`}
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
                        modifiers={[
                          buttonStyle(isArchiveAction ? 'borderedProminent' : 'bordered'),
                          disabledModifier(isArchiveAction && isArchiving),
                          frame({ maxWidth: Number.POSITIVE_INFINITY }),
                          ...(isArchiveAction
                            ? [foregroundStyle({ type: 'color', color: 'red' })]
                            : []),
                        ]}
                      />
                    );
                  })}
                </VStack>
              ))}

              <SwiftUIButton
                label="Cancel"
                onPress={onClose}
                modifiers={[
                  buttonStyle('borderless'),
                  frame({ maxWidth: Number.POSITIVE_INFINITY }),
                ]}
              />
            </VStack>
          </SwiftUIHost>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useConvActionsStyles = makeStyles((theme) => ({
  handle: {
    alignSelf: 'center',
    backgroundColor: theme.colors['border-default'],
    borderRadius: radii.sm,
    height: 4,
    marginBottom: spacing[1],
    width: 36,
  },
  host: {
    alignSelf: 'stretch',
  },
  overlay: {
    backgroundColor: theme.colors['overlay-modal-high'],
    flex: 1,
    justifyContent: 'flex-end',
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
}));

import type { ChatMessageItem } from '@hominem/chat';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';

import { useAppTheme } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionAnimations } from '~/services/motion/native-motion';

import { ActionIconButton } from '../ui/action-icon-button';
import { ChatCopyButton } from './chat-copy-button';
import { ChatShareButton } from './chat-share-button';
import { ChatSpeakButton } from './chat-speak-button';

export function ActiveMessageActions({
  isActive,
  isUser,
  timestamp,
  message,
  actions,
  onEdit,
  onRegenerate,
  onDelete,
}: {
  isActive: boolean;
  isUser: boolean;
  timestamp: string;
  message: ChatMessageItem;
  actions: { canDelete: boolean; canEdit: boolean; canRegenerate: boolean };
  onEdit: () => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}) {
  const { tertiary } = useAppTheme().colors;
  const reducedMotion = useReducedMotion();

  if (!isActive) {
    return null;
  }

  const entering = reducedMotion
    ? nativeMotionAnimations.fadeInQuick
    : nativeMotionAnimations.fadeInDownQuick;
  const exiting = reducedMotion
    ? nativeMotionAnimations.fadeOutQuick
    : nativeMotionAnimations.fadeOutUpQuick;
  const layout = reducedMotion ? undefined : nativeMotionAnimations.layoutQuick;

  return (
    // Split across two nodes on purpose: entering/exiting (mount/unmount)
    // lives on the outer view, layout (reposition while mounted, e.g. when
    // a sibling message's height changes) lives on the inner one. Both on
    // the same node fight over opacity -- see chat-message.tsx.
    <Reanimated.View entering={entering} exiting={exiting} style={styles.actionContainer}>
      <Reanimated.View layout={layout}>
        <View style={[styles.actions, isUser && styles.actionsEnd]}>
          {timestamp ? <Text style={{ color: tertiary, fontSize: 12 }}>{timestamp}</Text> : null}
          <ChatCopyButton message={message} />
          <ChatSpeakButton message={message} />
          <ChatShareButton message={message} />
          {actions.canEdit ? <ActionIconButton icon="square.and.pencil" onPress={onEdit} /> : null}
          {actions.canRegenerate ? (
            <ActionIconButton icon="arrow.clockwise" onPress={() => onRegenerate?.(message.id)} />
          ) : null}
          {actions.canDelete ? (
            <ActionIconButton icon="trash" isDestructive onPress={() => onDelete?.(message.id)} />
          ) : null}
        </View>
      </Reanimated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  actionContainer: { marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionsEnd: { justifyContent: 'flex-end' },
});

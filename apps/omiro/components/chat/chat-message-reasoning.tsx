import type { ChatMessageItem } from '@hominem/chat';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

import { useToolCardStyles } from './chat-card.styles';
import { ChatReasoningSheet } from './chat-reasoning-sheet';
import { ShimmerText } from './chat-thinking-indicator';

// The model's reasoning, shown above the reply like a tool call. Tapping it
// opens the full text in a sheet, so the bubble stays about the answer.
export function MessageReasoning({ message }: { message: ChatMessageItem }) {
  const { eventForeground, eventSun, neutralTile } = useAppTheme().colors;
  const styles = useToolCardStyles();
  const [open, setOpen] = useState(false);
  const reasoning = message.reasoning?.trim();
  if (message.role.toLowerCase() === 'user' || !reasoning) {
    return null;
  }
  const live = Boolean(message.isStreaming);

  return (
    <View style={styles.toolCalls}>
      <Pressable
        accessibilityLabel={t.chat.reasoning.a11y}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.card}
        testID="message-reasoning"
      >
        <View style={[styles.tile, { backgroundColor: live ? eventSun : neutralTile }]}>
          <AppIcon name="sparkles" size={16} tintColor={eventForeground} />
        </View>
        <View style={styles.body}>
          {live ? (
            <ShimmerText label={t.chat.reasoning.thinking} style={styles.title} />
          ) : (
            <Text style={styles.title}>{t.chat.reasoning.title}</Text>
          )}
          <Text numberOfLines={2} style={styles.detail}>
            {reasoning}
          </Text>
        </View>
      </Pressable>
      {open ? <ChatReasoningSheet reasoning={reasoning} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}

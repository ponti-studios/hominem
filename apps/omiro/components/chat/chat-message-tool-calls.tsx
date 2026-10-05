import type { ChatMessageItem } from '@hominem/chat';
import { Pressable, Text, View } from 'react-native';

import { useStyles } from '~/components/theme';

import { describeToolArgs, formatToolName } from './chat-tool-call.helpers';

type ToolCall = NonNullable<ChatMessageItem['toolCalls']>[number];

export function MessageToolCalls({
  messageId,
  onRespond,
  responding,
  toolCalls,
}: {
  messageId: string;
  onRespond?: (input: { messageId: string; toolCallId: string; approved: boolean }) => void;
  responding?: boolean;
  toolCalls: ToolCall[];
}) {
  const styles = useStyles((theme) => ({
    toolCalls: { gap: 10, marginBottom: 10, maxWidth: '94%' },
    toolCall: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadii.xl,
      gap: 12,
      padding: 16,
    },
    toolName: {
      color: theme.colors.foreground,
      fontSize: 16,
      fontWeight: '800',
    },
    args: { gap: 8 },
    argLabel: { color: theme.colors.mutedForeground, fontSize: 12, fontWeight: '700' },
    argValue: { color: theme.colors.foreground, fontSize: 15, lineHeight: 21 },
    actions: { flexDirection: 'row', gap: 8 },
    action: {
      alignItems: 'center',
      borderRadius: theme.borderRadii.pill,
      flex: 1,
      paddingVertical: 12,
    },
    approve: { backgroundColor: theme.colors.primary },
    reject: { backgroundColor: theme.colors.secondary },
    approveText: { color: theme.colors.primaryForeground, fontSize: 15, fontWeight: '700' },
    rejectText: { color: theme.colors.foreground, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.8 },
  }));

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <View style={styles.toolCalls}>
      {toolCalls.map((toolCall: ToolCall) => (
        <View
          key={toolCall.toolCallId || `${toolCall.toolName}:${JSON.stringify(toolCall.args)}`}
          style={styles.toolCall}
        >
          <Text style={styles.toolName}>{formatToolName(toolCall.toolName)}</Text>
          <View style={styles.args}>
            {describeToolArgs(toolCall.args).map((arg) => (
              <View key={arg.label}>
                <Text style={styles.argLabel}>{arg.label}</Text>
                <Text style={styles.argValue}>{arg.value}</Text>
              </View>
            ))}
          </View>
          {toolCall.confirmationStatus === 'pending' && onRespond ? (
            <View style={styles.actions}>
              <Pressable
                accessible
                accessibilityLabel={`Approve ${toolCall.toolName}`}
                accessibilityRole="button"
                disabled={responding}
                onPress={() => {
                  void onRespond({ messageId, toolCallId: toolCall.toolCallId, approved: true });
                }}
                style={({ pressed }) => [styles.action, styles.approve, pressed && styles.pressed]}
                testID="tool-confirm-approve"
              >
                <Text style={styles.approveText}>Approve</Text>
              </Pressable>
              <Pressable
                accessible
                accessibilityLabel={`Reject ${toolCall.toolName}`}
                accessibilityRole="button"
                disabled={responding}
                onPress={() => {
                  void onRespond({ messageId, toolCallId: toolCall.toolCallId, approved: false });
                }}
                style={({ pressed }) => [styles.action, styles.reject, pressed && styles.pressed]}
                testID="tool-confirm-reject"
              >
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

import type { ChatMessageItem } from '@hominem/chat';
import { Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

import { ShimmerText } from './chat-thinking-indicator';
import { describeToolArgs, formatToolName, getToolIcon } from './chat-tool-call.helpers';

type ToolCall = NonNullable<ChatMessageItem['toolCalls']>[number];

type ToolCallPhase = 'asking' | 'rejected' | 'running' | 'done' | 'failed';

export function getToolCallPhase(toolCall: ToolCall): ToolCallPhase {
  if (toolCall.confirmationStatus === 'pending') {
    return 'asking';
  }
  if (toolCall.confirmationStatus === 'rejected') {
    return 'rejected';
  }
  if (toolCall.executionStatus === 'failed') {
    return 'failed';
  }
  if (toolCall.executionStatus === 'completed') {
    return 'done';
  }
  return 'running';
}

// What the person is being asked to approve, shown as the thing it will make:
// the approval itself lives in the composer bar (ChatToolApprovalBar), so the
// card stays quiet.
export function MessageToolCalls({ toolCalls }: { toolCalls: ToolCall[] }) {
  const { coral, eventForeground, eventSun, lime, mutedForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    toolCalls: { gap: 10, marginBottom: 10, width: '94%' },
    card: {
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      padding: 10,
    },
    asking: { borderColor: theme.colors.primary, borderStyle: 'dashed', borderWidth: 2 },
    rejected: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.mutedForeground,
      borderStyle: 'dashed',
      borderWidth: 2,
      opacity: 0.8,
    },
    failed: { borderColor: theme.colors.coral, borderWidth: 2 },
    tile: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 11,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    body: { flex: 1, gap: 2, minWidth: 0 },
    draftChip: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.secondary,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    draftChipText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    title: { color: theme.colors.foreground, fontSize: 14, fontWeight: '800' },
    mutedTitle: { color: theme.colors.mutedForeground, fontSize: 14, fontWeight: '800' },
    detail: {
      color: theme.colors.mutedForeground,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 17,
    },
    struck: { textDecorationLine: 'line-through' },
  }));

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <View style={styles.toolCalls}>
      {toolCalls.map((toolCall: ToolCall) => {
        const phase = getToolCallPhase(toolCall);
        const name = formatToolName(toolCall.toolName);
        const details = describeToolArgs(toolCall.args)
          .slice(0, 1)
          .map((arg) => arg.value);
        const tileColor =
          phase === 'done'
            ? lime
            : phase === 'failed'
              ? coral
              : phase === 'rejected'
                ? 'rgba(127, 127, 160, 0.2)'
                : eventSun;
        return (
          <View
            key={toolCall.toolCallId || `${toolCall.toolName}:${JSON.stringify(toolCall.args)}`}
            style={[
              styles.card,
              phase === 'asking' && styles.asking,
              phase === 'rejected' && styles.rejected,
              phase === 'failed' && styles.failed,
            ]}
            testID={`tool-call-${phase}`}
          >
            <View style={[styles.tile, { backgroundColor: tileColor }]}>
              <AppIcon
                name={
                  phase === 'failed'
                    ? 'exclamationmark'
                    : phase === 'rejected'
                      ? 'xmark'
                      : getToolIcon(toolCall.toolName)
                }
                size={16}
                tintColor={phase === 'rejected' ? mutedForeground : eventForeground}
              />
            </View>
            <View style={styles.body}>
              {phase === 'asking' ? (
                <View style={styles.draftChip}>
                  <Text style={styles.draftChipText}>{t.chat.toolCall.waiting}</Text>
                </View>
              ) : null}
              {phase === 'running' ? (
                <ShimmerText label={t.chat.toolCall.running(name)} style={styles.title} />
              ) : (
                <Text style={phase === 'rejected' ? styles.mutedTitle : styles.title}>
                  {phase === 'rejected'
                    ? t.chat.toolCall.rejected
                    : phase === 'failed'
                      ? t.chat.toolCall.failed(name)
                      : name}
                </Text>
              )}
              {phase === 'failed' ? (
                <Text style={styles.detail}>{t.chat.toolCall.failedDetail}</Text>
              ) : (
                details.map((value) => (
                  <Text
                    key={value}
                    numberOfLines={2}
                    style={[styles.detail, phase === 'rejected' && styles.struck]}
                  >
                    {value}
                  </Text>
                ))
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

import type { ChatMessageItem } from '@hominem/chat';
import { Text, View } from 'react-native';

import { useAppTheme } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

import { useToolCardStyles } from './chat-card.styles';
import { ShimmerText } from './chat-thinking-indicator';
import {
  describeToolArgs,
  formatToolName,
  getToolCallPhase,
  getToolIcon,
} from './chat-tool-call.helpers';

type ToolCall = NonNullable<ChatMessageItem['toolCalls']>[number];

// What the person is being asked to approve, shown as the thing it will make:
// the approval itself lives in the composer bar (ChatToolApprovalBar), so the
// card stays quiet.
export function MessageToolCalls({ toolCalls }: { toolCalls: ToolCall[] }) {
  const { coral, eventForeground, eventSun, lime, mutedForeground, neutralTile } =
    useAppTheme().colors;
  const styles = useToolCardStyles();

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
                ? neutralTile
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

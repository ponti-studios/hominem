import type { ChatMessageItem } from '@hominem/chat';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ChatGenerationFailedBar } from '~/components/chat/chat-generation-bar';
import { ChatMessage } from '~/components/chat/chat-message';
import { ChatToolApprovalBar } from '~/components/chat/chat-tool-approval-bar';
import { useStyles } from '~/components/theme';
import {
  appendStreamingMessageText,
  clearStreamingMessageText,
} from '~/services/chat/streaming-text-store';

// Dev-only gallery: every message state the chat can render, with fixture data, so
// each one can be eyeballed (and screenshotted) without driving a real conversation.
const base = { chatId: 'gallery', createdAt: new Date().toISOString(), toolCalls: null };
const noop = () => undefined;

type Fixture = { title: string; message: ChatMessageItem; active?: boolean };

function msg(id: string, overrides: Partial<ChatMessageItem>): ChatMessageItem {
  return {
    ...base,
    id,
    renderKey: id,
    role: 'assistant',
    message: '',
    ...overrides,
  };
}

const photo = (id: string, seed: number) => ({
  id,
  url: `https://picsum.photos/seed/${seed}/320/320`,
});

const fixtures: Fixture[] = [
  {
    title: 'User · sent',
    message: msg('u1', { role: 'user', message: 'What is on my plate today?' }),
  },
  {
    title: 'User · failed (retry)',
    message: msg('u2', {
      role: 'user',
      message: 'Remind me to call mom',
      failed: true,
      error: 'Network request failed',
    }),
  },
  {
    title: 'User · photos + text',
    message: msg('u3', {
      role: 'user',
      message: 'What is this plant?',
      images: [photo('p1', 11), photo('p2', 22)],
    }),
  },
  {
    title: 'User · photo only',
    message: msg('u4', { role: 'user', message: '', images: [photo('p3', 33)] }),
  },
  {
    title: 'Assistant · thinking',
    message: msg('a1', { isStreaming: true, message: '' }),
  },
  {
    title: 'Assistant · reasoning + thinking',
    message: msg('a2', {
      isStreaming: true,
      message: '',
      reasoning: 'Checking your calendar and open tasks first.',
    }),
  },
  {
    title: 'Assistant · reasoning + reply',
    message: msg('a6', {
      message: 'You have a standup at 10 and a PR review after lunch.',
      reasoning:
        'Checking your calendar and open tasks first.\n\nThere is a standup at 10 and one PR waiting on review, nothing else is due today, so I can keep the answer short.',
    }),
  },
  {
    title: 'Assistant · reasoning only',
    message: msg('a7', { reasoning: 'Weighing whether to ask before creating the task.' }),
  },
  {
    title: 'Assistant · streaming',
    message: msg('a3', { isStreaming: true, message: '' }),
  },
  {
    title: 'Assistant · committed markdown',
    message: msg('a4', {
      message:
        '**Today**\n\n- Standup at 10\n- Review the PR\n- Call mom\n\nWant me to block time?',
    }),
    active: true,
  },
  {
    title: 'Assistant · interrupted',
    message: msg('a5', { message: 'You have three things', failed: true, error: 'Interrupted' }),
  },
  {
    title: 'Tool · asking',
    message: msg('t1', {
      message: '',
      toolCalls: [
        {
          type: 'tool-call',
          toolCallId: 't1',
          toolName: 'create_task',
          args: { title: 'Call mom' },
          confirmationStatus: 'pending',
        },
      ],
    }),
  },
  {
    title: 'Tool · running',
    message: msg('t2', {
      message: '',
      toolCalls: [
        {
          type: 'tool-call',
          toolCallId: 't2',
          toolName: 'search_notes',
          args: { query: 'trip' },
          executionStatus: 'running',
        },
      ],
    }),
  },
  {
    title: 'Tool · done',
    message: msg('t3', {
      message: 'Done, saved it.',
      toolCalls: [
        {
          type: 'tool-call',
          toolCallId: 't3',
          toolName: 'remember_fact',
          args: { fact: 'Mom likes calls on Sunday' },
          executionStatus: 'completed',
        },
      ],
    }),
  },
  {
    title: 'Tool · failed',
    message: msg('t4', {
      message: '',
      toolCalls: [
        {
          type: 'tool-call',
          toolCallId: 't4',
          toolName: 'create_task',
          args: { title: 'Call mom' },
          executionStatus: 'failed',
        },
      ],
    }),
  },
  {
    title: 'Tool · rejected',
    message: msg('t5', {
      message: '',
      toolCalls: [
        {
          type: 'tool-call',
          toolCallId: 't5',
          toolName: 'delete_task',
          args: { title: 'Call mom' },
          confirmationStatus: 'rejected',
        },
      ],
    }),
  },
];

export default function DevStates() {
  const styles = useStyles((theme) => ({
    screen: { backgroundColor: theme.colors.background, flex: 1 },
    content: { gap: 18, padding: 16, paddingBottom: 80, paddingTop: 120 },
    label: {
      color: theme.colors.mutedForeground,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    bars: { gap: 12 },
  }));

  // A live reply's words come from the streaming store, not the message.
  useEffect(() => {
    appendStreamingMessageText('a3', 'You have three things today: a standup, a PR review');
    return () => clearStreamingMessageText('a3');
  }, []);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="dev-states">
      {fixtures.map(({ title, message, active }) => (
        <View key={message.id}>
          <Text style={styles.label}>{title}</Text>
          <ChatMessage
            activity={active ? 'active' : 'idle'}
            formatTimestamp={() => '9:41 AM'}
            message={message}
            onDelete={noop}
            onRegenerate={noop}
            onRequestEdit={noop}
            onRetry={noop}
            showDebug={false}
          />
        </View>
      ))}
      <View>
        <Text style={styles.label}>Dock · tool approval</Text>
        <ChatToolApprovalBar
          disabled={false}
          onApprove={noop}
          onReject={noop}
          toolName="create_task"
        />
      </View>
      <View>
        <Text style={styles.label}>Dock · generation failed</Text>
        <ChatGenerationFailedBar onEdit={noop} onRetry={noop} />
      </View>
    </ScrollView>
  );
}

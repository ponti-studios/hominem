import type { ChatMessageItem } from '@hominem/chat';
import { HonoProvider } from '@hominem/rpc/react';
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type TextInputInstance } from 'react-native';

import { ChatGenerationFailedBar } from '~/components/chat/chat-generation-bar';
import { ChatMessage } from '~/components/chat/chat-message';
import { ChatSearchBar } from '~/components/chat/chat-search-bar';
import { ChatSourcesSheet } from '~/components/chat/chat-sources-sheet';
import { ChatToolApprovalBar } from '~/components/chat/chat-tool-approval-bar';
import { ComposerAttachButton } from '~/components/composer/ComposerAttachButton';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerContext, type ComposerContextValue } from '~/components/composer/ComposerContext';
import { useStyles } from '~/components/theme';
import { API_BASE_URL } from '~/constants';
import {
  appendStreamingMessageText,
  clearStreamingMessageText,
} from '~/services/chat/streaming-text-store';

// Dev-only gallery: every message state the chat can render, with fixture data, so
// each one can be eyeballed (and screenshotted) without driving a real conversation.
const base = { chatId: 'gallery', createdAt: new Date().toISOString(), toolCalls: null };
const noop = () => undefined;
// The gallery lives outside the authed layout, so it brings its own bare API client.
const galleryApiConfig = { baseUrl: API_BASE_URL };

type Fixture = { title: string; message: ChatMessageItem; active?: boolean; debug?: boolean };

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

const noopAsync = () => Promise.resolve([]);
const attachState = (over: Partial<ComposerContextValue>): ComposerContextValue => ({
  attachments: [],
  pendingUploads: [],
  dismissErrors: noop,
  errors: [],
  isUploading: false,
  progressByAssetId: {},
  onRemove: noop,
  clearAttachments: noop,
  pickAttachment: noopAsync,
  handleCameraCapture: noopAsync,
  markAttachmentsSubmitted: noop,
  ...over,
});
const attachment = (id: string, seed: number) => ({
  id,
  name: `${id}.jpg`,
  type: 'image',
  localUri: `https://picsum.photos/seed/${seed}/200/200`,
});
const attachStates: { title: string; value: ComposerContextValue }[] = [
  { title: 'Composer · idle', value: attachState({}) },
  {
    title: 'Composer · picking (pending thumbnail)',
    value: attachState({
      isUploading: true,
      pendingUploads: [
        { id: 'p1', name: 'p1.jpg', localUri: 'https://picsum.photos/seed/5/200/200' },
      ],
    }),
  },
  {
    title: 'Composer · uploading (progress)',
    value: attachState({
      isUploading: true,
      attachments: [attachment('a1', 6), attachment('a2', 7)],
      progressByAssetId: { a2: 55 },
    }),
  },
  {
    title: 'Composer · ready',
    value: attachState({ attachments: [attachment('a1', 6), attachment('a2', 7)] }),
  },
  {
    title: 'Composer · upload error',
    value: attachState({ errors: ['Could not upload photo.jpg'] }),
  },
];

const searchStates = [
  { title: 'Search · empty', query: '', resultCount: 0, isSearching: false },
  { title: 'Search · searching', query: 'lisbon', resultCount: 0, isSearching: true },
  { title: 'Search · results', query: 'lisbon', resultCount: 4, isSearching: false },
  { title: 'Search · no results', query: 'zzzz', resultCount: 0, isSearching: false },
];

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
    title: 'Assistant · speak button + debug panel',
    message: msg('a8', {
      message: 'Here is the short version: standup at 10, PR review after lunch.',
      audio: { url: 'https://example.com/a8.mp3', mimeType: 'audio/mpeg' },
    }),
    active: true,
    debug: true,
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
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInputInstance | null>(null);
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
    // The attach button is white-on-dark, so give it the composer's dark bar to sit on.
    composerRow: {
      alignItems: 'center',
      backgroundColor: theme.colors.foreground,
      borderRadius: 28,
      flexDirection: 'row',
      gap: 12,
      padding: 10,
    },
    composerStrip: { flex: 1 },
    sheetButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.secondary,
      borderRadius: 16,
      padding: 14,
    },
    searchState: { marginTop: 12 },
    sheetButtonText: { color: theme.colors.foreground, fontWeight: '700' },
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
      {fixtures.map(({ title, message, active, debug }) => (
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
            showDebug={Boolean(debug)}
          />
        </View>
      ))}
      {attachStates.map(({ title, value }) => (
        <View key={title}>
          <Text style={styles.label}>{title}</Text>
          <ComposerContext.Provider value={value}>
            <View style={styles.composerRow}>
              <ComposerAttachButton disabled={false} />
              <View style={styles.composerStrip}>
                <ComposerAttachmentRow />
              </View>
            </View>
          </ComposerContext.Provider>
        </View>
      ))}
      <View>
        <Text style={styles.label}>Sheet · sources</Text>
        <Pressable style={styles.sheetButton} onPress={() => setSourcesOpen(true)}>
          <Text style={styles.sheetButtonText}>Open sources sheet</Text>
        </Pressable>
        <HonoProvider config={galleryApiConfig}>
          <ChatSourcesSheet
            chatId="gallery"
            visible={sourcesOpen}
            onClose={() => setSourcesOpen(false)}
          />
        </HonoProvider>
      </View>
      <View>
        <Text style={styles.label}>Dock · search bar</Text>
        {/* The bar autofocuses, so keep it behind a tap rather than popping the keyboard on load. */}
        <Pressable style={styles.sheetButton} onPress={() => setSearchOpen((open) => !open)}>
          <Text style={styles.sheetButtonText}>
            {searchOpen ? 'Hide search bar states' : 'Show search bar states'}
          </Text>
        </Pressable>
        {searchOpen
          ? searchStates.map(({ title, query, resultCount, isSearching }) => (
              <View key={title} style={styles.searchState}>
                <Text style={styles.label}>{title}</Text>
                <ChatSearchBar
                  inputRef={searchInputRef}
                  isSearching={isSearching}
                  onChangeQuery={noop}
                  onClose={noop}
                  query={query}
                  resultCount={resultCount}
                />
              </View>
            ))
          : null}
      </View>
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

import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Loading } from '~/components/Loading';
import { useTTS } from '~/components/media/use-tts';
import { Text, theme } from '~/components/theme';
import { useActiveChat, useChatMessages } from '~/services/chat';

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: string;
  message: string;
};

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyChat() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Image
          source="sf:bubble.left.and.bubble.right"
          style={styles.emptyIcon}
          tintColor={theme.colors['text-tertiary']}
          contentFit="contain"
        />
      </View>
      <Text style={styles.emptyTitle}>Start the conversation</Text>
      <Text style={styles.emptyBody}>
        Use the composer below to ask a question or reference your notes.
      </Text>
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  message: Message;
  isSpeaking: boolean;
  onSpeak: () => void;
}

const MessageBubble = React.memo(({ message, isSpeaking, onSpeak }: BubbleProps) => {
  const isUser = message.role === 'user';

  return (
    <Reanimated.View
      entering={FadeInDown.duration(240).springify().damping(22).stiffness(260)}
      layout={LinearTransition.duration(160)}
      style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}
    >
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text
          selectable
          style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}
        >
          {message.message}
        </Text>
      </View>

      {!isUser && (
        <Pressable
          onPress={onSpeak}
          style={({ pressed }) => [styles.ttsButton, pressed && styles.ttsButtonPressed]}
          hitSlop={10}
          accessibilityLabel={isSpeaking ? 'Stop reading' : 'Read aloud'}
          accessibilityRole="button"
        >
          <Image
            source={isSpeaking ? 'sf:stop.circle.fill' : 'sf:waveform'}
            style={styles.ttsIcon}
            tintColor={isSpeaking ? theme.colors.accent : theme.colors['text-tertiary']}
            contentFit="contain"
          />
        </Pressable>
      )}
    </Reanimated.View>
  );
});

MessageBubble.displayName = 'MessageBubble';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { speakingId, speak, state: ttsState } = useTTS();
  const { data: activeChat, isLoading: isLoadingActiveChat } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;
  const messagesQuery = useChatMessages({ chatId });
  const scrollRef = useRef<ScrollView>(null);

  const messages = (messagesQuery.data ?? []).filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );

  // Scroll to bottom when messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [messages.length]);

  const handleSpeak = useCallback(
    (message: Message) => {
      void speak(message.id, message.message);
    },
    [speak],
  );

  if (isLoadingActiveChat || !chatId) {
    return <Loading variant="page" message="Loading chat…" />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {messages.length === 0 ? (
          <EmptyChat />
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSpeaking={speakingId === message.id && ttsState === 'playing'}
              onSpeak={() => handleSpeak(message)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BUBBLE_MAX_WIDTH = '78%';
const BUBBLE_RADIUS = 20;
const COMPOSER_CLEARANCE = 180;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: COMPOSER_CLEARANCE,
    gap: 4,
  },

  // ── Bubbles ────────────────────────────────────────────────────────────────
  bubbleRow: {
    flexDirection: 'column',
    marginBottom: 2,
  },
  bubbleRowRight: {
    alignItems: 'flex-end',
  },
  bubbleRowLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: BUBBLE_MAX_WIDTH,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderCurve: 'continuous',
  },
  bubbleUser: {
    backgroundColor: theme.colors.foreground,
    borderRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: theme.colors['bg-elevated'],
    borderRadius: BUBBLE_RADIUS,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  bubbleTextUser: {
    color: theme.colors.background,
  },
  bubbleTextAssistant: {
    color: theme.colors.foreground,
  },

  // ── TTS button ──────────────────────────────────────────────────────────────
  ttsButton: {
    marginTop: 5,
    marginLeft: 4,
    padding: 4,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  ttsButtonPressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  ttsIcon: {
    width: 16,
    height: 16,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors['bg-elevated'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIcon: {
    width: 26,
    height: 26,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.foreground,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors['text-tertiary'],
    textAlign: 'center',
  },
});

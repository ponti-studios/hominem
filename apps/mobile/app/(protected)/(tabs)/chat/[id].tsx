import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LoadingFull } from '~/components/LoadingFull';
import { useTTS } from '~/components/media/use-tts';
import { Text, theme } from '~/components/theme';
import { useActiveChat, useChatMessages } from '~/services/chat';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { speakingId, speak, state } = useTTS();
  const { data: activeChat, isLoading: isLoadingActiveChat } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;
  const messagesQuery = useChatMessages({ chatId });

  if (isLoadingActiveChat || !chatId) {
    return <LoadingFull />;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messagesQuery.data?.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageCard,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text color="text-tertiary">{message.role.toUpperCase()}</Text>
            <Text color="foreground">{message.message}</Text>
            {message.role === 'assistant' ? (
              <Pressable
                onPress={() => void speak(message.id, message.message)}
                style={styles.inlineButton}
              >
                <Text color="text-secondary">
                  {speakingId === message.id && state === 'playing' ? 'STOP AUDIO' : 'PLAY AUDIO'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        {messagesQuery.data?.length === 0 ? (
          <View style={styles.emptyState}>
            <Text color="foreground">Start a chat.</Text>
            <Text color="text-secondary">
              Use the composer below to ask something or attach a file.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const COMPOSER_CLEARANCE = 220;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: theme.spacing.m_16,
    paddingBottom: COMPOSER_CLEARANCE,
    gap: theme.spacing.sm_12,
  },
  messageCard: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.m_16,
    gap: theme.spacing.xs_4,
  },
  userMessage: {
    backgroundColor: theme.colors.muted,
  },
  assistantMessage: {
    backgroundColor: theme.colors.background,
  },
  inlineButton: {
    marginTop: theme.spacing.xs_4,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.ml_24,
    gap: theme.spacing.xs_4,
  },
});

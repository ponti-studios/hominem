import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { LoadingFull } from '~/components/LoadingFull';
import { CameraModal } from '~/components/media/camera-modal';
import { MobileVoiceInput } from '~/components/media/mobile-voice-input';
import { useTTS } from '~/components/media/use-tts';
import { Text, theme } from '~/theme';
import { useActiveChat, useChatMessages, useSendMessage } from '~/utils/services/chat';
import { useFileUpload } from '~/utils/services/files/use-file-upload';
import { useNoteStream } from '~/utils/services/notes/use-note-stream';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ id: string; originalName: string }>>(
    [],
  );
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const { data: notes = [] } = useNoteStream();
  const { uploadAssets, uploadState, clearErrors } = useFileUpload();
  const { speak, state: ttsState } = useTTS();
  const { data: activeChat, isLoading: isLoadingActiveChat } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;
  const messagesQuery = useChatMessages({ chatId });
  const sendMessage = useSendMessage({ chatId });

  const attachFromLibrary = async () => {
    clearErrors();
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: 'images',
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const uploaded = await uploadAssets(
      result.assets.map((asset) => ({
        assetId: asset.assetId ?? asset.uri,
        uri: asset.uri,
        fileName: asset.fileName ?? null,
        mimeType: asset.mimeType ?? null,
        type: asset.type ?? null,
      })),
    );

    setAttachedFiles((current) => [
      ...current,
      ...uploaded.map((asset) => ({
        id: asset.uploadedFile.id,
        originalName: asset.uploadedFile.originalName,
      })),
    ]);
  };

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
              <Pressable onPress={() => void speak(message.message)} style={styles.inlineButton}>
                <Text color="text-secondary">
                  {ttsState === 'loading' ? 'AUDIO...' : 'PLAY AUDIO'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        {messagesQuery.data?.length === 0 ? (
          <View style={styles.emptyState}>
            <Text color="foreground">Start a chat.</Text>
            <Text color="text-secondary">Select notes, dictate a message, or attach a file.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {notes.slice(0, 20).map((note) => {
            const selected = selectedNoteIds.includes(note.id);
            return (
              <Pressable
                key={note.id}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() =>
                  setSelectedNoteIds((current) =>
                    current.includes(note.id)
                      ? current.filter((item) => item !== note.id)
                      : [...current, note.id],
                  )
                }
              >
                <Text color={selected ? 'foreground' : 'text-secondary'}>
                  {note.title || 'Untitled'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TextInput
          multiline
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask something about your notes..."
          placeholderTextColor={theme.colors['text-tertiary']}
          style={styles.input}
        />

        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => void attachFromLibrary()}>
            <Text color="foreground">LIBRARY</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setIsCameraOpen(true)}>
            <Text color="foreground">CAMERA</Text>
          </Pressable>
          <MobileVoiceInput
            autoTranscribe
            onAudioTranscribed={(transcript) =>
              setDraft((current) => `${current}\n${transcript}`.trim())
            }
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              void sendMessage
                .sendChatMessage({
                  message: draft,
                  fileIds: attachedFiles.map((file) => file.id),
                  noteIds: selectedNoteIds,
                })
                .then(() => {
                  setDraft('');
                  setAttachedFiles([]);
                })
            }
          >
            <Text color="foreground">{sendMessage.isChatSending ? 'SENDING' : 'SEND'}</Text>
          </Pressable>
        </View>

        {attachedFiles.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {attachedFiles.map((file) => (
              <Pressable
                key={file.id}
                style={styles.chip}
                onPress={() =>
                  setAttachedFiles((current) => current.filter((item) => item.id !== file.id))
                }
              >
                <Text color="text-secondary">{file.originalName}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {uploadState.errors.length > 0 ? (
          <Text color="destructive">{uploadState.errors.join(', ')}</Text>
        ) : null}
      </View>

      <CameraModal
        visible={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(photo) => {
          void (async () => {
            const uploaded = await uploadAssets([
              {
                assetId: photo.uri,
                uri: photo.uri,
                fileName: photo.fileName ?? null,
                mimeType: 'image/jpeg',
                type: 'image',
              },
            ]);
            setIsCameraOpen(false);
            setAttachedFiles((current) => [
              ...current,
              ...uploaded.map((asset) => ({
                id: asset.uploadedFile.id,
                originalName: asset.uploadedFile.originalName,
              })),
            ]);
          })();
        }}
      />
    </View>
  );
}

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
  composer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors['border-default'],
    padding: theme.spacing.m_16,
    gap: theme.spacing.sm_12,
  },
  chips: {
    gap: theme.spacing.sm_8,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.full,
    paddingHorizontal: theme.spacing.m_16,
    paddingVertical: theme.spacing.xs_4,
  },
  chipActive: {
    backgroundColor: theme.colors.muted,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.m_16,
    color: theme.colors.foreground,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm_12,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    paddingHorizontal: theme.spacing.m_16,
    paddingVertical: theme.spacing.sm_8,
  },
  primaryButton: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    paddingHorizontal: theme.spacing.m_16,
    paddingVertical: theme.spacing.sm_8,
  },
});

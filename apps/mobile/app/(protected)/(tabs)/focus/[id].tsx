import { useApiClient } from '@hominem/rpc/react';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CameraModal } from '~/components/media/camera-modal';
import { MobileVoiceInput } from '~/components/media/mobile-voice-input';
import { Text, theme } from '~/theme';
import { useFileUpload } from '~/utils/services/files/use-file-upload';
import { useNoteQuery } from '~/utils/services/notes/use-note-query';

export default function NoteDetailScreen() {
  const router = useRouter();
  const client = useApiClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const noteId = String(id ?? '');
  const { data: note } = useNoteQuery({ noteId, enabled: noteId.length > 0 });
  const { uploadAssets, uploadState, clearErrors } = useFileUpload();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<Array<{ id: string; originalName: string; url: string }>>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!note) return;
    setTitle(note.title ?? '');
    setContent(note.content);
    setFiles(
      note.files.map((file) => ({ id: file.id, originalName: file.originalName, url: file.url })),
    );
  }, [note]);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  if (!note) {
    return null;
  }

  const scheduleSave = (
    nextTitle: string,
    nextContent: string,
    fileIds = files.map((file) => file.id),
  ) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void client.notes.update({
        id: note.id,
        title: nextTitle || null,
        content: nextContent,
        fileIds,
      });
    }, 400);
  };

  const attachPickerAssets = async () => {
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

    if (uploaded.length === 0) {
      return;
    }

    const nextFiles = [
      ...files,
      ...uploaded.map((asset) => ({
        id: asset.uploadedFile.id,
        originalName: asset.uploadedFile.originalName,
        url: asset.uploadedFile.url,
      })),
    ];

    setFiles(nextFiles);
    await client.notes.update({
      id: note.id,
      title: title || null,
      content,
      fileIds: nextFiles.map((file) => file.id),
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(protected)/(tabs)/notes' as RelativePathString)}
        >
          <Text color="text-secondary">BACK</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push(`/(protected)/(tabs)/chat?noteId=${note.id}` as RelativePathString)
          }
        >
          <Text color="foreground">CHAT</Text>
        </Pressable>
      </View>

      <TextInput
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          scheduleSave(value, content);
        }}
        placeholder="Untitled note"
        placeholderTextColor={theme.colors['text-tertiary']}
        style={styles.titleInput}
      />

      <TextInput
        multiline
        value={content}
        onChangeText={(value) => {
          setContent(value);
          scheduleSave(title, value);
        }}
        placeholder="Start writing..."
        placeholderTextColor={theme.colors['text-tertiary']}
        style={styles.contentInput}
      />

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={() => void attachPickerAssets()}>
          <Text color="foreground">LIBRARY</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => setIsCameraOpen(true)}>
          <Text color="foreground">CAMERA</Text>
        </Pressable>
        <MobileVoiceInput
          autoTranscribe
          onAudioTranscribed={(transcript) => {
            const nextContent = `${content}\n${transcript}`.trim();
            setContent(nextContent);
            scheduleSave(title, nextContent);
          }}
        />
      </View>

      {uploadState.errors.length > 0 ? (
        <Text color="destructive">{uploadState.errors.join(', ')}</Text>
      ) : null}

      <View style={styles.filesSection}>
        <Text variant="cardHeader" color="foreground">
          FILES
        </Text>
        {files.map((file) => (
          <View key={file.id} style={styles.fileCard}>
            <Text color="foreground">{file.originalName}</Text>
            <Pressable
              onPress={async () => {
                const nextFiles = files.filter((item) => item.id !== file.id);
                setFiles(nextFiles);
                await client.notes.update({
                  id: note.id,
                  title: title || null,
                  content,
                  fileIds: nextFiles.map((item) => item.id),
                });
              }}
            >
              <Text color="text-secondary">DETACH</Text>
            </Pressable>
          </View>
        ))}
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
            if (uploaded.length === 0) {
              return;
            }
            const nextFiles = [
              ...files,
              ...uploaded.map((asset) => ({
                id: asset.uploadedFile.id,
                originalName: asset.uploadedFile.originalName,
                url: asset.uploadedFile.url,
              })),
            ];
            setFiles(nextFiles);
            await client.notes.update({
              id: note.id,
              title: title || null,
              content,
              fileIds: nextFiles.map((file) => file.id),
            });
          })();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.m_16,
    gap: theme.spacing.m_16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleInput: {
    fontSize: 28,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  contentInput: {
    minHeight: 280,
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
  filesSection: {
    gap: theme.spacing.sm_12,
  },
  fileCard: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.m_16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

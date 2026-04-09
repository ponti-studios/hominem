import { useNoteEditor } from '@hominem/hooks';
import { useApiClient } from '@hominem/rpc/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text, theme } from '~/theme';
import { useNoteQuery } from '~/services/notes/use-note-query';

const COMPOSER_CLEARANCE = 240;

export default function NoteDetailScreen() {
  const router = useRouter();
  const client = useApiClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const noteId = String(id ?? '');
  const { data: note } = useNoteQuery({ noteId, enabled: noteId.length > 0 });

  if (!note) {
    return null;
  }

  return (
    <NoteDetailEditor
      key={note.id}
      note={note}
      client={client}
      router={router}
    />
  );
}

function NoteDetailEditor({
  note,
  client,
  router,
}: {
  note: NonNullable<ReturnType<typeof useNoteQuery>['data']>;
  client: ReturnType<typeof useApiClient>;
  router: ReturnType<typeof useRouter>;
}) {
  const { title, setTitle, content, setContent, files, setFiles, onSave } = useNoteEditor(
    {
      id: note.id,
      title: note.title,
      content: note.content,
      files: note.files.map((f) => ({
        id: f.id,
        originalName: f.originalName,
        mimetype: '',
        size: 0,
        url: f.url,
        uploadedAt: '',
      })),
    },
    async ({ id: noteId, title: t, content: c, fileIds }) => {
      await client.notes.update({ id: noteId, title: t, content: c, fileIds });
    },
  );

  const handleDetach = async (fileId: string) => {
    const nextFiles = files.filter((item) => item.id !== fileId);
    setFiles(nextFiles);
    await client.notes.update({
      id: note.id,
      title: title || null,
      content,
      fileIds: nextFiles.map((item) => item.id),
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(protected)/(tabs)/' as RelativePathString)}>
          <Text color="text-secondary">BACK</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/(protected)/(tabs)/chat/${note.id}` as RelativePathString)}
        >
          <Text color="foreground">CHAT</Text>
        </Pressable>
      </View>

      <TextInput
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          void onSave(value, content, files.map((f) => f.id));
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
          void onSave(title, value, files.map((f) => f.id));
        }}
        placeholder="Start writing..."
        placeholderTextColor={theme.colors['text-tertiary']}
        style={styles.contentInput}
      />

      <View style={styles.filesSection}>
        <Text variant="cardHeader" color="foreground">
          FILES
        </Text>
        {files.map((file) => (
          <View key={file.id} style={styles.fileCard}>
            <Text color="foreground">{file.originalName}</Text>
            <Pressable onPress={() => void handleDetach(file.id)}>
              <Text color="text-secondary">DETACH</Text>
            </Pressable>
          </View>
        ))}
      </View>
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
    paddingBottom: COMPOSER_CLEARANCE,
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

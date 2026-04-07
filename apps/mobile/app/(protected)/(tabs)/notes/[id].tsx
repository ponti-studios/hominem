import { useApiClient } from '@hominem/rpc/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text, theme } from '~/theme';
import { useNoteQuery } from '~/utils/services/notes/use-note-query';

const COMPOSER_CLEARANCE = 240;

export default function NoteDetailScreen() {
  const router = useRouter();
  const client = useApiClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const noteId = String(id ?? '');
  const { data: note } = useNoteQuery({ noteId, enabled: noteId.length > 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!note) {
    return null;
  }

  return (
    <NoteDetailEditor
      key={note.id}
      note={note}
      client={client}
      router={router}
      debounceRef={debounceRef}
    />
  );
}

function NoteDetailEditor({
  note,
  client,
  router,
  debounceRef,
}: {
  note: NonNullable<ReturnType<typeof useNoteQuery>['data']>;
  client: ReturnType<typeof useApiClient>;
  router: ReturnType<typeof useRouter>;
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const [title, setTitle] = useState(note.title ?? '');
  const [content, setContent] = useState(note.content);
  const [files, setFiles] = useState<Array<{ id: string; originalName: string; url: string }>>(
    note.files.map((file) => ({ id: file.id, originalName: file.originalName, url: file.url })),
  );

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

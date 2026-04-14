import { useNoteEditor } from '@hominem/hooks';
import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Text, theme } from '~/components/theme';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { noteKeys } from '~/services/notes/query-keys';
import { useNoteQuery } from '~/services/notes/use-note-query';

const COMPOSER_CLEARANCE = 220;


export default function NoteDetailScreen() {
  const router = useRouter();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { requestTopReveal } = useTopAnchoredFeed();
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
      onSaved={(updatedNote) => {
        queryClient.setQueryData<Note>(noteKeys.detail(updatedNote.id), updatedNote);
        queryClient.setQueryData<Note[]>(noteKeys.all, (current) => {
          if (!current) return [updatedNote];
          return current.map((n) => (n.id === updatedNote.id ? updatedNote : n));
        });
        requestTopReveal();
        void queryClient.invalidateQueries({ queryKey: noteKeys.feeds() });
      }}
    />
  );
}


function NoteDetailEditor({
  note,
  client,
  router,
  onSaved,
}: {
  note: NonNullable<ReturnType<typeof useNoteQuery>['data']>;
  client: ReturnType<typeof useApiClient>;
  router: ReturnType<typeof useRouter>;
  onSaved: (updatedNote: Note) => void;
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
      const updatedNote = await client.notes.update({ id: noteId, title: t, content: c, fileIds });
      onSaved(updatedNote);
    },
  );

  const handleDetach = async (fileId: string) => {
    const nextFiles = files.filter((item) => item.id !== fileId);
    setFiles(nextFiles);
    const updatedNote = await client.notes.update({
      id: note.id,
      title: title || null,
      content,
      fileIds: nextFiles.map((item) => item.id),
    });
    onSaved(updatedNote);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() =>
                router.push(`/(protected)/(tabs)/chat/${note.id}` as RelativePathString)
              }
              hitSlop={8}
              accessibilityLabel="Open chat for this note"
              accessibilityRole="button"
            >
              <Image
                source="sf:bubble.left"
                style={styles.headerIcon}
                tintColor={theme.colors.foreground}
                contentFit="contain"
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          value={title ?? ''}
          onChangeText={(value) => {
            setTitle(value);
            void onSave(value, content, files.map((f) => f.id));
          }}
          placeholder="Title"
          placeholderTextColor={theme.colors['text-tertiary']}
          style={styles.titleInput}
          returnKeyType="next"
          blurOnSubmit={false}
          accessibilityLabel="Note title"
        />

        <View style={styles.divider} />

        <TextInput
          multiline
          value={content}
          onChangeText={(value) => {
            setContent(value);
            void onSave(title, value, files.map((f) => f.id));
          }}
          placeholder="Start writing…"
          placeholderTextColor={theme.colors['text-tertiary']}
          style={styles.contentInput}
          textAlignVertical="top"
          scrollEnabled={false}
          accessibilityLabel="Note content"
        />

        {files.length > 0 && (
          <View style={styles.filesSection}>
            <Text style={styles.filesLabel}>Attachments</Text>
            <View style={styles.filesList}>
              {files.map((file) => (
                <View key={file.id} style={styles.filePill}>
                  <Image
                    source="sf:paperclip"
                    style={styles.filePillIcon}
                    tintColor={theme.colors['text-secondary']}
                    contentFit="contain"
                  />
                  <Text style={styles.filePillName} numberOfLines={1}>
                    {file.originalName}
                  </Text>
                  <Pressable
                    onPress={() => void handleDetach(file.id)}
                    hitSlop={8}
                    accessibilityLabel={`Remove ${file.originalName}`}
                    accessibilityRole="button"
                  >
                    <Image
                      source="sf:xmark"
                      style={styles.filePillDetach}
                      tintColor={theme.colors['text-tertiary']}
                      contentFit="contain"
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: COMPOSER_CLEARANCE,
  },
  headerIcon: {
    width: 22,
    height: 22,
  },

  titleInput: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 34,
    color: theme.colors.foreground,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: 12,
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors['border-subtle'],
    marginBottom: 16,
  },

  contentInput: {
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: -0.1,
    color: theme.colors.foreground,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 240,
  },

  filesSection: {
    marginTop: 24,
    gap: 8,
  },
  filesLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
    color: theme.colors['text-tertiary'],
    textTransform: 'uppercase',
  },
  filesList: {
    gap: 6,
  },
  filePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors['bg-elevated'],
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  filePillIcon: {
    width: 14,
    height: 14,
    flexShrink: 0,
  },
  filePillName: {
    flex: 1,
    fontSize: 13,
    color: theme.colors['text-secondary'],
  },
  filePillDetach: {
    width: 12,
    height: 12,
  },
});

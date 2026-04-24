import type { MarkdownStyle } from '@expensify/react-native-live-markdown';
import { MarkdownTextInput } from '@expensify/react-native-live-markdown';
import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useLayoutEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { parseNoteMarkdown } from '~/components/notes/note-markdown-parser';
import { NOTE_TOOLBAR_ID, NoteToolbar } from '~/components/notes/NoteToolbar';
import { Text, makeStyles } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { TextField } from '~/components/ui/TextField';
import { useNoteEditor } from '~/hooks/use-note-editor';
import { useNoteToolbar } from '~/hooks/use-note-toolbar';
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
          return current.map((entry) => (entry.id === updatedNote.id ? updatedNote : entry));
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
  const styles = useNoteStyles();
  const themeColors = useThemeColors();
  const navigation = useNavigation();
  const contentInputRef = useRef<React.ComponentRef<typeof MarkdownTextInput>>(null);

  const { title, setTitle, content, setContent, files, setFiles, onSave } = useNoteEditor(
    {
      id: note.id,
      title: note.title,
      content: note.content,
      files: note.files.map((file) => ({
        id: file.id,
        originalName: file.originalName,
        mimetype: '',
        size: 0,
        url: file.url,
        uploadedAt: '',
      })),
    },
    async ({ id: noteId, title: nextTitle, content: nextContent, fileIds }) => {
      const res = await client.api.notes[':id'].$patch({
        param: { id: noteId },
        json: { title: nextTitle, content: nextContent, fileIds },
      });
      const updatedNote = await res.json();
      onSaved(updatedNote);
    },
  );

  const toolbar = useNoteToolbar({
    content,
    onContentChange: (newText) => {
      setContent(newText);
      void onSave(
        title,
        newText,
        files.map((file) => file.id),
      );
    },
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title?.trim() || note.title || 'Note',
      headerRight: () => (
        <Pressable
          accessibilityLabel="Open chat for this note"
          hitSlop={10}
          onPress={() => router.push(`/(protected)/(tabs)/chat/${note.id}`)}
          style={styles.headerButton}
        >
          <Image
            source="sf:bubble.left"
            style={styles.headerIcon}
            tintColor={themeColors.foreground}
            contentFit="contain"
          />
        </Pressable>
      ),
    });
  }, [
    navigation,
    note.id,
    note.title,
    router,
    styles.headerButton,
    styles.headerIcon,
    themeColors.foreground,
    title,
  ]);

  const markdownStyle: MarkdownStyle = {
    syntax: { color: themeColors['text-tertiary'] },
    h1: { fontSize: 22 },
    code: {
      color: themeColors['text-secondary'],
      backgroundColor: themeColors['bg-surface'],
      borderColor: themeColors['border-default'],
      borderWidth: 1,
      borderRadius: 4,
      borderStyle: 'solid',
      padding: 2,
    },
  };

  const handleDetach = async (fileId: string) => {
    const nextFiles = files.filter((file) => file.id !== fileId);
    setFiles(nextFiles);
    const res = await client.api.notes[':id'].$patch({
      param: { id: note.id },
      json: { title: title || null, content, fileIds: nextFiles.map((file) => file.id) },
    });
    const updatedNote = await res.json();
    onSaved(updatedNote);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <TextField
          variant="plain"
          size="lg"
          value={title ?? ''}
          onChangeText={(value) => {
            setTitle(value);
            void onSave(
              value,
              content,
              files.map((file) => file.id),
            );
          }}
          placeholder="Title"
          returnKeyType="next"
          submitBehavior="newline"
          containerStyle={styles.titleContainer}
        />

        <View style={styles.divider} />

        <MarkdownTextInput
          ref={contentInputRef}
          multiline
          value={content}
          selection={toolbar.controlledSelection}
          onChangeText={(value) => {
            setContent(value);
            toolbar.onTypingChange(value);
            void onSave(
              title,
              value,
              files.map((file) => file.id),
            );
          }}
          onSelectionChange={toolbar.onSelectionChange}
          placeholder="Start writing…"
          placeholderTextColor={themeColors['text-tertiary']}
          cursorColor={themeColors.accent}
          selectionColor={themeColors.accent}
          style={styles.contentInput}
          textAlignVertical="top"
          scrollEnabled={false}
          accessibilityLabel="Note content"
          parser={parseNoteMarkdown}
          markdownStyle={markdownStyle}
          inputAccessoryViewID={NOTE_TOOLBAR_ID}
        />

        {files.length > 0 ? (
          <View style={styles.filesSection}>
            <Text style={styles.filesLabel}>Attachments</Text>
            <View style={styles.filesList}>
              {files.map((file) => (
                <View key={file.id} style={styles.filePill}>
                  <Image
                    source="sf:paperclip"
                    style={styles.filePillIcon}
                    tintColor={themeColors['text-secondary']}
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
                      tintColor={themeColors['text-tertiary']}
                      contentFit="contain"
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <NoteToolbar
        onAction={toolbar.applyFormat}
        onUndo={toolbar.undo}
        onRedo={toolbar.redo}
        canUndo={toolbar.canUndo}
        canRedo={toolbar.canRedo}
      />
    </>
  );
}

const useNoteStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: COMPOSER_CLEARANCE,
  },
  headerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 36,
  },
  headerIcon: {
    height: 18,
    width: 18,
  },
  titleContainer: {
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
}));

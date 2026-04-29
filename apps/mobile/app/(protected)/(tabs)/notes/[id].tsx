import type { MarkdownStyle } from '@expensify/react-native-live-markdown';
import { MarkdownTextInput, parseExpensiMark } from '@expensify/react-native-live-markdown';
import { Host as SwiftUIHost, TextField as SwiftUITextField } from '@expo/ui/swift-ui';
import { font, frame, submitLabel, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { spacing } from '@hominem/ui/tokens';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { EnhanceModal } from '~/components/notes/EnhanceModal';
import { NOTE_TOOLBAR_ID, NoteToolbar } from '~/components/notes/NoteToolbar';
import { Text, makeStyles, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useNoteEditor } from '~/hooks/use-note-editor';
import { useNoteToolbar } from '~/hooks/use-note-toolbar';
import { useNoteQuery } from '~/services/notes/use-note-query';
import t from '~/translations';

const COMPOSER_CLEARANCE = 220;

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const noteId = String(id ?? '');
  if (!noteId) return null;
  return <NoteDetailEditor key={noteId} noteId={noteId} />;
}

function NoteDetailEditor({ noteId }: { noteId: string }) {
  const styles = useNoteStyles();
  const themeColors = useThemeColors();
  const navigation = useNavigation();
  const router = useRouter();
  const contentInputRef = useRef<React.ComponentRef<typeof MarkdownTextInput>>(null);
  const [enhanceModalVisible, setEnhanceModalVisible] = useState(false);

  const { data: note } = useNoteQuery({ noteId });
  const { save, updateCache, detachFile } = useNoteEditor(noteId);

  const toolbar = useNoteToolbar({
    content: note?.content ?? '',
    onContentChange: (newText) => {
      updateCache({ content: newText });
      void save(
        note?.title ?? null,
        newText,
        (note?.files ?? []).map((f) => f.id),
      );
    },
  });

  const dateline = useMemo(() => {
    if (!note?.updatedAt) return '';
    const date = new Date(note.updatedAt);
    return date.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [note?.updatedAt]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: note?.title?.trim() || t.notes.editor.titleFallback,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Pressable
            hitSlop={6}
            onPress={() => setEnhanceModalVisible(true)}
            style={({ pressed }) => ({
              alignItems: 'center',
              height: 36,
              justifyContent: 'center',
              opacity: pressed ? 0.65 : 1,
              width: 36,
            })}
          >
            <AppIcon name="wand.and.sparkles" />
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={() => router.push(`/(protected)/(tabs)/chat/${noteId}`)}
            style={({ pressed }) => ({
              alignItems: 'center',
              height: 36,
              justifyContent: 'center',
              opacity: pressed ? 0.65 : 1,
              width: 36,
            })}
          >
            <AppIcon name="bubble.left" />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, noteId, note?.title, router]);

  if (!note) return null;

  const markdownStyle: MarkdownStyle = {
    syntax: { color: themeColors['text-tertiary'] },
    h1: { fontSize: 26 },
    blockquote: {
      borderColor: themeColors.accent,
      borderWidth: 3,
      marginLeft: 0,
      paddingLeft: 14,
    },
    code: {
      color: themeColors['text-secondary'],
      backgroundColor: themeColors['bg-surface'],
      borderColor: themeColors['border-default'],
      borderWidth: 1,
      borderRadius: 4,
      borderStyle: 'solid',
      padding: 2,
    },
    pre: {
      color: themeColors['text-secondary'],
      backgroundColor: themeColors['bg-surface'],
      borderColor: themeColors['border-default'],
      borderWidth: 1,
      borderRadius: 8,
      borderStyle: 'solid',
      padding: 12,
    },
    link: { color: themeColors.accent },
  };

  const handleDetach = (fileId: string) => detachFile(fileId, note.files, note.title, note.content);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <SwiftUIHost matchContents style={styles.titleHost}>
          <SwiftUITextField
            defaultValue={note.title ?? ''}
            placeholder={t.notes.editor.titlePlaceholder}
            onValueChange={(value) => {
              updateCache({ title: value });
              void save(
                value,
                note.content,
                note.files.map((f) => f.id),
              );
            }}
            modifiers={[
              textFieldStyle('plain'),
              font({ size: 26, weight: 'bold' }),
              submitLabel('next'),
              frame({ maxWidth: Number.POSITIVE_INFINITY }),
            ]}
          />
        </SwiftUIHost>

        <Text variant="overline" style={styles.dateline}>
          {dateline}
        </Text>

        <View style={styles.divider} />

        <MarkdownTextInput
          ref={contentInputRef}
          multiline
          value={note.content}
          selection={toolbar.controlledSelection}
          onChangeText={(value) => {
            updateCache({ content: value });
            toolbar.onTypingChange(value);
            void save(
              note.title,
              value,
              note.files.map((f) => f.id),
            );
          }}
          onSelectionChange={toolbar.onSelectionChange}
          placeholder={t.notes.editor.contentPlaceholder}
          placeholderTextColor={themeColors['text-tertiary']}
          cursorColor={themeColors.accent}
          selectionColor={themeColors.accent}
          style={styles.contentInput}
          textAlignVertical="top"
          scrollEnabled={false}
          accessibilityLabel={t.notes.editor.contentA11yLabel}
          parser={parseExpensiMark}
          markdownStyle={markdownStyle}
          inputAccessoryViewID={NOTE_TOOLBAR_ID}
        />

        {note.files.length > 0 ? (
          <View style={styles.filesSection}>
            <Text style={styles.filesLabel}>{t.notes.editor.attachments}</Text>
            <View style={styles.filesList}>
              {note.files.map((file) => (
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
                    accessibilityLabel={t.notes.editor.removeFile(file.originalName)}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => void handleDetach(file.id)}
                    style={({ pressed }) => [
                      styles.filePillDetachButton,
                      pressed ? styles.filePillDetachButtonPressed : null,
                    ]}
                  >
                    <AppIcon name="xmark" size={12} tintColor={themeColors['text-tertiary']} />
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

      <EnhanceModal
        noteId={noteId}
        visible={enhanceModalVisible}
        onClose={() => setEnhanceModalVisible(false)}
      />
    </>
  );
}

const useNoteStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: COMPOSER_CLEARANCE,
  },
  titleHost: {
    alignSelf: 'stretch',
    marginBottom: 6,
  },
  dateline: {
    color: theme.colors['text-tertiary'],
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors['border-subtle'],
    marginBottom: 20,
  },
  contentInput: {
    fontSize: 17,
    lineHeight: 28,
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
  filePillDetachButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  filePillDetachButtonPressed: {
    opacity: 0.65,
  },
}));

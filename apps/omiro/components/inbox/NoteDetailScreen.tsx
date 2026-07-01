import { parseInboxTimestamp } from '@hominem/chat';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { NOTE_TOOLBAR_ID, NoteToolbar } from '~/components/notes/NoteToolbar';
import { Text, makeStyles, useThemeColors } from '~/components/theme';
import { EmptyState } from '~/components/ui/EmptyState';
import AppIcon from '~/components/ui/icon';
import { useNoteEditor } from '~/hooks/use-note-editor';
import { useNoteToolbar } from '~/hooks/use-note-toolbar';
import { useInlineEnhance } from '~/services/ai';
import { useNoteDelete } from '~/services/notes/use-note-delete';
import { useNoteQuery } from '~/services/notes/use-note-query';
import { writeResumeTarget } from '~/services/navigation/launch-state';
import { getInboxRoute } from '~/services/navigation/routes';
import t from '~/translations';

const COMPOSER_CLEARANCE = 220;

function formatNoteDateline(
  note: { createdAt?: string | null; updatedAt?: string | null } | null,
): string {
  const timestamp = note?.updatedAt ?? note?.createdAt;
  if (!timestamp) {
    return '';
  }

  try {
    const date = parseInboxTimestamp(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function NoteDetailPlaceholder() {
  const styles = useNoteStyles();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.placeholderTitle} />
      <View style={styles.placeholderDateline} />
      <View style={styles.divider} />
      <View style={styles.placeholderBody}>
        {Array.from({ length: 6 }, (_, index) => (
          <View
            key={`note-placeholder-line-${index.toString()}`}
            style={[styles.placeholderLine, index === 5 ? styles.placeholderLineShort : null]}
          />
        ))}
      </View>
    </ScrollView>
  );
}

export function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const noteId = String(id ?? '');
  if (!noteId) {
    return null;
  }

  return <NoteDetailEditor key={noteId} noteId={noteId} />;
}

function NoteDetailEditor({ noteId }: { noteId: string }) {
  const styles = useNoteStyles();
  const themeColors = useThemeColors();
  const navigation = useNavigation();
  const router = useRouter();
  const contentInputRef = useRef<TextInput>(null);
  const homeRoute = getInboxRoute();
  const [titleInputHeight, setTitleInputHeight] = useState(36);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const canGoBack = navigation.canGoBack();

  const { data: note, error, isInitialLoading, isRefreshing, refetch } = useNoteQuery({ noteId });
  const { save, updateCache, detachFile } = useNoteEditor(noteId);
  const { mutate: deleteNote } = useNoteDelete({ noteId });
  const {
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
  } = useInlineEnhance();

  useEffect(() => {
    if (!note) {
      return;
    }

    writeResumeTarget({
      kind: 'note',
      id: noteId,
      title: note.title?.trim() || t.notes.editor.titleFallback,
      updatedAt: note.updatedAt ?? null,
    });
  }, [note, noteId]);

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

  const dateline = formatNoteDateline(note ?? null);

  const handleDeleteNote = useCallback(() => {
    Alert.alert(t.inbox.item.deleteNote.title, t.inbox.item.deleteNote.message, [
      { text: t.inbox.item.deleteNote.cancel, style: 'cancel' },
      {
        text: t.inbox.item.deleteNote.confirm,
        style: 'destructive',
        onPress: () => {
          deleteNote(undefined, {
            onSuccess: () => router.replace(homeRoute),
          });
        },
      },
    ]);
  }, [deleteNote, homeRoute, router]);

  if (isInitialLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '',
            headerTitle: () => null,
            headerBackButtonDisplayMode: 'minimal',
            headerBackVisible: canGoBack,
          }}
        />
        {!canGoBack ? (
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="chevron.left" onPress={() => router.replace(homeRoute)}>
              Inbox
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        ) : null}
        <NoteDetailPlaceholder />
      </>
    );
  }

  if (!note) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '',
            headerTitle: () => null,
            headerBackButtonDisplayMode: 'minimal',
            headerBackVisible: canGoBack,
          }}
        />
        {!canGoBack ? (
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="chevron.left" onPress={() => router.replace(homeRoute)}>
              Inbox
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        ) : null}
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void refetch();
              }}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            action={{ label: t.notes.editor.loadErrorRetry, onPress: () => void refetch() }}
            description={
              error ? t.notes.editor.loadErrorMessage : t.notes.editor.missingNoteMessage
            }
            sfSymbol="arrow.clockwise.circle"
            title={error ? t.notes.editor.loadErrorTitle : t.notes.editor.missingNoteTitle}
          />
        </ScrollView>
      </>
    );
  }

  const handleDetach = (fileId: string) => detachFile(fileId, note.files, note.title, note.content);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerTitle: () => null,
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: canGoBack,
        }}
      />
      {!canGoBack ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="chevron.left" onPress={() => router.replace(homeRoute)}>
            Inbox
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={isPreviewing ? t.notes.editor.editMode : t.notes.editor.previewMode}
          icon={isPreviewing ? 'pencil' : 'eye'}
          onPress={() => setIsPreviewing((current) => !current)}
        />
        <Stack.Toolbar.Menu accessibilityLabel={t.notes.editor.actionsLabel} icon="ellipsis.circle">
          <Stack.Toolbar.MenuAction icon="sparkles" onPress={toggleEnhance}>
            {t.enhance.confirm}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction destructive icon="trash" onPress={handleDeleteNote}>
            {t.inbox.item.deleteNote.title}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          multiline
          defaultValue={note.title ?? ''}
          onContentSizeChange={(event) => {
            const nextHeight = Math.max(36, Math.min(120, event.nativeEvent.contentSize.height));
            setTitleInputHeight((current) => (current === nextHeight ? current : nextHeight));
          }}
          onChangeText={(value) => {
            updateCache({ title: value });
            void save(
              value,
              note.content,
              note.files.map((f) => f.id),
            );
          }}
          placeholder={t.notes.editor.titlePlaceholder}
          placeholderTextColor={themeColors['text-tertiary']}
          scrollEnabled={false}
          selectionColor={themeColors.accent}
          style={[
            styles.titleInput,
            {
              height: titleInputHeight,
            },
          ]}
          testID="note-title-input"
          textAlignVertical="top"
        />

        <Text variant="overline" style={styles.dateline}>
          {dateline}
        </Text>

        <View style={styles.divider} />

        {isPreviewing ? (
          note.content.trim().length > 0 ? (
            <Markdown style={markdownStyles(themeColors)}>{note.content}</Markdown>
          ) : (
            <Text style={styles.previewEmpty}>{t.notes.editor.previewEmpty}</Text>
          )
        ) : (
          <TextInput
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
            inputAccessoryViewID={NOTE_TOOLBAR_ID}
          />
        )}

        {isEnhanceOpen ? (
          <InlineEnhanceTray
            instruction={enhanceInstruction}
            onInstructionChange={setEnhanceInstruction}
            onCancel={closeEnhance}
            onConfirm={() =>
              void runEnhance({
                text: note.content,
                onEnhanced: (enhanced) => {
                  updateCache({ content: enhanced });
                  toolbar.onTypingChange(enhanced);
                  void save(
                    note.title,
                    enhanced,
                    note.files.map((file) => file.id),
                  );
                },
              })
            }
            isEnhancing={isEnhancing}
            error={enhanceError}
          />
        ) : null}

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
  titleInput: {
    alignSelf: 'stretch',
    color: theme.colors.foreground,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 6,
    minHeight: 36,
    paddingVertical: 0,
  },
  placeholderTitle: {
    alignSelf: 'stretch',
    borderRadius: theme.borderRadii.sm,
    height: 32,
    marginBottom: 12,
    width: '72%',
  },
  placeholderDateline: {
    backgroundColor: theme.colors['border-faint'],
    borderRadius: theme.borderRadii.sm,
    height: 12,
    marginBottom: 14,
    width: '36%',
  },
  placeholderBody: {
    gap: 14,
    paddingTop: 4,
  },
  placeholderLine: {
    backgroundColor: theme.colors['border-faint'],
    borderRadius: theme.borderRadii.sm,
    height: 16,
    width: '100%',
  },
  placeholderLineShort: {
    width: '58%',
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
  previewEmpty: {
    color: theme.colors['text-tertiary'],
    fontStyle: 'italic',
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

function markdownStyles(colors: ReturnType<typeof useThemeColors>) {
  return {
    body: { color: colors.foreground, fontSize: 17, lineHeight: 28 },
    heading1: { color: colors.foreground, fontSize: 24, fontWeight: '700' as const, marginTop: 12 },
    heading2: { color: colors.foreground, fontSize: 20, fontWeight: '700' as const, marginTop: 10 },
    heading3: { color: colors.foreground, fontSize: 18, fontWeight: '600' as const, marginTop: 8 },
    strong: { color: colors.foreground, fontWeight: '700' as const },
    em: { color: colors.foreground, fontStyle: 'italic' as const },
    link: { color: colors.accent, textDecorationLine: 'underline' as const },
    bullet_list: { marginVertical: 6 },
    ordered_list: { marginVertical: 6 },
    code_inline: {
      color: colors.foreground,
      backgroundColor: colors['bg-elevated'],
      borderRadius: 4,
      fontFamily: 'Menlo',
      paddingHorizontal: 4,
    },
    code_block: {
      color: colors.foreground,
      backgroundColor: colors['bg-elevated'],
      borderRadius: 8,
      fontFamily: 'Menlo',
      padding: 12,
    },
    fence: {
      color: colors.foreground,
      backgroundColor: colors['bg-elevated'],
      borderRadius: 8,
      fontFamily: 'Menlo',
      padding: 12,
    },
    blockquote: {
      color: colors['text-secondary'],
      backgroundColor: 'transparent',
      borderColor: colors['border-subtle'],
      borderLeftWidth: 3,
      marginVertical: 6,
      paddingLeft: 12,
    },
    hr: { backgroundColor: colors['border-subtle'], height: 1, marginVertical: 12 },
  };
}

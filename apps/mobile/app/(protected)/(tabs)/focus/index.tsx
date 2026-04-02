import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LoadingFull } from '~/components/LoadingFull';
import { Text, theme } from '~/theme';
import { useCreateNote } from '~/utils/services/notes/use-create-note';
import { useNoteStream } from '~/utils/services/notes/use-note-stream';

export default function NotesScreen() {
  const router = useRouter();
  const { data: notes = [], isLoading, refetch, isRefetching } = useNoteStream();
  const createNote = useCreateNote();

  if (isLoading) {
    return <LoadingFull />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={undefined}
    >
      <View style={styles.header}>
        <View>
          <Text variant="cardHeader" color="foreground">
            NOTES
          </Text>
          <Text color="text-secondary">Capture text, files, and voice.</Text>
        </View>
        <Pressable
          style={styles.primaryButton}
          onPress={async () => {
            const note = await createNote.mutateAsync({ text: '' });
            router.push(`/(protected)/(tabs)/notes/${note.id}` as RelativePathString);
          }}
        >
          <Text color="foreground">NEW</Text>
        </Pressable>
      </View>

      {notes.map((note) => (
        <Pressable
          key={note.id}
          style={styles.card}
          onPress={() => router.push(`/(protected)/(tabs)/notes/${note.id}` as RelativePathString)}
        >
          <Text variant="body" color="foreground">
            {note.title || 'Untitled note'}
          </Text>
          <Text color="text-secondary" style={styles.preview}>
            {note.excerpt || note.content || 'No content yet.'}
          </Text>
          <Text color="text-tertiary">{note.files.length} files</Text>
        </Pressable>
      ))}

      {notes.length === 0 ? (
        <View style={styles.empty}>
          <Text color="foreground">No notes yet.</Text>
          <Text color="text-secondary">Create one and start capturing.</Text>
        </View>
      ) : null}

      {isRefetching ? (
        <Pressable style={styles.secondaryButton} onPress={() => void refetch()}>
          <Text color="text-secondary">REFRESHING…</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.secondaryButton} onPress={() => void refetch()}>
          <Text color="text-secondary">REFRESH</Text>
        </Pressable>
      )}
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
    gap: theme.spacing.sm_12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm_12,
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    paddingHorizontal: theme.spacing.m_16,
    paddingVertical: theme.spacing.sm_8,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm_8,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.m_16,
    gap: theme.spacing.xs_4,
  },
  preview: {
    minHeight: 20,
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.ml_24,
    gap: theme.spacing.xs_4,
    alignItems: 'center',
  },
});

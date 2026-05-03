import type { NoteSearchResult } from '@hominem/rpc/types';
import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { useComposerAttachments } from '~/components/composer/ComposerContext';
import type { ComposerSelectedNote } from '~/components/composer/composerState';
import { makeStyles, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

export { useComposerAttachments };

interface ComposerAccessoriesProps {
  selectedNotes: ComposerSelectedNote[];
  onRemoveNote: (noteId: string) => void;
  mentionSuggestions: NoteSearchResult[];
  onSelectMention: (note: NoteSearchResult) => void;
}

export function ComposerAccessories({
  selectedNotes,
  onRemoveNote,
  mentionSuggestions,
  onSelectMention,
}: ComposerAccessoriesProps) {
  return (
    <>
      <ComposerAttachmentRow />
      {selectedNotes.length > 0 && (
        <SelectionSummary selectedNotes={selectedNotes} onRemove={onRemoveNote} />
      )}
      {mentionSuggestions.length > 0 && (
        <MentionSuggestions suggestions={mentionSuggestions} onSelect={onSelectMention} />
      )}
    </>
  );
}

export function SelectionSummary({
  selectedNotes,
  onRemove,
}: {
  selectedNotes: ComposerSelectedNote[];
  onRemove: (noteId: string) => void;
}) {
  const themeColors = useThemeColors();
  const styles = useStyles();

  if (selectedNotes.length === 0) return null;

  return (
    <View style={styles.selectionRow}>
      {selectedNotes.map((note) => (
        <View key={note.id} style={styles.selectionChip}>
          <AppIcon name="bubble.left" size={spacing[3]} tintColor={themeColors['text-secondary']} />
          <Animated.Text style={styles.selectionChipText}>
            {note.title || t.workspace.item.untitledNote}
          </Animated.Text>
          <Pressable
            accessibilityLabel={t.chat.input.removeNoteA11y(
              note.title ?? t.workspace.item.untitled,
            )}
            accessibilityRole="button"
            hitSlop={spacing[2]}
            onPress={() => onRemove(note.id)}
            style={({ pressed }) => [
              styles.selectionChipButton,
              pressed ? styles.selectionChipButtonPressed : null,
            ]}
          >
            <AppIcon name="xmark" size={spacing[2] + 2} tintColor={themeColors['text-secondary']} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function MentionSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: NoteSearchResult[];
  onSelect: (note: NoteSearchResult) => void;
}) {
  const styles = useStyles();

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.suggestions}>
      {suggestions.map((note) => (
        <Pressable
          key={note.id}
          accessibilityLabel={t.chat.input.linkNoteA11y(note.title ?? t.workspace.item.untitled)}
          accessibilityRole="button"
          onPress={() => onSelect(note)}
          style={({ pressed }) => [
            styles.suggestionItem,
            pressed ? styles.suggestionItemPressed : null,
          ]}
        >
          <Animated.Text style={styles.suggestionTitle}>
            {note.title || t.workspace.item.untitledNote}
          </Animated.Text>
          {note.excerpt ? (
            <Animated.Text numberOfLines={1} style={styles.suggestionExcerpt}>
              {note.excerpt}
            </Animated.Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  selectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  selectionChip: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  selectionChipButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: spacing[4],
    justifyContent: 'center',
    width: spacing[4],
  },
  selectionChipButtonPressed: {
    backgroundColor: theme.colors.background,
  },
  selectionChipText: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    lineHeight: 16,
  },
  suggestions: {
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestionItem: {
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  suggestionItemPressed: {
    backgroundColor: theme.colors.background,
  },
  suggestionTitle: {
    color: theme.colors.foreground,
    fontSize: 12,
    lineHeight: 16,
  },
  suggestionExcerpt: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    lineHeight: 16,
  },
}));

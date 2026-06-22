import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Text, fontFamiliesNative, fontSizes, makeStyles, spacing } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData } from './InboxStreamItem.types';

interface WorkspaceSearchModalProps {
  visible: boolean;
  searchQuery: string;
  searchInputRef: React.RefObject<TextInput | null>;
  results: InboxStreamItemData[];
  onClose: () => void;
  onChangeSearchQuery: (value: string) => void;
}

export function WorkspaceSearchModal({
  visible,
  searchQuery,
  searchInputRef,
  results,
  onClose,
  onChangeSearchQuery,
}: WorkspaceSearchModalProps) {
  const styles = useStyles();
  const hasQuery = searchQuery.trim().length > 0;
  const caption = useMemo(() => {
    if (!hasQuery) return t.workspace.home.searchEmpty;
    return t.workspace.home.searchResults(results.length);
  }, [hasQuery, results.length]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTapTarget} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t.workspace.home.searchTitle}</Text>
            <Pressable
              accessibilityLabel={t.workspace.home.closeSearch}
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <AppIcon name="xmark" size={16} tintColor={styles.closeIcon.color} />
            </Pressable>
          </View>

          <TextInput
            key={visible ? 'visible' : 'hidden'}
            ref={searchInputRef}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            value={searchQuery}
            placeholder={t.workspace.home.searchPlaceholder}
            placeholderTextColor={styles.inputPlaceholder.color}
            returnKeyType="search"
            selectionColor={styles.input.color}
            cursorColor={styles.input.color}
            style={styles.input}
            testID="home-search-input"
            onChangeText={onChangeSearchQuery}
          />

          <Text style={styles.caption}>{caption}</Text>

          <ScrollView
            contentContainerStyle={styles.resultsList}
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {results.map((item) => (
              <InboxStreamItem key={item.id} item={item} swipeEnabled={false} />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  backdrop: {
    backgroundColor: theme.colors['overlay-modal-medium'],
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[7],
  },
  backdropTapTarget: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  caption: {
    color: theme.colors['text-secondary'],
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.caption1,
  },
  closeButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  closeIcon: {
    color: theme.colors['text-secondary'],
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: 12,
    borderWidth: 1,
    color: theme.colors.foreground,
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.md,
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  inputPlaceholder: {
    color: theme.colors['text-tertiary'],
  },
  panel: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors['border-default'],
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    maxHeight: '84%',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  resultsList: {
    gap: 2,
    maxHeight: '72%',
  },
  title: {
    color: theme.colors.foreground,
    flex: 1,
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
}));

import type React from 'react';
import { Modal, Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { colors, fontSizes, radiiNative, spacing } from '~/components/theme/tokens';
import { fontFamiliesNative } from '~/components/theme/tokens/typography.native';
import { Text } from '../typography/Text';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import type { ChatRenderIcon } from '@hominem/chat';

interface ChatSearchModalProps {
  visible: boolean;
  searchQuery: string;
  resultCount: number;
  searchInputRef: React.RefObject<TextInput | null>;
  onClose: () => void;
  onChangeSearchQuery: (value: string) => void;
  renderIcon: ChatRenderIcon;
}

export function ChatSearchModal({
  visible,
  searchQuery,
  resultCount,
  searchInputRef,
  onClose,
  onChangeSearchQuery,
  renderIcon,
}: ChatSearchModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.searchBackdrop}>
        <View style={styles.searchPanel}>
          <View style={styles.searchPanelHeader}>
            <Text style={styles.searchTitle}>Search messages</Text>
            <Button
              accessibilityLabel="Close search"
              onPress={onClose}
              size="icon-xs"
              style={styles.headerIconButton}
              variant="ghost"
            >
              {renderIcon('xmark', { color: colors['text-tertiary'], size: 16 })}
            </Button>
          </View>

          <TextField
            containerStyle={styles.searchInputContainer}
            placeholder="Search messages..."
            ref={searchInputRef}
            returnKeyType="search"
            style={styles.searchInput}
            testID="chat-search-input"
            value={searchQuery}
            onChangeText={onChangeSearchQuery}
          />

          <Text color="text-tertiary" style={styles.searchResultCount}>
            {searchQuery.trim().length > 0
              ? `${resultCount} result${resultCount !== 1 ? 's' : ''}`
              : 'Search the current conversation'}
          </Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const SEARCH_PANEL_RADIUS = 24;

const styles = StyleSheet.create({
  headerIconButton: {
    backgroundColor: colors['bg-surface'],
    borderColor: colors['border-default'],
    borderRadius: radiiNative.md,
    height: 36,
    width: 36,
  },
  searchBackdrop: {
    backgroundColor: colors['overlay-modal-medium'],
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[7],
  },
  searchInput: {
    color: colors.foreground,
    fontFamily: fontFamiliesNative.mono,
    fontSize: fontSizes.sm,
    minHeight: 36,
    paddingVertical: spacing[2],
  },
  searchInputContainer: {
    width: '100%',
  },
  searchPanel: {
    backgroundColor: colors.background,
    borderColor: colors['border-default'],
    borderRadius: SEARCH_PANEL_RADIUS,
    borderWidth: 1,
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  searchPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'space-between',
  },
  searchResultCount: {
    fontFamily: fontFamiliesNative.mono,
    fontSize: fontSizes.xs,
  },
  searchTitle: {
    fontSize: 17,
    lineHeight: 24,
  },
});

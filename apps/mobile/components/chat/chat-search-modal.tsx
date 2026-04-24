import {
  Button as SwiftUIButton,
  HStack,
  Host as SwiftUIHost,
  Text as SwiftUIText,
  TextField as SwiftUITextField,
  VStack,
  type TextFieldRef,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  padding,
  submitLabel,
  textFieldStyle,
} from '@expo/ui/swift-ui/modifiers';
import type React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { makeStyles, spacing } from '~/components/theme';

interface ChatSearchModalProps {
  visible: boolean;
  searchQuery: string;
  resultCount: number;
  searchInputRef: React.RefObject<TextFieldRef | null>;
  onClose: () => void;
  onChangeSearchQuery: (value: string) => void;
}

export function ChatSearchModal({
  visible,
  searchQuery,
  resultCount,
  searchInputRef,
  onClose,
  onChangeSearchQuery,
}: ChatSearchModalProps) {
  const styles = useChatSearchStyles();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.searchBackdrop}>
        <View style={styles.searchPanel}>
          <SwiftUIHost matchContents style={styles.host}>
            <VStack spacing={12} modifiers={[padding({ horizontal: spacing[4], vertical: 4 })]}>
              <HStack spacing={spacing[2]}>
                <SwiftUIText
                  modifiers={[font({ size: 17, weight: 'semibold' }), frame({ maxWidth: 999 })]}
                >
                  Search messages
                </SwiftUIText>
                <SwiftUIButton
                  label=""
                  systemImage="xmark"
                  onPress={onClose}
                  modifiers={[buttonStyle('borderless')]}
                />
              </HStack>

              <SwiftUITextField
                key={visible ? 'visible' : 'hidden'}
                ref={searchInputRef}
                autoFocus
                defaultValue={searchQuery}
                placeholder="Search messages..."
                onValueChange={onChangeSearchQuery}
                modifiers={[
                  textFieldStyle('roundedBorder'),
                  submitLabel('search'),
                  frame({ maxWidth: Number.POSITIVE_INFINITY }),
                ]}
              />

              <SwiftUIText
                modifiers={[
                  font({ size: 12 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                {searchQuery.trim().length > 0
                  ? `${resultCount} result${resultCount !== 1 ? 's' : ''}`
                  : 'Search the current conversation'}
              </SwiftUIText>
            </VStack>
          </SwiftUIHost>
        </View>
      </Pressable>
    </Modal>
  );
}

const SEARCH_PANEL_RADIUS = 24;

const useChatSearchStyles = makeStyles((theme) => ({
  host: {
    alignSelf: 'stretch',
  },
  searchBackdrop: {
    backgroundColor: theme.colors['overlay-modal-medium'],
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[7],
  },
  searchPanel: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors['border-default'],
    borderRadius: SEARCH_PANEL_RADIUS,
    borderWidth: 1,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[4],
  },
}));

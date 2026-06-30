import { Button, GlassEffectContainer, Host, HStack, Menu, RNHostView } from '@expo/ui/swift-ui';
import { buttonStyle, glassEffect, padding } from '@expo/ui/swift-ui/modifiers';
import { Link } from 'expo-router';
import React, { memo, useCallback, useRef } from 'react';
import { Alert, Pressable, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';

import {
  Text,
  fontFamiliesNative,
  fontSizes,
  lineHeights,
  themeSpacing,
  makeStyles,
  useThemeColors,
} from '~/components/theme';
import { IconButton, SwipeAction } from '~/components/ui';
import { useChatArchive } from '~/services/chat/use-chat-archive';
import { useNoteDelete } from '~/services/notes/use-note-delete';
import t from '~/translations';

import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
  swipeEnabled?: boolean;
}

export const InboxStreamItem = memo(({ item, swipeEnabled = true }: InboxStreamItemProps) => {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const titleText = cleanText(item.title);
  const previewText = cleanText(item.preview);
  const primaryText = titleText ?? previewText ?? t.workspace.item.untitled;
  const isChat = item.kind === 'chat';

  const { mutate: deleteNote, isPending: isDeletingNote } = useNoteDelete({
    noteId: item.entityId,
  });
  const { mutate: archiveChat, isPending: isArchivingChat } = useChatArchive({
    chatId: item.entityId,
  });
  const isPending = isDeletingNote || isArchivingChat;

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    Alert.alert(t.workspace.item.deleteNote.title, t.workspace.item.deleteNote.message, [
      { text: t.workspace.item.deleteNote.cancel, style: 'cancel' },
      {
        text: t.workspace.item.deleteNote.confirm,
        style: 'destructive',
        onPress: () => deleteNote(),
      },
    ]);
  }, [deleteNote]);

  const handleArchive = useCallback(() => {
    swipeableRef.current?.close();
    archiveChat();
  }, [archiveChat]);

  const renderSwipeAction = useCallback(
    (progress: SharedValue<number>) => {
      return (
        <SwipeAction
          progress={progress}
          iconName={isChat ? 'archivebox' : 'trash'}
          onPress={isChat ? handleArchive : handleDelete}
          accessibilityLabel={
            isChat ? t.workspace.item.archive : t.workspace.item.deleteNote.confirm
          }
          backgroundColor={isChat ? themeColors.accent : themeColors.destructive}
          style={styles.swipeAction}
        />
      );
    },
    [isChat, handleArchive, handleDelete, styles, themeColors],
  );

  const row = (
    <View style={styles.row}>
      <Link href={item.route} disabled={isPending} asChild>
        <Link.Trigger withAppleZoom={isChat}>
          <Pressable
            accessibilityLabel={`${primaryText}, ${isChat ? 'Chat' : 'Note'}`}
            accessibilityRole="button"
            disabled={isPending}
            style={({ pressed }) => [styles.contentButton, pressed && styles.rowPressed]}
          >
            <View style={styles.titleRow}>
              <View style={styles.copyColumn}>
                <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                  {primaryText}
                </Text>
              </View>
            </View>
          </Pressable>
        </Link.Trigger>
      </Link>

      <Host style={styles.menuHost}>
        <Menu
          label={
            <GlassEffectContainer>
              <HStack
                modifiers={[
                  glassEffect({
                    glass: { variant: 'clear', interactive: true },
                    shape: 'roundedRectangle',
                    cornerRadius: 18,
                  }),
                  padding({ all: 2 }),
                ]}
              >
                <RNHostView matchContents>
                  <IconButton
                    accessibilityLabel={t.workspace.item.actionsLabel}
                    icon="ellipsis"
                    size={40}
                    iconSize={18}
                    style={styles.menuButton}
                    tintColor={themeColors['text-secondary']}
                  />
                </RNHostView>
              </HStack>
            </GlassEffectContainer>
          }
          modifiers={[buttonStyle('borderless')]}
        >
          <Button
            label={isChat ? t.workspace.item.archiveChat : t.workspace.item.deleteNote.title}
            role={isChat ? undefined : 'destructive'}
            onPress={isChat ? handleArchive : handleDelete}
          />
        </Menu>
      </Host>
    </View>
  );

  return (
    <View style={[styles.outer, isPending && styles.rowPending]} testID={`inbox-item-${item.kind}`}>
      {swipeEnabled ? (
        <ReanimatedSwipeable
          ref={swipeableRef}
          containerStyle={styles.swipeableContainer}
          childrenContainerStyle={styles.swipeableChildrenContainer}
          renderRightActions={renderSwipeAction}
          rightThreshold={60}
          friction={2}
          overshootRight={false}
          enableTrackpadTwoFingerGesture
        >
          {row}
        </ReanimatedSwipeable>
      ) : (
        row
      )}
    </View>
  );
});

InboxStreamItem.displayName = 'InboxStreamItem';

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

const useStyles = makeStyles((theme) => ({
  outer: {
    marginBottom: 10,
  },
  swipeableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  swipeableChildrenContainer: {
    borderRadius: 12,
  },
  row: {
    backgroundColor: theme.colors['bg-surface'],
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 14,
  },
  contentButton: {
    flex: 1,
    minHeight: 44,
  },
  rowPressed: {
    opacity: 0.64,
  },
  rowPending: {
    opacity: 0.45,
  },
  titleRow: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 15,
  },
  copyColumn: {
    flex: 1,
    gap: 2,
  },
  menuButton: {
    alignSelf: 'center',
    opacity: 0.72,
  },
  menuHost: {
    alignSelf: 'center',
    marginRight: themeSpacing.sm,
  },
  title: {
    color: theme.colors['text-primary'],
    fontSize: fontSizes.lg,
    fontFamily: fontFamiliesNative.primary,
    fontWeight: '400',
    lineHeight: lineHeights.body,
    letterSpacing: -0.25,
  },
  swipeAction: {
    height: '100%',
  },
}));

import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { contentShape, frame, shapes } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router/build/hooks';
import React, { memo, useCallback } from 'react';
import Reanimated, {
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';

import { useInboxItemActions } from '~/services/inbox/use-inbox-item-actions';

import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';
import { InboxStreamItemPresentation } from './InboxStreamItemPresentation';

// Exit animation duration
const EXIT_MS = 260;

interface InboxStreamItemProps {
  item: InboxStreamItemModel;
}

export const InboxStreamItem = memo(({ item }: InboxStreamItemProps) => {
  const router = useRouter();

  // ── Animation shared values ────────────────────────────────────────────────
  const exitProgress = useSharedValue(0);

  const animateExit = useCallback(
    (onComplete: () => void) => {
      exitProgress.value = withTiming(
        1,
        { duration: EXIT_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onComplete)();
        },
      );
    },
    [exitProgress],
  );

  const { handleDeleteNote, handleArchiveChat } = useInboxItemActions(item, animateExit);

  // ── Animated styles ────────────────────────────────────────────────────────
  // Merging entering + exit onto one wrapper drops a layout node per row.
  const exitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exitProgress.value, [0, 0.5, 1], [1, 0.6, 0]),
    transform: [{ translateX: interpolate(exitProgress.value, [0, 1], [0, 40]) }],
  }));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onPress = useCallback(() => {
    router.push(item.route);
  }, [item.route, router]);

  return (
    <>
      <Reanimated.View entering={FadeIn.duration(200)}>
        <Reanimated.View style={exitStyle} pointerEvents="box-none">
          <Host style={{ width: '100%' }}>
            <Menu
              label={<InboxStreamItemPresentation item={item} />}
              onPrimaryAction={onPress}
              modifiers={[
                frame({ maxWidth: Number.POSITIVE_INFINITY, alignment: 'leading' }),
                contentShape(shapes.rectangle()),
              ]}
            >
              {item.kind === 'note' ? (
                <Button
                  label="Delete"
                  role="destructive"
                  systemImage="trash"
                  onPress={handleDeleteNote}
                />
              ) : (
                <Button
                  label="Archive"
                  role="destructive"
                  systemImage="archivebox"
                  onPress={handleArchiveChat}
                />
              )}
            </Menu>
          </Host>
        </Reanimated.View>
      </Reanimated.View>
    </>
  );
});

InboxStreamItem.displayName = 'InboxStreamItem';

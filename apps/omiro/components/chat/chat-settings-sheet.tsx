import { BottomSheetModal, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChatReplyPicker,
  ChatReplyPrefsSection,
  type ChatReplyPickerKind,
} from '~/components/chat/chat-reply-prefs-section';
import { ChatSheetCloseButton } from '~/components/chat/chat-sheet-close-button';
import { useAppTheme, useStyles } from '~/components/theme';
import t from '~/translations';

interface ChatSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

type SheetView = 'settings' | ChatReplyPickerKind;

// One sheet for the chat settings and its pickers. Choosing a row swaps the sheet's content to that
// picker in place, so there is never a second sheet stacked on top.
export function ChatSettingsSheet({ visible, onClose }: ChatSettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const { border: borderDefault, background, foreground: textPrimary } = useAppTheme().colors;
  const styles = useStyles(() => ({
    sheetContent: { paddingHorizontal: 24 },
    stack: { gap: 24 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitle: { fontSize: 24, fontWeight: '800' },
  }));
  const modalRef = useRef<BottomSheetModal>(null);
  const [view, setView] = useState<SheetView>('settings');

  const handleDismiss = useCallback(() => {
    setView('settings');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      // Trigger is a chat actions menu item -- its
      // dismiss animation is still running when onPress fires, so presenting
      // the sheet right away just gets silently dropped by UIKit. Wait for
      // the menu to actually finish closing first.
      const timeout = setTimeout(() => {
        modalRef.current?.present();
      }, 100);
      return () => clearTimeout(timeout);
    }

    modalRef.current?.dismiss();
  }, [visible]);

  return (
    <BottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: borderDefault, width: 40, height: 4 }}
      backgroundStyle={{ backgroundColor: background }}
      onDismiss={handleDismiss}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]}
      >
        {view === 'settings' ? (
          <Animated.View key="settings" entering={FadeIn.duration(180)} style={styles.stack}>
            <View style={styles.titleRow}>
              <Text style={[styles.sheetTitle, { color: textPrimary }]}>
                {t.chat.settings.title}
              </Text>
              <ChatSheetCloseButton onPress={handleDismiss} label={t.chat.settings.close} />
            </View>
            <ChatReplyPrefsSection onOpen={setView} />
          </Animated.View>
        ) : (
          <Animated.View key={view} entering={SlideInRight.duration(240)}>
            <ChatReplyPicker kind={view} onClose={handleDismiss} />
          </Animated.View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useStyles } from '~/components/theme';

import { TimeComposer } from './TimeComposer';

export type TimeExtractionMode = 'text' | 'voice';

interface TimeExtractionSheetProps {
  initialMode: TimeExtractionMode;
  onClose: () => void;
  onOpenEvent: (event: { id: string }) => void;
  onTaskCreated: () => void;
  sessionKey: number;
  visible: boolean;
}

export function TimeExtractionSheet({
  initialMode,
  onClose,
  onOpenEvent,
  onTaskCreated,
  sessionKey,
  visible,
}: TimeExtractionSheetProps) {
  const insets = useSafeAreaInsets();
  const modalRef = useRef<BottomSheetModal>(null);
  const theme = useAppTheme();
  const snapPoints = useMemo(() => ['58%', '92%'], []);
  const styles = useStyles((currentTheme) => ({
    content: { gap: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 },
    title: { ...currentTheme.textVariants.title2, color: currentTheme.colors.foreground },
    description: {
      ...currentTheme.textVariants.footnote,
      color: currentTheme.colors.mutedForeground,
    },
  }));

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  }, [sessionKey, visible]);

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: theme.colors.border, width: 40, height: 4 }}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      onDismiss={onClose}
    >
      <BottomSheetView style={styles.content}>
        <View testID="time-extraction-sheet">
          <View>
            <Text style={styles.title}>What do you want to plan?</Text>
            <Text style={styles.description}>
              Ask about your schedule or turn an idea into a task.
            </Text>
          </View>
          <TimeComposer
            initialMode={initialMode}
            key={sessionKey}
            onClose={onClose}
            onOpenEvent={onOpenEvent}
            onTaskCreated={onTaskCreated}
            visible={visible}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

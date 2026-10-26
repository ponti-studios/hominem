import { BottomSheetModal, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useMemo, useRef } from 'react';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';
import t from '~/translations';

// Mounted only while open, so a long chat doesn't carry a sheet per message.
export function ChatReasoningSheet({
  reasoning,
  onClose,
}: {
  reasoning: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { background, border } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    content: { gap: 16, paddingHorizontal: 24 },
    title: { color: theme.colors.foreground, fontSize: 24, fontWeight: '800' },
    body: { ...theme.textVariants.mono, color: theme.colors.foreground, opacity: 0.85 },
  }));
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['60%', '90%'], []);

  useEffect(() => {
    modalRef.current?.present();
  }, []);

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: border, width: 40, height: 4 }}
      backgroundStyle={{ backgroundColor: background }}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={styles.title}>{t.chat.reasoning.title}</Text>
        <Text selectable style={styles.body}>
          {reasoning}
        </Text>
        <Button
          label={t.chat.reasoning.done}
          onPress={() => modalRef.current?.dismiss()}
          variant="secondary"
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

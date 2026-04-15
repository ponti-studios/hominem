import { useMemo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import AppIcon from '~/components/ui/icon';
import { Text, makeStyles, theme } from '~/components/theme';
import { VoiceInput } from '~/components/media/voice';

interface VoiceSessionModalProps {
  onClose: () => void;
  onAudioTranscribed: (transcription: string) => void;
  bottomSheetModalRef: React.RefObject<BottomSheetModal>;
}

export function VoiceSessionModal({
  onClose,
  onAudioTranscribed,
  bottomSheetModalRef,
}: VoiceSessionModalProps) {
  const styles = useStyles();
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const handleDismiss = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    onClose();
  }, [bottomSheetModalRef, onClose]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      handleIndicatorStyle={styles.dragHandle}
      backgroundStyle={styles.sheetBackground}
      onDismiss={handleDismiss}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.header}>
          <Text variant="footnote" color="text-secondary">
            Voice Input
          </Text>
          <Pressable
            onPress={handleDismiss}
            style={styles.closeButton}
            accessibilityLabel="Close voice input"
            accessibilityRole="button"
          >
            <AppIcon name="xmark" size={20} color={theme.colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <VoiceInput
            autoTranscribe
            onAudioTranscribed={(transcription) => {
              onAudioTranscribed(transcription);
              handleDismiss();
            }}
            onError={handleDismiss}
            style={styles.micButton}
          />
          <Text variant="caption1" color="text-secondary" style={styles.hint}>
            Tap to record · tap again to stop
          </Text>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    sheetBackground: {
      backgroundColor: t.colors.background,
    },
    dragHandle: {
      backgroundColor: t.colors['border-default'],
      width: 40,
      height: 4,
    },
    container: {
      paddingHorizontal: t.spacing.ml_24,
      paddingVertical: t.spacing.m_16,
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: t.spacing.l_32,
    },
    closeButton: {
      padding: t.spacing.xs_4,
    },
    body: {
      alignItems: 'center',
      gap: t.spacing.m_16,
    },
    micButton: {
      width: 72,
      height: 72,
      borderRadius: t.borderRadii.full,
    },
    hint: {
      textAlign: 'center',
    },
  }),
);

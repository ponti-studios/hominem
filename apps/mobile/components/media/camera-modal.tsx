import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { Text, theme } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

type CapturedPhoto = {
  uri: string;
  fileName?: string;
};

type CameraModalProps = {
  visible: boolean;
  onCapture: (photo: CapturedPhoto) => void;
  onClose: () => void;
};

export function CameraModal({ visible, onCapture, onClose }: CameraModalProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const device = useCameraDevice(facing);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const handleCapture = async () => {
    if (!cameraRef.current || isTakingPhoto || !device) return;

    setIsTakingPhoto(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePhoto();
      const uri = `file://${photo.path}`;
      const captured: CapturedPhoto = {
        uri,
        fileName: `photo_${Date.now()}.jpg`,
      };

      if (mediaPermission?.granted) {
        Alert.alert('Save photo?', 'Save this photo to your camera roll.', [
          { text: 'Skip', style: 'cancel', onPress: () => onCapture(captured) },
          {
            text: 'Save',
            onPress: async () => {
              await MediaLibrary.saveToLibraryAsync(uri);
              onCapture(captured);
            },
          },
        ]);
      } else {
        onCapture(captured);
      }
    } catch {
      Alert.alert('Camera error', 'Could not take photo. Please try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleRequestPermissions = async () => {
    await requestPermission();
    if (mediaPermission?.status === 'undetermined') {
      await requestMediaPermission();
    }
  };

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <BottomSheetModal
      snapPoints={snapPoints}
      enablePanDownToClose
      handleIndicatorStyle={styles.dragHandle}
      backgroundStyle={styles.sheetBackground}
      onDismiss={handleDismiss}
    >
      <BottomSheetView style={styles.container}>
        {hasPermission && device ? (
          <View style={styles.cameraContainer}>
            <Camera ref={cameraRef} style={styles.camera} device={device} isActive={visible} photo>
              <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
                <Pressable
                  onPress={handleDismiss}
                  style={styles.sideButton}
                  accessibilityLabel="Close camera"
                >
                  <AppIcon name="xmark" size={20} tintColor={theme.colors.white} />
                </Pressable>

                <Pressable
                  onPress={() => void handleCapture()}
                  disabled={isTakingPhoto}
                  style={[styles.captureButton, isTakingPhoto && styles.captureButtonDisabled]}
                  accessibilityLabel="Take photo"
                >
                  <View style={styles.captureInner} />
                </Pressable>

                <Pressable
                  onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                  style={styles.sideButton}
                  accessibilityLabel="Flip camera"
                >
                  <AppIcon name="camera.rotate" size={20} tintColor={theme.colors.white} />
                </Pressable>
              </View>
            </Camera>
          </View>
        ) : (
          <View style={styles.permissionContainer}>
            <Text variant="body" color="foreground">
              Camera access is required to take photos.
            </Text>
            <Pressable
              onPress={() => void handleRequestPermissions()}
              style={styles.permissionButton}
            >
              <Text variant="body" color="foreground">
                Grant permission
              </Text>
            </Pressable>
            <Pressable onPress={handleDismiss} style={styles.permissionCancel}>
              <Text variant="body" color="text-secondary">
                Cancel
              </Text>
            </Pressable>
          </View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: theme.colors.black,
  },
  dragHandle: {
    backgroundColor: theme.colors['border-default'],
    width: 40,
    height: 4,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.ml_24,
  },
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: theme.borderRadii.md,
    backgroundColor: theme.colors['overlay-modal-medium'],
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadii.sm,
    borderWidth: 4,
    borderColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadii.md,
    backgroundColor: theme.colors.white,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.m_16,
    paddingHorizontal: theme.spacing.ml_24,
  },
  permissionButton: {
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: theme.borderRadii.md,
    paddingHorizontal: theme.spacing.m_16,
    paddingVertical: theme.spacing.sm_8,
  },
  permissionCancel: {
    paddingHorizontal: theme.spacing.m_16,
    paddingVertical: theme.spacing.sm_8,
  },
});

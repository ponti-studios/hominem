import type { ReactNode } from 'react';
import type { ModalProps } from 'react-native';
import { Modal, Pressable, View } from 'react-native';

import { makeStyles, useThemeColors } from '~/components/theme';

export type ModalOverlayPosition = 'top' | 'center' | 'bottom';

interface ModalOverlayProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  position?: ModalOverlayPosition;
  dismissOnBackdropPress?: boolean;
  backdropToken?: 'overlay-modal-medium' | 'overlay-modal-high';
  animationType?: ModalProps['animationType'];
  statusBarTranslucent?: boolean;
}

export function ModalOverlay({
  visible,
  onClose,
  children,
  position = 'center',
  dismissOnBackdropPress = true,
  backdropToken = 'overlay-modal-medium',
  animationType = 'fade',
  statusBarTranslucent = false,
}: ModalOverlayProps) {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const Backdrop = dismissOnBackdropPress ? Pressable : View;

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent={statusBarTranslucent}
      transparent
      visible={visible}
    >
      <Backdrop
        onPress={dismissOnBackdropPress ? onClose : undefined}
        style={[styles.backdrop, { backgroundColor: themeColors[backdropToken] }, styles[position]]}
      >
        {children}
      </Backdrop>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  backdrop: {
    flex: 1,
  },
  top: {
    justifyContent: 'flex-start',
  },
  center: {
    justifyContent: 'center',
  },
  bottom: {
    justifyContent: 'flex-end',
  },
}));

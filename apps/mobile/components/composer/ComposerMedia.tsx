import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { Pressable } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { useComposerMediaActions } from '~/components/composer/useComposerMediaActions';
import { useComposerMediaMenu } from '~/components/composer/useComposerMediaMenu';
import { makeStyles, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { CameraModal } from '~/components/media/camera-modal';

const MEDIA_BTN_SIZE = spacing[5];
const MEDIA_BTN_ICON_SIZE = spacing[4] + 2;

interface ComposerMediaProps {
  accessibilityLabel: string;
  disabled?: boolean;
}

export function ComposerMedia({ accessibilityLabel, disabled = false }: ComposerMediaProps) {
  const context = useComposerContext();
  const themeColors = useThemeColors();
  const styles = useStyles();
  const { pickAttachment, handleCameraCapture } = useComposerMediaActions({
    attachments: context.attachments,
    setAttachments: context.setAttachments,
  });
  const { isCameraOpen, setIsCameraOpen, showPlusMenu } = useComposerMediaMenu({ pickAttachment });

  return (
    <>
      <Pressable
        onPress={showPlusMenu}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={spacing[2]}
        style={({ pressed }) => [
          styles.btn,
          disabled ? styles.btnDisabled : null,
          pressed ? styles.btnPressed : null,
        ]}
      >
        <AppIcon name="plus" size={MEDIA_BTN_ICON_SIZE} tintColor={themeColors['text-secondary']} />
      </Pressable>
      <CameraModal
        visible={isCameraOpen}
        onCapture={(photo) => {
          void handleCameraCapture(photo).finally(() => setIsCameraOpen(false));
        }}
        onClose={() => setIsCameraOpen(false)}
      />
    </>
  );
}

const useStyles = makeStyles((theme) => ({
  btn: {
    width: MEDIA_BTN_SIZE,
    height: MEDIA_BTN_SIZE,
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-faint'],
    borderWidth: 1,
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnPressed: {
    backgroundColor: theme.colors['bg-surface'],
  },
}));

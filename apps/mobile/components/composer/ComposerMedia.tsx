import { spacing } from '@hominem/ui/tokens';
import React, { useCallback, useState } from 'react';
import { ActionSheetIOS, Pressable } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { CameraModal } from '~/components/media/camera-modal';
import { makeStyles, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

const MEDIA_BTN_SIZE = spacing[6];
const MEDIA_BTN_ICON_SIZE = spacing[4] + 2;

interface ComposerMediaProps {
  accessibilityLabel: string;
  disabled?: boolean;
}

export function ComposerMedia({ accessibilityLabel, disabled = false }: ComposerMediaProps) {
  const { pickAttachment, handleCameraCapture } = useComposerContext();
  const themeColors = useThemeColors();
  const styles = useStyles();
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const showPlusMenu = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t.chat.input.actionSheet.cancel,
          t.chat.input.actionSheet.takePhoto,
          t.chat.input.actionSheet.chooseFromLibrary,
        ],
        cancelButtonIndex: 0,
      },
      (i) => {
        if (i === 1) setIsCameraOpen(true);
        else if (i === 2) void pickAttachment();
      },
    );
  }, [pickAttachment]);

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
        <AppIcon name="plus" size={MEDIA_BTN_ICON_SIZE} tintColor={themeColors['white']} />
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

const useStyles = makeStyles(() => ({
  btn: {
    width: MEDIA_BTN_SIZE,
    height: MEDIA_BTN_SIZE,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPressed: {
    opacity: 0.7,
  },
}));

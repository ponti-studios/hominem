import { spacing } from '@hominem/ui/tokens';
import React, { useCallback, useState } from 'react';
import { ActionSheetIOS } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { CameraModal } from '~/components/media/camera-modal';
import { fontSizes } from '~/components/theme';
import { IconButton } from '~/components/ui/icon-button';
import t from '~/translations';

const MEDIA_BTN_SIZE = fontSizes.lg + 6;
const MEDIA_BTN_ICON_SIZE = fontSizes.lg;

interface ComposerMediaProps {
  accessibilityLabel: string;
  disabled?: boolean;
}

export function ComposerMedia({ accessibilityLabel, disabled = false }: ComposerMediaProps) {
  const { pickAttachment, handleCameraCapture } = useComposerContext();
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
      <IconButton
        accessibilityLabel={accessibilityLabel}
        icon="plus"
        iconSize={MEDIA_BTN_ICON_SIZE}
        size={MEDIA_BTN_SIZE}
        variant="filled"
        circular
        disabled={disabled}
        disabledOpacity={0.5}
        pressedOpacity={0.7}
        hitSlop={spacing[2]}
        onPress={showPlusMenu}
      />
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

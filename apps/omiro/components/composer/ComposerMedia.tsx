import React, { useCallback, useState } from 'react';
import { ActionSheetIOS } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { CameraModal } from '~/components/media/camera-modal';
import { spacing } from '~/components/theme/ponti-tokens';
import { IconButton } from '~/components/ui/icon-button';
import t from '~/translations';

const MEDIA_BTN_SIZE = 38; // ToolBtn per composer spec
const MEDIA_BTN_ICON_SIZE = 20; // toolbar action icon size

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
        variant="surface"
        circular
        disabled={disabled}
        disabledOpacity={0.4}
        pressedOpacity={0.65}
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

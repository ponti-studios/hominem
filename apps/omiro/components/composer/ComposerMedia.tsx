import { Host, Circle } from '@expo/ui/swift-ui';
import { glassEffect } from '@expo/ui/swift-ui/modifiers';
import { spacing } from '@hominem/ui/tokens';
import React, { useCallback, useState } from 'react';
import { ActionSheetIOS, Platform, StyleSheet, View } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { CameraModal } from '~/components/media/camera-modal';
import { fontSizes } from '~/components/theme';
import { IconButton } from '~/components/ui/icon-button';
import t from '~/translations';

const MEDIA_BTN_SIZE = fontSizes.lg + 6;
const MEDIA_BTN_ICON_SIZE = fontSizes.lg;
const isGlassSupported = Platform.OS === 'ios';

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
      <View style={{ width: MEDIA_BTN_SIZE, height: MEDIA_BTN_SIZE }}>
        {isGlassSupported && !disabled ? (
          <Host style={StyleSheet.absoluteFill} pointerEvents="none">
            <Circle
              modifiers={[
                glassEffect({
                  glass: { variant: 'regular', interactive: true },
                  shape: 'circle',
                }),
              ]}
            />
          </Host>
        ) : null}
        <IconButton
          accessibilityLabel={accessibilityLabel}
          icon="plus"
          iconSize={MEDIA_BTN_ICON_SIZE}
          size={MEDIA_BTN_SIZE}
          variant={isGlassSupported ? undefined : 'filled'}
          circular
          disabled={disabled}
          disabledOpacity={0.5}
          pressedOpacity={0.7}
          hitSlop={spacing[2]}
          onPress={showPlusMenu}
        />
      </View>
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

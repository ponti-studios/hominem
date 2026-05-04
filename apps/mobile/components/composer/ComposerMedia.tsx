import { spacing } from '@hominem/ui/tokens';
import React, { useCallback, useState } from 'react';
import { ActionSheetIOS, Pressable } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { useComposerMediaActions } from '~/components/composer/useComposerMediaActions';
import { CameraModal } from '~/components/media/camera-modal';
import { makeStyles, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const { pickAttachment, handleCameraCapture } = useComposerMediaActions({
    attachments: context.attachments,
    setAttachments: context.setAttachments,
  });
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

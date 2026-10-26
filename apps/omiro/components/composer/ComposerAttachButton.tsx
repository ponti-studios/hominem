import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { CameraModal } from '~/components/media/camera-modal';
import { useAppTheme } from '~/components/theme';
import { IconButton } from '~/components/ui';
import { ActionSheet } from '~/components/ui/action-sheet';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

import { ComposerTrayChip } from './ComposerTrayChip';

interface ComposerAttachButtonProps {
  disabled: boolean;
  variant?: 'icon' | 'chip';
}

export function ComposerAttachButton({ disabled, variant = 'icon' }: ComposerAttachButtonProps) {
  const { pickAttachment, handleCameraCapture, isUploading } = useComposerContext();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { barForeground } = useAppTheme().colors;

  const isBlocked = disabled || isUploading;
  const a11yLabel = isUploading
    ? t.inboxComposer.composer.uploadingAttachmentA11y
    : t.inboxComposer.composer.addAttachmentA11y;

  const showMenu = useCallback(() => setIsMenuOpen(true), []);

  return (
    <>
      {variant === 'chip' ? (
        <ComposerTrayChip
          accessibilityLabel={a11yLabel}
          disabled={isBlocked}
          icon={isUploading ? 'arrow.up.circle' : 'plus'}
          label={t.inboxComposer.composer.attachLabel}
          testID="composer-attach-button"
          onPress={showMenu}
        />
      ) : (
        <IconButton
          accessibilityLabel={a11yLabel}
          disabled={isBlocked}
          style={{ width: 40, height: 40 }}
          testID="composer-attach-button"
          variant="plain"
          onPress={showMenu}
        >
          {isUploading ? (
            <ActivityIndicator color={barForeground} size="small" />
          ) : (
            <AppIcon name="plus" size={22} tintColor={barForeground} />
          )}
        </IconButton>
      )}
      <ActionSheet
        cancelLabel={t.chat.input.actionSheet.cancel}
        onClose={() => setIsMenuOpen(false)}
        options={[
          {
            key: 'take-photo',
            icon: 'camera',
            label: t.chat.input.actionSheet.takePhoto,
            onPress: () => setIsCameraOpen(true),
          },
          {
            key: 'library',
            icon: 'photo',
            label: t.chat.input.actionSheet.chooseFromLibrary,
            onPress: () => {
              void pickAttachment();
            },
          },
        ]}
        testID="composer-attach-menu"
        title={t.inboxComposer.composer.addAttachmentA11y}
        visible={isMenuOpen}
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

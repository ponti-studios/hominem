import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { CameraModal } from '~/components/media/camera-modal';
import { useAppTheme } from '~/components/theme';
import { IconButton } from '~/components/ui';
import { ActionSheet } from '~/components/ui/action-sheet';
import AppIcon from '~/components/ui/icon';
import { scanTextFromLibrary } from '~/services/system/scan-text';
import t from '~/translations';

import { ComposerTrayChip } from './ComposerTrayChip';

interface ComposerAttachButtonProps {
  disabled: boolean;
  // Receives the text read out of a photo (Scan Text). The option is hidden
  // where there is no composer to put the text in.
  onInsertText?: (text: string) => void;
  variant?: 'icon' | 'chip';
}

export function ComposerAttachButton({
  disabled,
  onInsertText,
  variant = 'icon',
}: ComposerAttachButtonProps) {
  const { pickAttachment, handleCameraCapture, isUploading } = useComposerContext();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { barForeground } = useAppTheme().colors;

  const isBlocked = disabled || isUploading;
  const a11yLabel = isUploading
    ? t.inboxComposer.composer.uploadingAttachmentA11y
    : t.inboxComposer.composer.addAttachmentA11y;

  const showMenu = useCallback(() => setIsMenuOpen(true), []);

  const scanText = useCallback(async () => {
    try {
      const text = await scanTextFromLibrary();
      if (text === null) {
        return;
      }
      if (text.trim()) {
        onInsertText?.(text);
      } else {
        Alert.alert(t.chat.input.scanText.emptyTitle, t.chat.input.scanText.emptyMessage);
      }
    } catch {
      Alert.alert(t.chat.input.scanText.failedTitle, t.chat.input.scanText.failedMessage);
    }
  }, [onInsertText]);

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
          ...(onInsertText
            ? [
                {
                  key: 'scan-text',
                  icon: 'text.viewfinder' as const,
                  label: t.chat.input.actionSheet.scanText,
                  onPress: () => {
                    void scanText();
                  },
                },
              ]
            : []),
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

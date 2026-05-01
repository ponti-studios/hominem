import { useApiClient } from '@hominem/rpc/react';
import { spacing } from '@hominem/ui/tokens';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, TextInput } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { canSubmitComposerDraft, getUploadedAttachmentIds } from '~/components/composer/composerActions';
import type { ComposerAttachment, ComposerSelectedNote } from '~/components/composer/composerState';
import { useComposerMediaActions } from '~/components/composer/useComposerMediaActions';
import { useTextEnhance } from '~/services/ai/use-text-enhance';
import t from '~/translations';

// ── Shared layout constants ───────────────────────────────────────────────────

export const MAX_WIDTH = 500;
export const PILL_RADIUS = 20;
export const INPUT_MIN_H = spacing[6] + spacing[4]; // 48px
export const INPUT_MAX_H = spacing[6] * 9; // 288px

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: false,
} as const;

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseComposerBaseOptions {
  seedMessage?: string;
  selectedNotes?: ComposerSelectedNote[];
  onExtraClearDraft?: () => void;
}

export function useComposerBase({
  seedMessage,
  selectedNotes = [],
  onExtraClearDraft,
}: UseComposerBaseOptions = {}) {
  const client = useApiClient();
  const inputRef = useRef<TextInput>(null);
  const animatedH = useSharedValue(INPUT_MIN_H);

  const [message, setMessage] = useState(seedMessage ?? '');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const { enhance, isEnhancing } = useTextEnhance();
  const { handleCameraCapture, pickAttachment, uploadState } = useComposerMediaActions({
    attachments,
    setAttachments,
  });

  const uploadedAttachmentIds = useMemo(
    () => getUploadedAttachmentIds(attachments),
    [attachments],
  );

  const canSubmit = canSubmitComposerDraft({
    isUploading: uploadState.isUploading,
    message,
    uploadedAttachmentIds,
    selectedNotes,
  });

  const clearDraft = useCallback(() => {
    setMessage('');
    setAttachments([]);
    animatedH.value = INPUT_MIN_H;
    onExtraClearDraft?.();
  }, [animatedH, onExtraClearDraft]);

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      const target = attachments.find((a) => a.id === id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (target?.uploadedFile?.id) {
        void client.api.files[':fileId']
          .$delete({ param: { fileId: target.uploadedFile.id } })
          .catch(() => undefined);
      }
    },
    [attachments, client],
  );

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

  const onContentSizeChange = useCallback(
    (h: number) => {
      const clamped = Math.min(Math.max(h, INPUT_MIN_H), INPUT_MAX_H);
      animatedH.value = withSpring(clamped, SPRING_CONFIG);
    },
    [animatedH],
  );

  const inputStyle = useAnimatedStyle(() => ({
    minHeight: animatedH.value,
    maxHeight: INPUT_MAX_H,
  }));

  return {
    // state
    message,
    setMessage,
    attachments,
    isCameraOpen,
    setIsCameraOpen,
    // refs
    inputRef,
    // upload
    uploadState,
    uploadedAttachmentIds,
    // derived
    canSubmit,
    // callbacks
    clearDraft,
    handleRemoveAttachment,
    showPlusMenu,
    onContentSizeChange,
    // enhance
    enhance,
    isEnhancing,
    // camera
    handleCameraCapture,
    // animated styles
    inputStyle,
  };
}

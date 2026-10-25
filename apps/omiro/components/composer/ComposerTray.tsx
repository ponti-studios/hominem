import { memo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionAnimations } from '~/services/motion/native-motion';
import t from '~/translations';

import type { ComposerEntryKind, ComposerProps } from './composer.types';
import { ComposerAttachButton } from './ComposerAttachButton';
import {
  shouldShowComposerTray,
  type ComposerCapabilitiesVoiceInput,
} from './composerCapabilities.helpers';
import { ComposerKindToggle } from './ComposerKindToggle';
import { ComposerTrayChip } from './ComposerTrayChip';
import { useComposerActions } from './useComposerActions';
import type { ComposerMessageStore } from './useComposerMessageStore';

interface ComposerTrayProps {
  composerProps: ComposerProps;
  messageStore: ComposerMessageStore;
  entryMode: 'mixed' | ComposerEntryKind;
  manualEntryKind: ComposerEntryKind | null;
  onManualEntryKindChange: (kind: ComposerEntryKind) => void;
  uploadedAttachmentCount: number;
  state: {
    isFocused: boolean;
    isInteractionBusy: boolean;
    showAttachments: boolean;
  };
  canPickMedia: boolean;
  voice: ComposerCapabilitiesVoiceInput;
  onChangeMessage: (message: string) => void;
  onPlan: ((message: string) => void) | undefined;
}

// The chip row above the pill: kind (mixed inbox only), attach, enhance, plan.
// It stays out of the way at rest and shows up while the user is writing --
// focused, or holding a draft/attachments.
function ComposerTrayComponent({
  composerProps,
  messageStore,
  entryMode,
  manualEntryKind,
  onManualEntryKindChange,
  uploadedAttachmentCount,
  state,
  canPickMedia,
  voice,
  onChangeMessage,
  onPlan,
}: ComposerTrayProps) {
  const reducedMotion = useReducedMotion();
  const { canOpenEnhance, canSubmit, hasContent, openEnhance, selectedEntryKind } =
    useComposerActions({
      composerProps,
      messageStore,
      entryMode,
      manualEntryKind,
      uploadedAttachmentCount,
      state,
      voice,
      onChangeMessage,
    });

  if (!shouldShowComposerTray({ ...state, hasContent })) {
    return null;
  }

  const showKindToggle = composerProps.mode === 'inbox' && composerProps.entryMode === 'mixed';

  return (
    <Animated.View
      entering={
        reducedMotion ? nativeMotionAnimations.fadeInQuick : nativeMotionAnimations.fadeInDownQuick
      }
      exiting={nativeMotionAnimations.fadeOutQuick}
      testID="composer-tray"
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {showKindToggle ? (
          <ComposerKindToggle onSelect={onManualEntryKindChange} selected={selectedEntryKind} />
        ) : null}
        <ComposerAttachButton disabled={!canPickMedia} variant="chip" />
        {hasContent ? (
          <ComposerTrayChip
            accessibilityLabel={t.inboxComposer.composer.enhanceTextA11y}
            disabled={!canOpenEnhance}
            icon="wand.and.sparkles"
            label={t.inboxComposer.composer.enhanceLabel}
            tone="accent"
            onPress={openEnhance}
          />
        ) : null}
        {hasContent && onPlan ? (
          <ComposerTrayChip
            accessibilityLabel={t.inboxComposer.composer.planA11y}
            disabled={!canSubmit || (composerProps.mode === 'inbox' && composerProps.isPlanning)}
            icon="calendar.badge.plus"
            label={t.inboxComposer.composer.planLabel}
            testID="composer-plan"
            onPress={() => onPlan(messageStore.getMessage())}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

export const ComposerTray = memo(ComposerTrayComponent);

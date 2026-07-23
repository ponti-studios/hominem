import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import type { useInlineEnhance } from '~/services/ai';

type EnhanceState = Pick<
  ReturnType<typeof useInlineEnhance>,
  | 'isEnhanceOpen'
  | 'enhanceInstruction'
  | 'setEnhanceInstruction'
  | 'closeEnhance'
  | 'isEnhancing'
  | 'enhanceError'
  | 'runEnhance'
>;

interface InlineEnhancePanelProps {
  enhance: EnhanceState;
  text: string;
  onEnhanced: (value: string) => void;
}

export function InlineEnhancePanel({ enhance, text, onEnhanced }: InlineEnhancePanelProps) {
  if (!enhance.isEnhanceOpen) {
    return null;
  }

  return (
    <InlineEnhanceTray
      instruction={enhance.enhanceInstruction}
      onInstructionChange={enhance.setEnhanceInstruction}
      onCancel={enhance.closeEnhance}
      onConfirm={() => void enhance.runEnhance({ text, onEnhanced })}
      isEnhancing={enhance.isEnhancing}
      error={enhance.enhanceError}
    />
  );
}

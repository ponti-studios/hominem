import { useCallback, useState } from 'react';

import { useTextEnhance } from './use-text-enhance';

interface RunEnhanceParams {
  text: string;
  onEnhanced: (enhanced: string) => void;
}

export function useInlineEnhance() {
  const { enhance, isEnhancing } = useTextEnhance();
  const [isEnhanceOpen, setIsEnhanceOpen] = useState(false);
  const [enhanceInstruction, setEnhanceInstruction] = useState('');
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const toggleEnhance = useCallback(() => {
    setEnhanceError(null);
    setIsEnhanceOpen((current) => !current);
  }, []);

  const closeEnhance = useCallback(() => {
    setEnhanceInstruction('');
    setEnhanceError(null);
    setIsEnhanceOpen(false);
  }, []);

  const runEnhance = useCallback(
    async ({ text, onEnhanced }: RunEnhanceParams): Promise<boolean> => {
      if (!text.trim() || isEnhancing) {
        return false;
      }

      setEnhanceError(null);

      try {
        const enhanced = await enhance({
          text,
          instruction: enhanceInstruction.trim() || undefined,
        });
        onEnhanced(enhanced);
        closeEnhance();
        return true;
      } catch (caughtError) {
        setEnhanceError(caughtError instanceof Error ? caughtError.message : 'Enhancement failed');
        return false;
      }
    },
    [closeEnhance, enhance, enhanceInstruction, isEnhancing],
  );

  return {
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
  };
}

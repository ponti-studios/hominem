import { useCallback, useState } from 'react';

interface UseInlineEnhanceParams {
  onEnhanceText: (input: { text: string; instruction?: string }) => Promise<string>;
}

interface RunEnhanceParams {
  text: string;
  onEnhanced: (enhanced: string) => void;
}

export function useInlineEnhance({ onEnhanceText }: UseInlineEnhanceParams) {
  const [isEnhanceOpen, setIsEnhanceOpen] = useState(false);
  const [enhanceInstruction, setEnhanceInstruction] = useState('');
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

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

      setIsEnhancing(true);
      setEnhanceError(null);

      try {
        const enhanced = await onEnhanceText({
          text,
          instruction: enhanceInstruction.trim() || undefined,
        });
        onEnhanced(enhanced);
        closeEnhance();
        return true;
      } catch (caughtError) {
        setEnhanceError(caughtError instanceof Error ? caughtError.message : 'Enhancement failed');
        return false;
      } finally {
        setIsEnhancing(false);
      }
    },
    [closeEnhance, enhanceInstruction, isEnhancing, onEnhanceText],
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

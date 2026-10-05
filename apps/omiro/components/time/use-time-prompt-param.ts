import { useEffect } from 'react';

// Lets a link (`hakumi-dev:///time?prompt=...`, a Siri shortcut, a widget)
// hand the capture bar a request. The text is only prefilled, never sent:
// the person still reviews it and taps send. The param is cleared once
// consumed so the same link can be opened again.
export function useTimePromptParam({
  clear,
  prompt,
  setPrompt,
}: {
  clear: () => void;
  prompt: string | undefined;
  setPrompt: (value: string) => void;
}) {
  useEffect(() => {
    const text = prompt?.trim();
    if (!text) {
      return;
    }
    setPrompt(text);
    clear();
  }, [clear, prompt, setPrompt]);
}

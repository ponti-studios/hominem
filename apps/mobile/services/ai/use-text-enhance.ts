import { useApiClient } from '@hominem/rpc/react';
import { useMutation } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';

interface UseTextEnhanceOptions {
  onValueChange: Dispatch<SetStateAction<string>>;
}

export function useTextEnhance({ onValueChange }: UseTextEnhanceOptions) {
  const client = useApiClient();

  const { mutate: enhance, isPending: isEnhancing } = useMutation({
    mutationFn: async (text: string) => {
      const response = await client.api.ai.enhance.$post({ json: { text } });
      const data = await response.json();
      if ('error' in data) throw new Error(data.error);
      return data.text;
    },
    onSuccess: (enhanced) => {
      onValueChange(enhanced);
    },
  });

  return { enhance, isEnhancing };
}

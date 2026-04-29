import { useApiClient } from '@hominem/rpc/react';
import { useCallback, useState } from 'react';

export function useTextEnhance() {
  const client = useApiClient();
  const [isEnhancing, setIsEnhancing] = useState(false);

  const enhance = useCallback(
    async (text: string, instruction?: string): Promise<string> => {
      setIsEnhancing(true);
      try {
        const response = await client.api.ai.enhance.$post({
          json: instruction ? { text, instruction } : { text },
        });
        const data = await response.json();
        if ('error' in data) throw new Error(data.error);
        return data.text;
      } finally {
        setIsEnhancing(false);
      }
    },
    [client],
  );

  return { enhance, isEnhancing };
}

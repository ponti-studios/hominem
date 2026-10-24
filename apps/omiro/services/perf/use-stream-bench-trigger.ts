import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { isBenchScenario, runStreamBench } from './stream-bench';

// Dev builds only. Open a chat with `?bench=steady|burst` (optionally `&runs=3`
// and a changing `&t=` so the same link can fire again) and the canned reply
// streams through the real pipeline; results print as `[stream-bench] {json}`.
export function useStreamBenchTrigger(chatId: string) {
  const queryClient = useQueryClient();
  const { bench, runs, t } = useLocalSearchParams<{ bench?: string; runs?: string; t?: string }>();

  useEffect(() => {
    if (!__DEV__ || !isBenchScenario(bench)) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const count = Math.max(1, Number(runs) || 1);
      for (let run = 0; run < count && !cancelled; run += 1) {
        await runStreamBench({ queryClient, chatId, scenario: bench });
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bench, chatId, queryClient, runs, t]);
}

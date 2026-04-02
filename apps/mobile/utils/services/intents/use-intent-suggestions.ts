import { useQuery } from '@tanstack/react-query';

import { storage } from '~/lib/storage';

export type IntentSuggestion = {
  id: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  seed_prompt?: string;
};

const STATIC_DEFAULTS: IntentSuggestion[] = [
  { id: 'create_image', title: 'Create image', seed_prompt: 'Create an illustration' },
  { id: 'help_me_learn', title: 'Help me learn', seed_prompt: 'Teach me something new' },
  { id: 'write_anything', title: 'Write anything', seed_prompt: 'Draft a concise note' },
  { id: 'boost_my_day', title: 'Boost my day', seed_prompt: 'Share a quick boost' },
];

const CACHE_KEY = '@intent_suggestions_cache';

function readCachedSuggestions(): IntentSuggestion[] {
  try {
    const cached = storage.getString(CACHE_KEY);
    if (!cached) return [];
    return JSON.parse(cached) as IntentSuggestion[];
  } catch {
    return [];
  }
}

function writeCachedSuggestions(suggestions: IntentSuggestion[]) {
  try {
    storage.set(CACHE_KEY, JSON.stringify(suggestions));
  } catch {
    return;
  }
}

export function useIntentSuggestions() {
  const query = useQuery<{
    suggestions: IntentSuggestion[];
    source: 'cache' | 'static';
  }>({
    queryKey: ['intentSuggestions'],
    queryFn: async () => {
      const cached = readCachedSuggestions();
      if (cached.length > 0) return { suggestions: cached, source: 'cache' as const };
      writeCachedSuggestions(STATIC_DEFAULTS);
      return { suggestions: STATIC_DEFAULTS, source: 'static' as const };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    suggestions: query.data?.suggestions ?? STATIC_DEFAULTS,
    source: query.data?.source ?? 'static',
    isPending: query.isPending,
    refetch: query.refetch,
  };
}

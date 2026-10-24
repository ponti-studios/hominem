import { useCallback, useSyncExternalStore } from 'react';

import { getPlaybackSnapshot, playAudioReply, subscribePlayback } from './audio-playback.service';

// Audio URLs are short-lived signed links, so a message that's been sitting in the cache for a
// while may hold an expired one. `resolveUrl` fetches a fresh one right before playback starts.
export function useAudioPlayback(
  messageId: string,
  url: string | null | undefined,
  resolveUrl?: () => Promise<string | null>,
) {
  const snapshot = useSyncExternalStore(subscribePlayback, getPlaybackSnapshot);
  const isSpeaking = snapshot.activeMessageId === messageId && snapshot.playing;

  const toggle = useCallback(async () => {
    if (!url) {
      return;
    }
    if (isSpeaking || !resolveUrl) {
      playAudioReply(messageId, url);
      return;
    }
    let fresh: string | null = null;
    try {
      fresh = await resolveUrl();
    } catch {
      // Fall back to the cached URL; it may still be valid.
    }
    playAudioReply(messageId, fresh ?? url);
  }, [messageId, url, isSpeaking, resolveUrl]);

  return { isSpeaking, toggle };
}

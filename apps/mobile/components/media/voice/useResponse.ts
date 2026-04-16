import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@hominem/utils/logger';
import {
  getVoiceResponseSnapshot,
  pauseVoiceResponse,
  playVoiceResponse,
  prepareVoiceResponse,
  resumeVoiceResponse,
  seekVoiceResponse,
  stopVoiceResponse,
  subscribeVoiceResponse,
} from '../audio.service';

interface UseResponseProps {
  audioUri: string;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onComplete?: () => void;
}

export function useResponse({ audioUri, onPlaybackStateChange, onComplete }: UseResponseProps) {
  const [snapshot, setSnapshot] = useState(getVoiceResponseSnapshot());
  const previousSnapshotRef = useRef(snapshot);

  useEffect(() => {
    const unsubscribe = subscribeVoiceResponse(setSnapshot);

    void prepareVoiceResponse(audioUri).catch((error) => {
      logger.error('[playback] failed to load sound', error as Error);
    });

    return () => {
      unsubscribe();
      void stopVoiceResponse();
    };
  }, [audioUri]);

  useEffect(() => {
    const previous = previousSnapshotRef.current;
    previousSnapshotRef.current = snapshot;

    if (previous.isPlaying !== snapshot.isPlaying) {
      onPlaybackStateChange?.(snapshot.isPlaying);
    }

    if (
      previous.isPlaying &&
      !snapshot.isPlaying &&
      snapshot.duration > 0 &&
      snapshot.position >= snapshot.duration
    ) {
      onComplete?.();
    }
  }, [onComplete, onPlaybackStateChange, snapshot]);

  const play = useCallback(async () => {
    await playVoiceResponse().catch((error) => {
      logger.error('[playback] play failed', error as Error);
    });
  }, []);

  const pause = useCallback(async () => {
    pauseVoiceResponse();
  }, []);

  const resume = useCallback(async () => {
    await resumeVoiceResponse().catch((error) => {
      logger.error('[playback] resume failed', error as Error);
    });
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    await seekVoiceResponse(positionMs).catch((error) => {
      logger.error('[playback] seek failed', error as Error);
    });
  }, []);

  const stop = useCallback(async () => {
    await stopVoiceResponse().catch((error) => {
      logger.error('[playback] stop failed', error as Error);
    });
  }, []);

  return {
    isPlaying: snapshot.isPlaying,
    duration: snapshot.duration,
    position: snapshot.position,
    play,
    pause,
    resume,
    seek,
    stop,
  };
}

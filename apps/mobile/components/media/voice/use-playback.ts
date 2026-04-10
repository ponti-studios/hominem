import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { logger } from '@hominem/utils/logger';

interface UsePlaybackProps {
  audioUri: string;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onComplete?: () => void;
}

export function usePlayback({ audioUri, onPlaybackStateChange, onComplete }: UsePlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSound = useCallback(async () => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
      soundRef.current = sound;

      const status = await sound.getStatusAsync();
      if (isMountedRef.current && status.isLoaded) {
        setDuration(Math.floor((status.durationMillis ?? 0) / 1000));
      }

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!isMountedRef.current) return;

        if (status.isLoaded) {
          setPosition(Math.floor((status.positionMillis ?? 0) / 1000));

          if (status.didJustFinish) {
            setIsPlaying(false);
            onPlaybackStateChange?.(false);
            onComplete?.();
          }
        }
      });
    } catch (error) {
      logger.error('[playback] failed to load sound', error as Error);
    }
  }, [audioUri, onComplete, onPlaybackStateChange]);

  useEffect(() => {
    loadSound();

    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [loadSound]);

  const play = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      onPlaybackStateChange?.(true);
    } catch (error) {
      logger.error('[playback] play failed', error as Error);
    }
  }, [onPlaybackStateChange]);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      onPlaybackStateChange?.(false);
    } catch (error) {
      logger.error('[playback] pause failed', error as Error);
    }
  }, [onPlaybackStateChange]);

  const resume = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      onPlaybackStateChange?.(true);
    } catch (error) {
      logger.error('[playback] resume failed', error as Error);
    }
  }, [onPlaybackStateChange]);

  const seek = useCallback(async (positionMs: number) => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.setPositionAsync(positionMs);
    } catch (error) {
      logger.error('[playback] seek failed', error as Error);
    }
  }, []);

  const stop = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      setPosition(0);
      onPlaybackStateChange?.(false);
    } catch (error) {
      logger.error('[playback] stop failed', error as Error);
    }
  }, [onPlaybackStateChange]);

  return {
    isPlaying,
    duration,
    position,
    play,
    pause,
    resume,
    seek,
    stop,
  };
}

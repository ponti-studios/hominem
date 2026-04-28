import { emitVoiceEvent } from '@hominem/rpc/voice-events';
import { logger } from '@hominem/telemetry';
import * as Audio from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

export type RecorderState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'PREPARING'
  | 'RECORDING'
  | 'PAUSED'
  | 'STOPPING';

type RecordingSnapshot = {
  lastRecordingUri: string | null;
  meterings: number[];
  state: RecorderState;
};

type PlaybackSnapshot = {
  audioUri: string | null;
  duration: number;
  isLoaded: boolean;
  isPlaying: boolean;
  position: number;
};

type AudioPlayer = ReturnType<typeof Audio.createAudioPlayer>;
type AudioRecorder = InstanceType<typeof AudioModule.AudioRecorder>;

type Listener<T> = (snapshot: T) => void;

function createStore<T>(initialValue: T) {
  let snapshot = initialValue;
  const listeners = new Set<Listener<T>>();

  const emit = () => {
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  return {
    getSnapshot: () => snapshot,
    setSnapshot: (next: T) => {
      snapshot = next;
      emit();
    },
    updateSnapshot: (updater: (current: T) => T) => {
      snapshot = updater(snapshot);
      emit();
    },
    subscribe: (listener: Listener<T>) => {
      listeners.add(listener);
      listener(snapshot);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function createPlaybackController() {
  const store = createStore<PlaybackSnapshot>({
    audioUri: null,
    duration: 0,
    isLoaded: false,
    isPlaying: false,
    position: 0,
  });

  let player: AudioPlayer | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;

  const ensurePlayer = () => {
    if (!player) {
      player = Audio.createAudioPlayer(null);
    }

    return player;
  };

  const sync = () => {
    if (!player) return;

    store.setSnapshot({
      audioUri: store.getSnapshot().audioUri,
      duration: Math.floor(player.duration ?? 0),
      isLoaded: player.isLoaded,
      isPlaying: player.playing,
      position: Math.floor(player.currentTime ?? 0),
    });
  };

  const startPolling = () => {
    if (pollHandle) return;

    pollHandle = setInterval(sync, 100);
    sync();
  };

  const stopPolling = () => {
    if (!pollHandle) return;

    clearInterval(pollHandle);
    pollHandle = null;
  };

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    prepare: async (audioUri: string) => {
      await Audio.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix' });

      const nextPlayer = ensurePlayer();
      nextPlayer.replace({ uri: audioUri });
      await nextPlayer.seekTo(0);

      store.setSnapshot({
        audioUri,
        duration: Math.floor(nextPlayer.duration ?? 0),
        isLoaded: nextPlayer.isLoaded,
        isPlaying: nextPlayer.playing,
        position: 0,
      });
      startPolling();
    },
    play: async () => {
      await Audio.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix' });

      const nextPlayer = ensurePlayer();
      nextPlayer.play();
      startPolling();
      sync();
    },
    pause: () => {
      player?.pause();
      sync();
    },
    seek: async (positionMs: number) => {
      if (!player) return;

      await player.seekTo(positionMs / 1000);
      sync();
    },
    stop: async () => {
      if (!player) return;

      player.pause();
      await player.seekTo(0);
      stopPolling();
      sync();
    },
  };
}

function createRecordingController() {
  const store = createStore<RecordingSnapshot>({
    lastRecordingUri: null,
    meterings: [],
    state: 'IDLE',
  });

  let recorder: AudioRecorder | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;

  const ensureRecorder = () => {
    if (!recorder) {
      recorder = new AudioModule.AudioRecorder({
        ...Audio.RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
    }

    return recorder as AudioRecorder;
  };

  const sync = () => {
    if (!recorder) return;

    const status = recorder.getStatus();
    const metering = status.metering;

    store.updateSnapshot((current) => ({
      ...current,
      meterings:
        typeof metering === 'number'
          ? [...current.meterings, metering].slice(-12)
          : current.meterings,
    }));
  };

  const startPolling = () => {
    if (pollHandle) return;

    pollHandle = setInterval(sync, 100);
    sync();
  };

  const stopPolling = () => {
    if (!pollHandle) return;

    clearInterval(pollHandle);
    pollHandle = null;
  };

  const setState = (state: RecorderState) => {
    store.updateSnapshot((current) => ({ ...current, state }));
  };

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    clearRecording: () => {
      store.setSnapshot({
        lastRecordingUri: null,
        meterings: [],
        state: 'IDLE',
      });
    },
    pauseRecording: () => {
      if (store.getSnapshot().state !== 'RECORDING') return;

      recorder?.pause();
      setState('PAUSED');
    },
    resumeRecording: () => {
      if (store.getSnapshot().state !== 'PAUSED') return;

      recorder?.record();
      setState('RECORDING');
    },
    startRecording: async () => {
      if (store.getSnapshot().state !== 'IDLE') {
        return { ok: false as const, reason: 'busy' as const };
      }

      logger.info('[recorder] start requested', {
        state: store.getSnapshot().state,
      });

      setState('REQUESTING_PERMISSION');

      const permission = await Audio.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setState('IDLE');
        return { ok: false as const, reason: 'permission-denied' as const };
      }

      setState('PREPARING');

      await Audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      activateKeepAwakeAsync().catch((error: Error) =>
        logger.error('[recorder] keep-awake activation failed', error),
      );

      try {
        const nextRecorder = ensureRecorder();
        await nextRecorder.prepareToRecordAsync();
        nextRecorder.record();
        store.updateSnapshot((current) => ({
          ...current,
          meterings: [],
          state: 'RECORDING',
        }));
        logger.info('[recorder] recording started', {
          state: 'RECORDING',
        });
        emitVoiceEvent('voice_record_started', { platform: 'mobile-ios' });
        startPolling();
        return { ok: true as const };
      } catch (error) {
        logger.error('[recorder] start failed', error as Error);
        setState('IDLE');
        await deactivateKeepAwake().catch((nextError: Error) =>
          logger.error('[recorder] keep-awake deactivation failed', nextError),
        );
        return { ok: false as const, reason: 'error' as const };
      }
    },
    stopRecording: async () => {
      const current = store.getSnapshot();
      if (current.state === 'IDLE' || current.state === 'STOPPING') {
        return null;
      }

      logger.info('[recorder] stop requested', {
        state: current.state,
      });

      setState('STOPPING');

      try {
        await recorder?.stop();
      } catch (error) {
        logger.error('[recorder] stop failed', error as Error);
      }

      stopPolling();

      await deactivateKeepAwake().catch((error: Error) =>
        logger.error('[recorder] keep-awake deactivation failed', error),
      );

      const fileUri = recorder?.uri ?? null;

      logger.info('[recorder] recording stopped', {
        fileUri,
        hadRecording: !!fileUri,
      });

      store.setSnapshot({
        lastRecordingUri: fileUri ?? current.lastRecordingUri,
        meterings: [],
        state: 'IDLE',
      });

      if (fileUri) {
        emitVoiceEvent('voice_record_stopped', { platform: 'mobile-ios' });
      }

      return fileUri;
    },
  };
}

const voiceResponsePlayback = createPlaybackController();
const ttsPlayback = createPlaybackController();
const recording = createRecordingController();

export function getRecordingSnapshot() {
  return recording.getSnapshot();
}

export function subscribeRecording(listener: Listener<RecordingSnapshot>) {
  return recording.subscribe(listener);
}

export function clearRecording() {
  recording.clearRecording();
}

export function pauseRecording() {
  recording.pauseRecording();
}

export function resumeRecording() {
  recording.resumeRecording();
}

export async function startRecording() {
  return recording.startRecording();
}

export async function stopRecording() {
  return recording.stopRecording();
}

function getVoiceResponseSnapshot() {
  return voiceResponsePlayback.getSnapshot();
}

function subscribeVoiceResponse(listener: Listener<PlaybackSnapshot>) {
  return voiceResponsePlayback.subscribe(listener);
}

async function prepareVoiceResponse(audioUri: string) {
  await voiceResponsePlayback.prepare(audioUri);
}

async function playVoiceResponse() {
  await ttsPlayback.stop();
  await voiceResponsePlayback.play();
}

function pauseVoiceResponse() {
  voiceResponsePlayback.pause();
}

async function resumeVoiceResponse() {
  await voiceResponsePlayback.play();
}

async function seekVoiceResponse(positionMs: number) {
  await voiceResponsePlayback.seek(positionMs);
}

async function stopVoiceResponse() {
  await voiceResponsePlayback.stop();
}

export async function playTTS(audioUri: string) {
  logger.info('[voice-playback] starting text-to-speech playback', {
    audioUri,
  });
  await voiceResponsePlayback.stop();
  await ttsPlayback.prepare(audioUri);
  await ttsPlayback.play();
  logger.info('[voice-playback] text-to-speech playback active', {
    audioUri,
  });
}

export function stopTTS() {
  logger.info('[voice-playback] stopping text-to-speech playback');
  void ttsPlayback.stop();
}

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

/**
 * Recoverable voice input failure states, mirroring Omiro's voice composer
 * error categories (permission, device availability, transcription).
 * 'no-speech' and 'aborted' are not included: they fire on ordinary silence
 * or a manual stop and aren't user-facing failures.
 */
export type VoiceRecognitionError =
  | 'permission-denied'
  | 'microphone-unavailable'
  | 'transcription-failed';

function mapRecognitionErrorCode(code: string): VoiceRecognitionError | null {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied';
    case 'audio-capture':
      return 'microphone-unavailable';
    case 'no-speech':
    case 'aborted':
      return null;
    default:
      return 'transcription-failed';
  }
}

export function getSpeechErrorMessage(error: VoiceRecognitionError): string {
  switch (error) {
    case 'permission-denied':
      return 'Microphone access was denied. Enable microphone permissions to use voice input.';
    case 'microphone-unavailable':
      return 'No microphone is available for voice input.';
    case 'transcription-failed':
      return 'Voice transcription failed. Try again.';
  }
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function isSpeechRecognitionConstructor(value: unknown): value is SpeechRecognitionConstructor {
  return typeof value === 'function';
}

export function getSpeechRecognitionConstructor(
  scope: object | null,
): SpeechRecognitionConstructor | null {
  if (!scope) return null;
  const speechRecognition = Reflect.get(scope, 'SpeechRecognition');
  if (isSpeechRecognitionConstructor(speechRecognition)) return speechRecognition;
  const webkitSpeechRecognition = Reflect.get(scope, 'webkitSpeechRecognition');
  return isSpeechRecognitionConstructor(webkitSpeechRecognition) ? webkitSpeechRecognition : null;
}

interface UseSpeechToTextOptions {
  /** Called with the full dictated text (seed + everything transcribed so far) on every update. */
  onTranscript: (fullText: string) => void;
}

export function useSpeechToText({ onTranscript }: UseSpeechToTextOptions) {
  // Starts false on both server and client so hydration matches; flips after
  // mount once we can safely check for the browser API.
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<VoiceRecognitionError | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const seedRef = useRef('');
  const finalTextRef = useRef('');
  // mirrors isListening synchronously: two clicks in the same tick both read
  // stale React state, so toggle/start need a ref to reject the second one
  const isListeningRef = useRef(false);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor(window) !== null);
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    isListeningRef.current = false;
    setIsListening(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback(
    (seed = '') => {
      // guards against a second start (e.g. a double click) while recognition
      // is already active — starting a new one would leak the old instance
      if (isListeningRef.current) return;

      const Recognition = getSpeechRecognitionConstructor(window);
      if (!Recognition) return;

      isListeningRef.current = true;
      setError(null);
      seedRef.current = seed;
      finalTextRef.current = '';

      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTextRef.current += `${result[0].transcript} `;
          } else {
            interimText += result[0].transcript;
          }
        }
        const combined = [seedRef.current, finalTextRef.current + interimText]
          .filter((part) => part.trim().length > 0)
          .join(' ')
          .trim();
        onTranscript(combined);
      };
      recognition.onerror = (event) => {
        isListeningRef.current = false;
        setIsListening(false);
        setError(mapRecognitionErrorCode(event.error));
      };
      recognition.onend = () => {
        isListeningRef.current = false;
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    },
    [onTranscript],
  );

  const toggle = useCallback(
    (seed = '') => {
      if (isListeningRef.current) {
        stop();
      } else {
        start(seed);
      }
    },
    [start, stop],
  );

  return { isSupported, isListening, error, clearError, start, stop, toggle };
}

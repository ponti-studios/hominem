import { Loader2, Mic, MicOff, Volume2, XCircle } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../button';

export type VoiceModeOverlayState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceModeOverlayProps {
  visible: boolean;
  state: VoiceModeOverlayState;
  errorMessage?: string;
  canStop: boolean;
  onClose: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

function getStateCopy(state: VoiceModeOverlayState): string {
  if (state === 'listening') return 'Listening';
  if (state === 'processing') return 'Thinking';
  if (state === 'speaking') return 'Speaking';
  if (state === 'error') return 'Error';
  return 'Ready';
}

export function VoiceModeOverlay({
  visible,
  state,
  errorMessage,
  canStop,
  onClose,
  onStartRecording,
  onStopRecording,
}: VoiceModeOverlayProps) {
  if (!visible) return null;

  const isBusy = state === 'processing' || state === 'speaking';
  const stateCopy = getStateCopy(state);
  const dialClassName = cn(
    'flex size-28 items-center justify-center rounded-full border bg-surface transition-colors',
    state === 'idle' && 'border-border-default text-text-secondary',
    state === 'listening' && 'border-accent/60 bg-accent/10 text-accent',
    state === 'processing' && 'border-border-default text-text-secondary',
    state === 'speaking' && 'border-success/60 bg-success/10 text-success',
    state === 'error' && 'border-destructive/70 bg-destructive/10 text-destructive',
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-overlay-modal-high px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-elevated p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-text-tertiary">Voice mode</p>
            <p className="text-sm font-medium text-foreground">{stateCopy}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Exit voice mode"
            onClick={onClose}
          >
            <XCircle className="size-4" />
          </Button>
        </div>

        <div className="mb-4 flex items-center justify-center">
          <div
            className={dialClassName}
            role="status"
            aria-live="polite"
            aria-label={`Voice mode state: ${stateCopy}`}
          >
            {state === 'processing' ? (
              <Loader2 className="size-8 animate-spin" />
            ) : state === 'speaking' ? (
              <Volume2 className="size-8" />
            ) : canStop ? (
              <MicOff className="size-8 text-destructive" />
            ) : (
              <Mic className="size-8" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          {canStop ? (
            <Button
              type="button"
              onClick={onStopRecording}
              variant="destructive"
              size="sm"
              disabled={isBusy}
            >
              Stop and send
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onStartRecording}
              size="sm"
              disabled={isBusy}
              className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:bg-secondary disabled:text-secondary-foreground"
            >
              Start listening
            </Button>
          )}
        </div>

        {errorMessage ? (
          <p className="mt-3 text-center text-xs text-destructive">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}

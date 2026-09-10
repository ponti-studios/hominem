import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { getSpeechErrorMessage } from '~/lib/hooks/use-speech-to-text';

import { ChatComposer } from './chat-composer';

const meta = {
  title: 'Chat/Components/Chat Composer',
  component: ChatComposer,
  args: { draft: '', onChangeDraft: () => undefined, onSubmit: () => undefined },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ChatComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness({
  simulateError = false,
  voiceSupported = false,
  retryClearsError = false,
  clearsErrorOnNextListen = false,
  ...props
}: Partial<React.ComponentProps<typeof ChatComposer>> & {
  simulateError?: boolean;
  voiceSupported?: boolean;
  /** mirrors use-file-upload: clicking Retry resubmits and clears the failure. */
  retryClearsError?: boolean;
  /** mirrors use-speech-to-text: starting a new listen clears the previous
   *  voice error. Real voice errors have no Retry button — press-mic-to-retry
   *  is the recovery action. */
  clearsErrorOnNextListen?: boolean;
}) {
  const [draft, setDraft] = useState(props.draft ?? '');
  const [error, setError] = useState(props.error ?? null);
  const [isListening, setIsListening] = useState(props.isListening ?? false);

  return (
    <div className="min-h-40 bg-background pt-4">
      <ChatComposer
        {...props}
        draft={draft}
        error={error}
        isListening={isListening}
        onChangeDraft={setDraft}
        isVoiceSupported={voiceSupported}
        onRetry={props.onRetry ?? (retryClearsError ? () => setError(null) : undefined)}
        onToggleVoice={() => {
          if (clearsErrorOnNextListen && !isListening) setError(null);
          setIsListening((current) => !current);
        }}
        onSubmit={() => {
          if (simulateError) setError('Unable to send the message.');
          props.onSubmit?.();
        }}
      />
    </div>
  );
}

export const Empty: Story = { render: () => <Harness /> };

export const Composing: Story = { render: () => <Harness draft="Plan the next release" /> };

export const WithAttachment: Story = {
  render: () => (
    <Harness
      attachments={[{ id: 'file-1', originalName: 'release-notes.pdf' }]}
      draft="Summarize this"
      onRemoveAttachment={() => undefined}
    />
  ),
};

export const Submitting: Story = {
  render: () => <Harness draft="Send this" isSubmitting />,
};

export const Error: Story = {
  render: () => <Harness draft="Try again" simulateError />,
};

export const Offline: Story = {
  render: () => (
    <Harness
      draft="Keep this while offline"
      error="You are offline. Your draft and attachments are preserved."
      isOffline
    />
  ),
};

export const RetryableError: Story = {
  render: () => (
    <Harness
      draft="Retry this message"
      error="Unable to send the message."
      onRetry={() => undefined}
    />
  ),
};

export const Retrying: Story = {
  render: () => <Harness draft="Retrying this message" isSubmitting />,
};

export const UploadFailure: Story = {
  name: 'Upload failure (retryable)',
  render: () => (
    <Harness
      attachments={[{ id: 'file-1', originalName: 'important-notes.pdf' }]}
      draft="Send this when the connection returns"
      error="important-notes.pdf: Upload failed"
      onRemoveAttachment={() => undefined}
      retryClearsError
    />
  ),
};

export const UploadInProgress: Story = {
  name: 'Upload in progress (attach disabled)',
  render: () => (
    <Harness
      draft="Attaching a file…"
      isUploading
      onAttachFiles={() => undefined}
      onRemoveAttachment={() => undefined}
    />
  ),
};

export const VoiceReady: Story = {
  render: () => <Harness draft="Ask with your voice" voiceSupported />,
};

export const VoiceListening: Story = {
  render: () => <Harness draft="Listening for your question" isListening voiceSupported />,
};

export const VoiceUnsupported: Story = {
  render: () => <Harness draft="Voice input is unavailable" />,
};

export const VoicePermissionDenied: Story = {
  name: 'Voice: permission denied',
  render: () => (
    <Harness
      draft="Ask with your voice"
      clearsErrorOnNextListen
      error={getSpeechErrorMessage('permission-denied')}
      voiceSupported
    />
  ),
};

export const VoiceMicrophoneUnavailable: Story = {
  name: 'Voice: microphone unavailable',
  render: () => (
    <Harness
      draft="Ask with your voice"
      clearsErrorOnNextListen
      error={getSpeechErrorMessage('microphone-unavailable')}
      voiceSupported
    />
  ),
};

export const VoiceTranscriptionFailed: Story = {
  name: 'Voice: transcription failed',
  render: () => (
    <Harness
      draft="Ask with your voice"
      clearsErrorOnNextListen
      error={getSpeechErrorMessage('transcription-failed')}
      voiceSupported
    />
  ),
};

export const Streaming: Story = {
  render: () => <Harness draft="Generating a response" isStreaming onStop={() => undefined} />,
};

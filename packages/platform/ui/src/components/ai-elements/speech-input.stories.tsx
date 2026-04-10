import type { Meta, StoryObj } from '@storybook/react-vite';

function SpeechInputPreview() {
  return (
    <div className="p-6 max-w-md space-y-4">
      <div className="p-4 border border-border-default rounded-lg bg-surface">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            className="w-2 h-6 bg-accent rounded-sm animate-bounce"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="w-2 h-8 bg-accent rounded-sm animate-bounce"
            style={{ animationDelay: '0.1s' }}
          />
          <div
            className="w-2 h-6 bg-accent rounded-sm animate-bounce"
            style={{ animationDelay: '0.2s' }}
          />
          <div
            className="w-2 h-8 bg-accent rounded-sm animate-bounce"
            style={{ animationDelay: '0.3s' }}
          />
        </div>
        <p className="text-sm text-center text-text-secondary">Listening for your voice...</p>
      </div>
      <button className="w-full px-4 py-2 bg-accent text-white rounded-md text-sm font-medium">
        Stop Recording
      </button>
    </div>
  );
}

const meta = {
  title: 'Patterns/AI/SpeechInput',
  component: SpeechInputPreview,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof SpeechInputPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Transcript: Story = {
  render: () => (
    <div className="p-6 max-w-md space-y-4">
      <div className="p-4 border border-border-default rounded-lg bg-elevated">
        <p className="text-sm">
          This is the transcript of what I just said into the microphone. The speech recognition
          converted my audio to text.
        </p>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 px-4 py-2 border border-border-default rounded-md text-sm">
          Clear
        </button>
        <button className="flex-1 px-4 py-2 bg-accent text-white rounded-md text-sm">
          Use This
        </button>
      </div>
    </div>
  ),
};

export const Ready: Story = {
  render: () => (
    <div className="p-6 max-w-md space-y-4">
      <div className="p-4 border border-border-default rounded-lg text-center">
        <div className="text-3xl mb-2">🎤</div>
        <p className="text-sm font-medium mb-1">Ready to Listen</p>
        <p className="text-xs text-text-tertiary">Click start to begin voice input</p>
      </div>
      <button className="w-full px-4 py-2 bg-accent text-white rounded-md text-sm font-medium">
        Start Recording
      </button>
    </div>
  ),
};

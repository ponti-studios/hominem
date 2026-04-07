import type { Meta, StoryObj } from '@storybook/react-vite';

function VoiceDialogPreview() {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-base rounded-lg p-8 max-w-sm space-y-6 text-center">
        <h2 className="font-semibold">Voice Input</h2>
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
            <div className="w-12 h-12 rounded-full bg-accent" />
          </div>
        </div>
        <p className="text-sm text-text-secondary">Listening... Speak now</p>
        <div className="flex gap-2">
          <button className="flex-1 px-4 py-2 border border-destructive text-destructive rounded-md text-sm">
            Cancel
          </button>
          <button className="flex-1 px-4 py-2 bg-accent text-white rounded-md text-sm">Done</button>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Patterns/Composer/VoiceDialog',
  component: VoiceDialogPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof VoiceDialogPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recording: Story = {};

export const Ready: Story = {
  render: () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-base rounded-lg p-8 max-w-sm space-y-6 text-center">
        <h2 className="font-semibold">Record Your Voice</h2>
        <div className="flex justify-center">
          <button className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-white text-2xl hover:opacity-90">
            🎤
          </button>
        </div>
        <p className="text-sm text-text-secondary">Click the microphone to start recording</p>
        <button className="w-full px-4 py-2 border border-border-default rounded-md text-sm">
          Cancel
        </button>
      </div>
    </div>
  ),
};

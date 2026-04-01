import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Patterns/UpdateGuard',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

export const UpdateAvailable: Story = {
  render: () => (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 border-b border-warning p-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">⬆️</span>
          <div>
            <p className="font-medium text-sm">App Update Available</p>
            <p className="text-xs text-text-secondary">
              A new version of the app is ready. Please refresh to update.
            </p>
          </div>
        </div>
        <button className="px-4 py-1.5 bg-foreground text-background rounded text-sm font-medium hover:opacity-90">
          Update Now
        </button>
      </div>
    </div>
  ),
};

export const Modal: Story = {
  render: () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-base border border-border-default rounded-lg p-6 max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-3xl mb-2">🔄</div>
          <h2 className="font-semibold mb-1">Update Required</h2>
          <p className="text-sm text-text-secondary">
            A critical update is available. Please refresh your browser to continue.
          </p>
        </div>
        <button className="w-full px-4 py-2 bg-accent text-white rounded-md font-medium">
          Refresh Now
        </button>
      </div>
    </div>
  ),
};

export const UpdateInProgress: Story = {
  render: () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-base border border-border-default rounded-lg p-6 max-w-sm space-y-4 text-center">
        <div className="inline-flex">
          <div className="w-8 h-8 border-4 border-border-default border-t-accent rounded-full animate-spin" />
        </div>
        <div>
          <p className="font-medium text-sm mb-1">Updating Your App</p>
          <p className="text-xs text-text-secondary">
            Please wait while we download the latest version...
          </p>
        </div>
      </div>
    </div>
  ),
};

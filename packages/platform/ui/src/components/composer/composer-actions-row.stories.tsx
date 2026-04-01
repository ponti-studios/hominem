import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Patterns/Composer/ComposerActionsRow',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="p-4 max-w-md">
      <div className="flex gap-2 border-t border-border-subtle pt-3">
        <button className="px-3 py-1.5 text-sm border border-border-default rounded-md hover:bg-surface">
          📎 Attach
        </button>
        <button className="px-3 py-1.5 text-sm border border-border-default rounded-md hover:bg-surface">
          🎤 Voice
        </button>
        <button className="px-3 py-1.5 text-sm border border-border-default rounded-md hover:bg-surface">
          📷 Image
        </button>
        <div className="flex-1" />
        <button className="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:opacity-90">
          Send
        </button>
      </div>
    </div>
  ),
};

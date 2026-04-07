import type { Meta, StoryObj } from '@storybook/react-vite';

function ComposerActionsRowPreview() {
  return (
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
  );
}

const meta = {
  title: 'Patterns/Composer/ComposerActionsRow',
  component: ComposerActionsRowPreview,
  tags: ['autodocs'],
} satisfies Meta<typeof ComposerActionsRowPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

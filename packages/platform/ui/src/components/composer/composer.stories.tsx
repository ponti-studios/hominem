import type { Meta, StoryObj } from '@storybook/react-vite';

function ComposerPreview() {
  return (
    <div className="min-h-screen bg-surface p-4 flex items-end justify-center">
      <div className="w-full max-w-2xl bg-base border border-border-default rounded-lg p-4 space-y-3">
        <textarea
          placeholder="Write a message..."
          className="w-full px-3 py-2 border border-border-default rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          rows={4}
        />
        <div className="flex gap-2 justify-between items-center">
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm border border-border-default rounded-md hover:bg-surface">
              Attach
            </button>
          </div>
          <button className="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:opacity-90">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Patterns/Composer/Composer',
  component: ComposerPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ComposerPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAttachments: Story = {
  render: () => (
    <div className="min-h-screen bg-surface p-4 flex items-end justify-center">
      <div className="w-full max-w-2xl bg-base border border-border-default rounded-lg p-4 space-y-3">
        <textarea
          placeholder="Write a message..."
          className="w-full px-3 py-2 border border-border-default rounded-md text-sm resize-none"
          rows={3}
          defaultValue="Check out this document"
        />
        <div className="flex gap-2 p-2 bg-elevated rounded-md">
          <div className="flex-1 p-2 bg-surface rounded text-xs">📄 document.pdf</div>
        </div>
        <div className="flex gap-2 justify-between">
          <button className="px-3 py-1.5 text-sm border border-border-default rounded-md">
            Attach
          </button>
          <button className="px-4 py-1.5 text-sm bg-accent text-white rounded-md">Send</button>
        </div>
      </div>
    </div>
  ),
};

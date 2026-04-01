import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Patterns/Composer/ComposerTools',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="p-4 max-w-md space-y-2">
      <h3 className="text-sm font-semibold">Tools</h3>
      <div className="grid grid-cols-2 gap-2">
        <button className="p-3 border border-border-default rounded-md hover:bg-surface text-sm font-medium">
          🔍 Search
        </button>
        <button className="p-3 border border-border-default rounded-md hover:bg-surface text-sm font-medium">
          📝 Template
        </button>
        <button className="p-3 border border-border-default rounded-md hover:bg-surface text-sm font-medium">
          ✨ Format
        </button>
        <button className="p-3 border border-border-default rounded-md hover:bg-surface text-sm font-medium">
          🎯 Action
        </button>
      </div>
    </div>
  ),
};

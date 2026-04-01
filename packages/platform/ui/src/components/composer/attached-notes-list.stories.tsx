import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Patterns/Composer/AttachedNotesList',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="p-4 max-w-md space-y-3">
      <h3 className="text-sm font-semibold">Attached Notes (2)</h3>
      <div className="space-y-2">
        <div className="p-3 bg-surface border border-border-default rounded-md flex justify-between items-center">
          <div className="text-sm">📝 Project Notes</div>
          <button className="text-xs text-destructive">Remove</button>
        </div>
        <div className="p-3 bg-surface border border-border-default rounded-md flex justify-between items-center">
          <div className="text-sm">📝 Meeting Summary</div>
          <button className="text-xs text-destructive">Remove</button>
        </div>
      </div>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="p-4 max-w-md">
      <p className="text-sm text-text-tertiary">No notes attached</p>
    </div>
  ),
};

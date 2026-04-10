import type { Meta, StoryObj } from '@storybook/react-vite';

function AttachedNotesListPreview() {
  return (
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
  );
}

const meta = {
  title: 'Patterns/Composer/AttachedNotesList',
  component: AttachedNotesListPreview,
  tags: ['autodocs'],
} satisfies Meta<typeof AttachedNotesListPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  render: () => (
    <div className="p-4 max-w-md">
      <p className="text-sm text-text-tertiary">No notes attached</p>
    </div>
  ),
};

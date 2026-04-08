import type { Meta, StoryObj } from '@storybook/react-vite';

function NotePickerDialogPreview() {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center">
      <div className="bg-base rounded-t-lg md:rounded-lg w-full md:max-w-md max-h-96 p-4 space-y-3">
        <h2 className="font-semibold">Select Notes to Attach</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <label className="flex items-center gap-2 p-2 hover:bg-surface rounded-md cursor-pointer">
            <input type="checkbox" className="w-4 h-4" />
            <span className="text-sm">📝 Project Overview</span>
          </label>
          <label className="flex items-center gap-2 p-2 hover:bg-surface rounded-md cursor-pointer">
            <input type="checkbox" className="w-4 h-4" />
            <span className="text-sm">📝 Meeting Notes</span>
          </label>
          <label className="flex items-center gap-2 p-2 hover:bg-surface rounded-md cursor-pointer">
            <input type="checkbox" className="w-4 h-4" />
            <span className="text-sm">📝 Action Items</span>
          </label>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border-subtle">
          <button className="flex-1 px-4 py-2 border border-border-default rounded-md text-sm">
            Cancel
          </button>
          <button className="flex-1 px-4 py-2 bg-accent text-white rounded-md text-sm">
            Attach
          </button>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Patterns/Composer/NotePickerDialog',
  component: NotePickerDialogPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof NotePickerDialogPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

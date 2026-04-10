import type { Meta, StoryObj } from '@storybook/react-vite';

function ComposerAttachmentListPreview() {
  return (
    <div className="p-4 max-w-md space-y-2">
      <div className="p-2 bg-elevated rounded-md flex items-center justify-between">
        <span className="text-sm">📄 document.pdf (2.4 MB)</span>
        <button className="text-xs text-destructive">✕</button>
      </div>
      <div className="p-2 bg-elevated rounded-md flex items-center justify-between">
        <span className="text-sm">🖼️ image.png (1.2 MB)</span>
        <button className="text-xs text-destructive">✕</button>
      </div>
    </div>
  );
}

const meta = {
  title: 'Patterns/Composer/ComposerAttachmentList',
  component: ComposerAttachmentListPreview,
  tags: ['autodocs'],
} satisfies Meta<typeof ComposerAttachmentListPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  render: () => (
    <div className="p-4 max-w-md text-center text-text-tertiary text-sm">No attachments</div>
  ),
};

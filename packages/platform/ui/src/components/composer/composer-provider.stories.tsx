import type { Meta, StoryObj } from '@storybook/react-vite';

function ComposerProviderPreview() {
  return (
    <div className="p-6 max-w-md bg-surface rounded-lg text-center">
      <h3 className="font-semibold mb-2">ComposerProvider</h3>
      <p className="text-xs text-text-tertiary">
        This component provides shared state and context for the composer component tree.
      </p>
    </div>
  );
}

const meta = {
  title: 'Patterns/Composer/ComposerProvider',
  component: ComposerProviderPreview,
  tags: ['autodocs'],
} satisfies Meta<typeof ComposerProviderPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

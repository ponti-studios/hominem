import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Patterns/Composer/ComposerProvider',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="p-6 max-w-md bg-surface rounded-lg text-center">
      <h3 className="font-semibold mb-2">ComposerProvider</h3>
      <p className="text-xs text-text-tertiary">
        This component provides shared state and context for the composer component tree.
      </p>
    </div>
  ),
};

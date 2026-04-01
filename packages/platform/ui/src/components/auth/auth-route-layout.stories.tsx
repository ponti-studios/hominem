import type { Meta, StoryObj } from '@storybook/react-vite';

// The AuthRouteLayout component may have routing dependencies
// Creating a minimal story to show the component structure
const meta: Meta = {
  title: 'Patterns/Auth/AuthRouteLayout',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="min-h-screen bg-base p-4 flex items-center justify-center">
      <div className="bg-surface border border-border-default rounded-lg p-8 max-w-md text-center">
        <h2 className="text-lg font-semibold mb-2">AuthRouteLayout</h2>
        <p className="text-sm text-text-secondary">
          This component manages routing for authentication flows. It typically wraps auth-related
          routes and handles redirects based on authentication state.
        </p>
      </div>
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

function ResendCodeButtonPreview() {
  return (
    <div className="p-6 max-w-md">
      <div className="mb-6">
        <p className="text-sm text-text-secondary mb-4">Enter the code sent to your email</p>
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              type="text"
              maxLength={1}
              className="w-8 h-8 text-center border border-border-default rounded-md text-sm"
            />
          ))}
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-text-tertiary mb-2">Didn't receive a code?</p>
        <button className="text-sm text-accent hover:text-accent/80 font-medium">
          Resend Code
        </button>
      </div>
    </div>
  );
}

const meta = {
  title: 'Patterns/Auth/ResendCodeButton',
  component: ResendCodeButtonPreview,
  tags: ['autodocs'],
} satisfies Meta<typeof ResendCodeButtonPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(/Didn't receive a code/i)).toBeInTheDocument();
  },
};

export const WithCooldown: Story = {
  render: () => (
    <div className="p-6 max-w-md">
      <div className="text-center">
        <p className="text-xs text-text-tertiary mb-2">Resend code in</p>
        <button disabled className="text-sm text-text-disabled font-medium cursor-not-allowed">
          Resend Code (45s)
        </button>
      </div>
    </div>
  ),
};

export const SuccessfullySent: Story = {
  render: () => (
    <div className="p-6 max-w-md">
      <div className="p-4 bg-success/10 border border-success rounded-md mb-4">
        <p className="text-sm text-success font-medium">Code sent! Check your email.</p>
      </div>
      <button className="w-full px-4 py-2 bg-accent text-white font-medium rounded-md text-sm">
        Continue
      </button>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";

function UpdateGuardPreview() {
  return (
    <div className="bg-warning/90 border-warning fixed top-0 right-0 left-0 z-50 border-b p-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">⬆️</span>
          <div>
            <p className="text-sm font-medium">App Update Available</p>
            <p className="text-text-secondary text-xs">
              A new version of the app is ready. Please refresh to update.
            </p>
          </div>
        </div>
        <button className="bg-foreground text-background rounded px-4 py-1.5 text-sm font-medium hover:opacity-90">
          Update Now
        </button>
      </div>
    </div>
  );
}

function UpdateGuardModalPreview() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-base border-border-default max-w-sm space-y-4 rounded-lg border p-6">
        <div className="text-center">
          <div className="mb-2 text-3xl">🔄</div>
          <h2 className="mb-1 font-semibold">Update Required</h2>
          <p className="text-text-secondary text-sm">
            A critical update is available. Please refresh your browser to continue.
          </p>
        </div>
        <button className="bg-accent w-full rounded-md px-4 py-2 font-medium text-white">
          Refresh Now
        </button>
      </div>
    </div>
  );
}

function UpdateGuardProgressPreview() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-base border-border-default max-w-sm space-y-4 rounded-lg border p-6 text-center">
        <div className="inline-flex">
          <div className="border-border-default border-t-accent h-8 w-8 animate-spin rounded-full border-4" />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Updating Your App</p>
          <p className="text-text-secondary text-xs">
            Please wait while we download the latest version...
          </p>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "Patterns/UpdateGuard",
  component: UpdateGuardPreview,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof UpdateGuardPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UpdateAvailable: Story = {};

export const Modal: Story = {
  render: () => <UpdateGuardModalPreview />,
};

export const UpdateInProgress: Story = {
  render: () => <UpdateGuardProgressPreview />,
};

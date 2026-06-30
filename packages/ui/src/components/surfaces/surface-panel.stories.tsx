import type { Meta, StoryObj } from "@storybook/react-vite";

import { SurfacePanel } from "./surface-panel";

const meta = {
  title: "Surfaces/SurfacePanel",
  component: SurfacePanel,
  tags: ["autodocs"],
} satisfies Meta<typeof SurfacePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SurfacePanel>
      <div className="space-y-2">
        <h3 className="text-foreground text-base font-semibold">Inset panel</h3>
        <p className="text-text-secondary text-sm">
          Use for secondary groupings inside larger layouts and frames.
        </p>
      </div>
    </SurfacePanel>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { ParticleBackground } from "./particle-background";

const meta: Meta<typeof ParticleBackground> = {
  title: "Motion/ParticleBackground",
  component: ParticleBackground,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    enabled: { control: "boolean" },
    interactive: { control: "boolean" },
    showGradient: { control: "boolean" },
    particleCount: { control: { type: "number" } },
    particleDensity: { control: { type: "number" } },
    maxLinkDistance: { control: { type: "range", min: 0, max: 300 } },
    attractRadius: { control: { type: "number" } },
    attractStrength: { control: { type: "number" } },
    velocity: { control: { type: "number" } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Shared wrapper
// ---------------------------------------------------------------------------

function Canvas({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 600,
        height: 400,
        position: "relative",
        background: "#0f0f0f",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  render: (args) => (
    <Canvas>
      <ParticleBackground {...args} />
    </Canvas>
  ),
};

export const Dense: Story = {
  args: {
    particleDensity: 800,
  },
  render: (args) => (
    <Canvas>
      <ParticleBackground {...args} />
    </Canvas>
  ),
};

export const NoLinks: Story = {
  args: {
    maxLinkDistance: 0,
  },
  render: (args) => (
    <Canvas>
      <ParticleBackground {...args} />
    </Canvas>
  ),
};

/**
 * When `enabled` is `false`, the component returns `null` — nothing is
 * rendered inside the container. The dark box is the wrapper only.
 */
export const Disabled: Story = {
  args: {
    enabled: false,
  },
  render: (args) => (
    <Canvas>
      <ParticleBackground {...args} />
    </Canvas>
  ),
};

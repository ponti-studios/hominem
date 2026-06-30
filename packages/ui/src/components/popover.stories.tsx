import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta = {
  title: "Patterns/Overlay/Popover",
  component: Popover,
  tags: ["autodocs"],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-1.5">
          <h4 className="text-foreground leading-none font-medium">Dimensions</h4>
          <p className="text-muted-foreground text-sm">Set the dimensions for the layer.</p>
        </div>
        <div className="grid gap-4 pt-4">
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-sm">Width</label>
            <input className="col-span-2 h-8 rounded border px-2 text-sm" defaultValue="100%" />
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="text-sm">Height</label>
            <input className="col-span-2 h-8 rounded border px-2 text-sm" defaultValue="25px" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

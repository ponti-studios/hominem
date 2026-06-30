import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { Button } from "./button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta: Meta<typeof Sheet> = {
  title: "Internal/UI/Sheet",
  component: Sheet,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

type Side = "top" | "bottom" | "left" | "right";

const SheetDemo = ({ side }: { side: Side }) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline">Open {side} sheet</Button>
    </SheetTrigger>
    <SheetContent side={side}>
      <SheetHeader>
        <SheetTitle>Edit profile</SheetTitle>
        <SheetDescription>
          Make changes to your profile here. Click save when you're done.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 py-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Name</span>
          <input
            className="border-border placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
            placeholder="Jane Doe"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Email</span>
          <input
            className="border-border placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
            placeholder="jane@example.com"
            type="email"
          />
        </div>
      </div>
      <SheetFooter>
        <SheetClose asChild>
          <Button variant="outline">Cancel</Button>
        </SheetClose>
        <SheetClose asChild>
          <Button>Save changes</Button>
        </SheetClose>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

export const Right: Story = {
  render: () => <SheetDemo side="right" />,
};

export const Left: Story = {
  render: () => <SheetDemo side="left" />,
};

export const Top: Story = {
  render: () => <SheetDemo side="top" />,
};

export const Bottom: Story = {
  render: () => <SheetDemo side="bottom" />,
};

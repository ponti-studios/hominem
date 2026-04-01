import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';

const meta: Meta<typeof Drawer> = {
  title: 'Patterns/Overlay/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls whether the drawer is open',
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Whether the drawer is open by default (uncontrolled)',
    },
    direction: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      description: 'The side of the screen the drawer slides in from',
      table: { defaultValue: { summary: 'bottom' } },
    },
    modal: {
      control: 'boolean',
      description: 'When true, interaction outside the drawer is disabled while open',
      table: { defaultValue: { summary: 'true' } },
    },
    dismissible: {
      control: 'boolean',
      description: 'Whether the drawer can be closed by dragging it',
      table: { defaultValue: { summary: 'true' } },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Drawer>;

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open Drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Move Goal</DrawerTitle>
          <DrawerDescription>Set your daily activity goal.</DrawerDescription>
        </DrawerHeader>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">Drawer content goes here.</p>
        </div>
        <DrawerFooter>
          <Button>Submit</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

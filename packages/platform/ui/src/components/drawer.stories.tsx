import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { booleanControl, hiddenControl, selectControl } from '../storybook/controls';
import { drawerDirectionOptions } from '../storybook/options';
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

const meta = {
  title: 'Patterns/Overlay/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  argTypes: {
    open: booleanControl('Controls whether the drawer is open', true),
    defaultOpen: hiddenControl,
    direction: selectControl(
      drawerDirectionOptions,
      'The side of the screen the drawer slides in from',
      {
        defaultValue: 'bottom',
      },
    ),
    modal: booleanControl('When true, interaction outside the drawer is disabled while open', true),
    dismissible: booleanControl('Whether the drawer can be closed by dragging it', true),
    onOpenChange: hiddenControl,
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

function DrawerPreview({
  open,
  direction,
  modal,
  dismissible,
  children,
}: {
  open: boolean;
  direction: 'top' | 'bottom' | 'left' | 'right';
  modal: boolean;
  dismissible: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  return (
    <Drawer
      open={isOpen}
      onOpenChange={setIsOpen}
      direction={direction}
      modal={modal}
      dismissible={dismissible}
    >
      {children}
    </Drawer>
  );
}

export const Default: Story = {
  args: {
    open: true,
    direction: 'bottom',
    modal: true,
    dismissible: true,
  },
  render: (args) => (
    <DrawerPreview
      open={args.open ?? true}
      direction={(args.direction ?? 'bottom') as 'bottom' | 'left' | 'right' | 'top'}
      modal={args.modal ?? true}
      dismissible={args.dismissible ?? true}
    >
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
    </DrawerPreview>
  ),
};

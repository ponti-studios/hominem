import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { booleanControl, hiddenControl } from '../storybook/controls';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

const meta = {
  title: 'Patterns/Overlay/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  argTypes: {
    open: booleanControl('Controls whether the dialog is open', true),
    modal: booleanControl('Whether interaction outside the dialog is disabled when open', true),
    defaultOpen: hiddenControl,
    onOpenChange: hiddenControl,
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function DialogPreview({
  open,
  modal,
  children,
}: {
  open: boolean;
  modal: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} modal={modal}>
      {children}
    </Dialog>
  );
}

export const Default: Story = {
  args: {
    open: true,
    modal: true,
  },
  render: (args) => (
    <DialogPreview open={args.open ?? true} modal={args.modal ?? true}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="name" className="text-right text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              defaultValue="Pedro Duarte"
              className="col-span-3 h-9 rounded-md border px-3 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </DialogPreview>
  ),
};

export const WithCloseButton: Story = {
  args: {
    open: true,
    modal: true,
  },
  render: (args) => (
    <DialogPreview open={args.open ?? true} modal={args.modal ?? true}>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Confirmation</DialogTitle>
          <DialogDescription>Are you sure you want to proceed?</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </DialogPreview>
  ),
};

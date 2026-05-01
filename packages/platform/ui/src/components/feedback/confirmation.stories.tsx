import type { Meta, StoryObj } from '@storybook/react-vite';

import { hiddenControl, selectControl, textControl } from '../../storybook/controls';
import { ConfirmationBanner } from './confirmation';

const meta = {
  title: 'Patterns/Feedback/Confirmation',
  component: ConfirmationBanner,
  tags: ['autodocs'],
  argTypes: {
    type: selectControl(
      ['info', 'success', 'warning', 'error', 'question'] as const,
      'Banner style and icon treatment',
      {
        defaultValue: 'info',
      },
    ),
    title: textControl('Title shown in the confirmation banner'),
    message: textControl('Supporting message shown below the title'),
    confirmLabel: textControl('Text shown on the confirm action button'),
    cancelLabel: textControl('Text shown on the cancel action button'),
    onConfirm: hiddenControl,
    onCancel: hiddenControl,
  },
} satisfies Meta<typeof ConfirmationBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    type: 'info',
    title: 'Would you like to proceed?',
    message: 'This will create a new note with the detected content.',
    confirmLabel: 'Create Note',
    cancelLabel: 'Dismiss',
  },
};

export const Warning: Story = {
  args: {
    type: 'warning',
    title: 'Delete this item?',
    message: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Keep',
  },
};

export const Success: Story = {
  args: {
    type: 'success',
    title: 'Note created successfully',
    message: 'Your note has been saved.',
    confirmLabel: 'View Note',
    cancelLabel: 'Dismiss',
  },
};

export const Question: Story = {
  args: {
    type: 'question',
    title: 'Should I also update your calendar?',
    message: 'I noticed a date mentioned. Want me to add an event?',
    confirmLabel: 'Yes, add event',
    cancelLabel: 'No thanks',
  },
};

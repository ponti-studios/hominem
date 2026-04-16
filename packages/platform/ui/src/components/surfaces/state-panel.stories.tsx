import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileText, UserPlus } from 'lucide-react';

import { Button } from '../button';
import { StatePanel } from './state-panel';

const meta = {
  title: 'Surfaces/StatePanel',
  component: StatePanel,
  tags: ['autodocs'],
} satisfies Meta<typeof StatePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    icon: <FileText className="size-5" />,
    title: 'Nothing here yet',
    description: 'New items will appear once work starts moving through this space.',
  },
};

export const WithActions: Story = {
  render: (args) => <StatePanel {...args} actions={<Button size="sm">Create item</Button>} />,
  args: {
    icon: <UserPlus className="size-5" />,
    title: 'Invite collaborators',
    description: 'Bring more people into this workspace when you are ready.',
    variant: 'dashed',
  },
};

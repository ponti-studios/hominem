import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../button';
import { SectionIntro } from './section-intro';

const meta = {
  title: 'Surfaces/SectionIntro',
  component: SectionIntro,
  tags: ['autodocs'],
  args: {
    title: 'Recent documents',
  },
} satisfies Meta<typeof SectionIntro>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    eyebrow: 'Workspace',
    title: 'Recent documents',
    description: 'Everything active across notes, chats, and other records in one place.',
  },
};

export const WithActions: Story = {
  render: (args) => <SectionIntro {...args} actions={<Button size="sm">Create new</Button>} />,
  args: {
    eyebrow: 'Library',
    title: 'Project archive',
    description: 'Browse the latest material without switching context.',
  },
};

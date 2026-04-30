import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from './conversation';

const meta = {
  title: 'Patterns/AI/Conversation',
  component: Conversation,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof Conversation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <Conversation>
      <ConversationContent>
        <div className="bg-muted rounded-md p-3 max-w-[80%] self-start">
          <p className="text-sm">Hello! How can I help you today?</p>
        </div>
        <div className="bg-primary text-primary-foreground rounded-md p-3 max-w-[80%] self-end ml-auto">
          <p className="text-sm">I need help writing a report.</p>
        </div>
        <div className="bg-muted rounded-md p-3 max-w-[80%] self-start">
          <p className="text-sm">
            I&apos;d be happy to help you write a report. What&apos;s the topic?
          </p>
        </div>
      </ConversationContent>
    </Conversation>
  ),
};

export const EmptyState: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="flex h-64 items-center justify-center">
      <ConversationEmptyState />
    </div>
  ),
};

export const WithScrollButton: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="relative flex h-64 items-end justify-center pb-4">
      <ConversationScrollButton />
    </div>
  ),
};

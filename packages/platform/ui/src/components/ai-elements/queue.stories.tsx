import type { Meta, StoryObj } from '@storybook/react-vite';

import { Queue, QueueContent, QueueHeader, QueueItem } from './queue';

const meta = {
  title: 'Patterns/AI/Queue',
  component: Queue,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof Queue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <Queue className="max-w-sm">
      <QueueHeader title="Task Queue" count={3} />
      <QueueContent>
        <QueueItem
          id="1"
          status="completed"
          title="Fetch user data"
          description="Retrieved 42 records."
        />
        <QueueItem
          id="2"
          status="running"
          title="Process records"
          description="Analyzing each entry..."
        />
        <QueueItem
          id="3"
          status="pending"
          title="Generate report"
          description="Waiting for processing."
        />
      </QueueContent>
    </Queue>
  ),
};

export const WithError: Story = {
  args: {
    children: null,
  },
  render: () => (
    <Queue className="max-w-sm">
      <QueueHeader title="Queue" count={2} />
      <QueueContent>
        <QueueItem id="1" status="error" title="Send email" description="Failed: SMTP timeout." />
        <QueueItem id="2" status="paused" title="Upload files" description="Paused by user." />
      </QueueContent>
    </Queue>
  ),
};

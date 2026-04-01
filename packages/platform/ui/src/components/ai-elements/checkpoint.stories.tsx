import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  booleanControl,
  hiddenControl,
  selectControl,
  textControl,
} from '../../storybook/controls';
import { Checkpoint, CheckpointList, CheckpointProgress } from './checkpoint';

const checkpointStatusOptions = ['pending', 'in-progress', 'completed', 'error'] as const;

const meta: Meta<typeof Checkpoint> = {
  title: 'Patterns/AI/Checkpoint',
  component: Checkpoint,
  tags: ['autodocs'],
  argTypes: {
    status: selectControl(
      checkpointStatusOptions,
      'Current progress state shown by the checkpoint',
      {
        defaultValue: 'pending',
      },
    ),
    title: textControl('Title shown for the checkpoint step'),
    description: textControl('Supporting description for the checkpoint'),
    isActive: booleanControl('Highlights the checkpoint as active', false),
    children: hiddenControl,
  },
};
export default meta;
type Story = StoryObj<typeof Checkpoint>;

export const Default: Story = {
  args: {
    title: 'Analyze requirements',
    description: 'Reading and understanding the task requirements.',
    status: 'pending',
    isActive: false,
  },
};

export const Statuses: Story = {
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <CheckpointList>
      <Checkpoint title="Plan approach" status="completed" description="Analyzed requirements." />
      <Checkpoint
        title="Write code"
        status="in-progress"
        description="Currently implementing..."
        isActive
      />
      <Checkpoint title="Run tests" status="pending" description="Waiting to run." />
      <Checkpoint title="Deploy" status="error" description="Failed at previous step." />
    </CheckpointList>
  ),
};

export const WithProgress: Story = {
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <div className="w-64 space-y-4">
      <CheckpointProgress current={2} total={5} label="Steps completed" />
    </div>
  ),
};

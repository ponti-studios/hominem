import type { Meta, StoryObj } from '@storybook/react-vite';

import { hiddenControl, selectControl, textControl } from '../../storybook/controls';
import { Task, TaskList, TaskStatusBadge } from './task';

const meta = {
  title: 'Patterns/AI/Task',
  component: Task,
  tags: ['autodocs'],
  argTypes: {
    status: selectControl(
      ['pending', 'in-progress', 'completed', 'cancelled'] as const,
      'Task completion state',
      {
        defaultValue: 'pending',
      },
    ),
    priority: selectControl(['low', 'medium', 'high'] as const, 'Task priority level', {
      defaultValue: 'medium',
    }),
    title: textControl('Primary title for the task card'),
    description: textControl('Supporting description shown below the title'),
    dueDate: textControl('Due date label shown in the task footer'),
    assignee: textControl('Person assigned to the task'),
    onToggle: hiddenControl,
  },
} satisfies Meta<typeof Task>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Review pull request',
    description: 'Check the new authentication flow changes.',
    status: 'pending',
    priority: 'high',
    dueDate: 'Mar 20, 2026',
  },
};

export const Completed: Story = {
  args: {
    title: 'Write unit tests',
    description: 'Add coverage for the new components.',
    status: 'completed',
    priority: 'medium',
  },
};

export const TaskListStory: Story = {
  args: {
    title: '',
    status: 'pending',
  },
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <TaskList>
      <Task title="Design mockups" status="completed" priority="low" />
      <Task
        title="Implement features"
        status="in-progress"
        priority="high"
        dueDate="Mar 25, 2026"
      />
      <Task
        title="Write docs"
        status="pending"
        priority="medium"
        description="Document all new APIs."
      />
      <Task title="Deploy" status="pending" priority="high" dueDate="Apr 1, 2026" />
    </TaskList>
  ),
};

export const StatusBadges: Story = {
  args: {
    title: '',
    status: 'pending',
  },
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <TaskStatusBadge status="pending" />
      <TaskStatusBadge status="in-progress" />
      <TaskStatusBadge status="completed" />
      <TaskStatusBadge status="cancelled" />
    </div>
  ),
};

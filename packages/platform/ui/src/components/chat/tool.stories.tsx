import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tool, ToolInput, ToolOutput } from './tool';

function ToolPreview(props: {
  name: string;
  status?: 'pending' | 'running' | 'completed' | 'error';
  children: React.ReactNode;
}) {
  return <Tool {...props} />;
}

const meta = {
  title: 'Patterns/Chat/Tool',
  component: ToolPreview,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof ToolPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completed: Story = {
  args: {
    name: 'search_web',
    status: 'completed',
    children: null,
  },
  render: (args) => (
    <div className="max-w-sm">
      <Tool {...args}>
        <ToolInput>{`{ "query": "React hooks tutorial" }`}</ToolInput>
        <ToolOutput>{`Found 12 relevant results.`}</ToolOutput>
      </Tool>
    </div>
  ),
};

export const Running: Story = {
  args: {
    name: 'read_file',
    status: 'running',
    children: null,
  },
  render: (args) => (
    <div className="max-w-sm">
      <Tool {...args}>
        <ToolInput>{`{ "path": "/src/components/button.tsx" }`}</ToolInput>
      </Tool>
    </div>
  ),
};

export const Error: Story = {
  args: {
    name: 'write_file',
    status: 'error',
    children: null,
  },
  render: (args) => (
    <div className="max-w-sm">
      <Tool {...args}>
        <ToolInput>{`{ "path": "/output.txt", "content": "Hello" }`}</ToolInput>
        <ToolOutput isError>{`Error: Permission denied`}</ToolOutput>
      </Tool>
    </div>
  ),
};

export const Pending: Story = {
  args: {
    name: 'execute_code',
    status: 'pending',
    children: null,
  },
  render: (args) => (
    <div className="max-w-sm">
      <Tool {...args}>
        <ToolInput>{`{ "language": "python", "code": "print('Hello')" }`}</ToolInput>
      </Tool>
    </div>
  ),
};

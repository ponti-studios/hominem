import type { Meta, StoryObj } from '@storybook/react-vite';

import { Reasoning, ReasoningContent } from './reasoning';

function ReasoningPreview(props: {
  children: React.ReactNode;
  isOpen?: boolean;
  className?: string;
}) {
  return <Reasoning {...props} />;
}

const meta = {
  title: 'Patterns/AI/Reasoning',
  component: ReasoningPreview,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof ReasoningPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ReasoningPreview className="max-w-md">
      The user is asking about component architecture. I should consider their level of expertise
      and provide a clear, structured explanation with examples.
    </ReasoningPreview>
  ),
};

export const Open: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ReasoningPreview isOpen className="max-w-md">
      The user is asking about component architecture. I should consider their level of expertise
      and provide a clear, structured explanation with examples. Let me think about this step by
      step: 1. First, understand the user's current knowledge level 2. Choose appropriate
      terminology 3. Provide practical examples
    </ReasoningPreview>
  ),
};

export const ContentOnly: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ReasoningContent className="max-w-md text-sm text-muted-foreground p-4 bg-muted rounded-md">
      Analyzing the request... The user wants to understand Storybook story patterns. I'll focus on
      practical, copy-paste examples.
    </ReasoningContent>
  ),
};

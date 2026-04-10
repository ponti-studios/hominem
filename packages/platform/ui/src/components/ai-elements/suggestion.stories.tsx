import type { Meta, StoryObj } from '@storybook/react-vite';

import { Suggestion, Suggestions } from './suggestion';

const meta = {
  title: 'Patterns/AI/Suggestion',
  component: Suggestions,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof Suggestions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <Suggestions>
      <Suggestion suggestion="How does this work?" onSuggestionClick={() => {}} />
      <Suggestion suggestion="Show me an example" onSuggestionClick={() => {}} />
      <Suggestion suggestion="What are the alternatives?" onSuggestionClick={() => {}} />
    </Suggestions>
  ),
};

export const SingleSuggestion: Story = {
  args: {
    children: null,
  },
  render: () => <Suggestion suggestion="Tell me more" onSuggestionClick={() => {}} />,
};

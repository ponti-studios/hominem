import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState } from 'react';

import { hiddenControl, textControl } from '../../storybook/controls';
import { ChatHeader } from './chat-header';

const meta = {
  title: 'Patterns/Chat/ChatHeader',
  component: ChatHeaderPreview,
  tags: ['autodocs'],
  argTypes: {
    searchQuery: textControl('Text shown in the search input'),
    searchInputRef: hiddenControl,
    onChangeSearchQuery: hiddenControl,
  },
} satisfies Meta<typeof ChatHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

function ChatHeaderPreview({ searchQuery }: { searchQuery: string }) {
  const [currentSearchQuery, setCurrentSearchQuery] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentSearchQuery(searchQuery);
  }, [searchQuery]);

  return (
    <ChatHeader
      searchQuery={currentSearchQuery}
      searchInputRef={searchInputRef}
      onChangeSearchQuery={setCurrentSearchQuery}
    />
  );
}

export const Empty: Story = {
  args: {
    searchQuery: '',
  },
  render: (args) => <ChatHeaderPreview searchQuery={args.searchQuery ?? ''} />,
};

export const WithQuery: Story = {
  args: {
    searchQuery: 'onboarding',
  },
  render: (args) => <ChatHeaderPreview searchQuery={args.searchQuery ?? ''} />,
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState } from 'react';

import {
  booleanControl,
  hiddenControl,
  numberControl,
  textControl,
} from '../../storybook/controls';
import { ChatSearchModal } from './chat-search-modal';

const meta = {
  title: 'Patterns/Chat/ChatSearchModal',
  component: ChatSearchModal,
  tags: ['autodocs'],
  argTypes: {
    visible: booleanControl('Controls whether the search modal is visible', true),
    searchQuery: textControl('Current search query text'),
    resultCount: numberControl('Number of matching results', { min: 0 }),
    searchInputRef: hiddenControl,
    onClose: hiddenControl,
    onChangeSearchQuery: hiddenControl,
  },
} satisfies Meta<typeof ChatSearchModal>;

export default meta;

type Story = StoryObj<typeof ChatSearchModal>;

function ChatSearchModalPreview({
  visible,
  searchQuery,
  resultCount,
}: {
  visible: boolean;
  searchQuery: string;
  resultCount: number;
}) {
  const [isVisible, setIsVisible] = useState(visible);
  const [currentSearchQuery, setCurrentSearchQuery] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    setCurrentSearchQuery(searchQuery);
  }, [searchQuery]);

  return (
    <ChatSearchModal
      visible={isVisible}
      searchQuery={currentSearchQuery}
      resultCount={resultCount}
      searchInputRef={searchInputRef}
      onClose={() => setIsVisible(false)}
      onChangeSearchQuery={setCurrentSearchQuery}
    />
  );
}

export const Empty: Story = {
  args: {
    visible: true,
    searchQuery: '',
    resultCount: 0,
  },
  render: (args) => (
    <ChatSearchModalPreview
      visible={args.visible ?? true}
      searchQuery={args.searchQuery ?? ''}
      resultCount={args.resultCount ?? 0}
    />
  ),
};

export const WithResults: Story = {
  args: {
    visible: true,
    searchQuery: 'plan',
    resultCount: 4,
  },
  render: (args) => (
    <ChatSearchModalPreview
      visible={args.visible ?? true}
      searchQuery={args.searchQuery ?? ''}
      resultCount={args.resultCount ?? 0}
    />
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import {
  booleanControl,
  hiddenControl,
  selectControl,
  textControl,
} from '../../storybook/controls';
import { TagSelect, type TagOption } from './tag-select';

const tags: TagOption[] = [
  { id: 'groceries', name: 'Groceries' },
  { id: 'travel', name: 'Travel' },
  { id: 'software', name: 'Software' },
];

const tagOptions = ['all', ...tags.map((tag) => tag.id)] as const;

const meta: Meta<typeof TagSelect> = {
  title: 'Patterns/Finance/TagSelect',
  component: TagSelect,
  tags: ['autodocs'],
  argTypes: {
    selectedTag: selectControl(tagOptions, 'Currently selected tag', {
      defaultValue: 'all',
    }),
    isLoading: booleanControl('Shows the loading placeholder state', false),
    placeholder: textControl('Placeholder text shown when no tag is selected'),
    label: textControl('Label displayed above the select'),
    tags: hiddenControl,
    onTagChange: hiddenControl,
    className: hiddenControl,
  },
  args: {
    selectedTag: 'all',
    tags,
    isLoading: false,
    placeholder: 'All tags',
    label: 'Tag',
  },
  render: (args) => {
    const [selectedTag, setSelectedTag] = useState(args.selectedTag);

    useEffect(() => {
      setSelectedTag(args.selectedTag);
    }, [args.selectedTag]);

    return <TagSelect {...args} selectedTag={selectedTag} onTagChange={setSelectedTag} />;
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    tags: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    tags: [],
  },
};

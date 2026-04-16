import type { Meta, StoryObj } from '@storybook/react-vite';

import { SearchInput } from './search-input';

const meta = {
  title: 'Forms/SearchInput',
  component: SearchInput,
  tags: ['autodocs'],
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Search...',
    onSearchChange: () => {},
  },
};

export const WithValue: Story = {
  args: {
    value: 'react',
    placeholder: 'Search...',
    onSearchChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Search...',
    disabled: true,
    onSearchChange: () => {},
  },
};

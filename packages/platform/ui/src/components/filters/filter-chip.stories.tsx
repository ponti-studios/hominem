import type { Meta, StoryObj } from '@storybook/react-vite';

import { hiddenControl, textControl } from '../../storybook/controls';
import { FilterChip } from './filter-chip';

const meta = {
  title: 'Patterns/Filters/FilterChip',
  component: FilterChip,
  tags: ['autodocs'],
  argTypes: {
    label: textControl('Label displayed inside the filter chip'),
    onRemove: hiddenControl,
    onClick: hiddenControl,
  },
} satisfies Meta<typeof FilterChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Status: Active',
    onRemove: () => {},
  },
};

export const Clickable: Story = {
  args: {
    label: 'Category: Work',
    onRemove: () => {},
    onClick: () => {},
  },
};

export const Multiple: Story = {
  args: {
    label: 'Filter',
    onRemove: () => {},
  },
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <FilterChip label="Status: Active" onRemove={() => {}} />
      <FilterChip label="Type: Invoice" onRemove={() => {}} />
      <FilterChip label="Date: Last 7 days" onRemove={() => {}} />
    </div>
  ),
};

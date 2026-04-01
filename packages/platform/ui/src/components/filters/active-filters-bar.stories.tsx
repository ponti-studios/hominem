import type { Meta, StoryObj } from '@storybook/react-vite';

import { hiddenControl, textControl } from '../../storybook/controls';
import { ActiveFiltersBar } from './active-filters-bar';

const meta: Meta<typeof ActiveFiltersBar> = {
  title: 'Patterns/Filters/ActiveFiltersBar',
  component: ActiveFiltersBar,
  tags: ['autodocs'],
  argTypes: {
    label: textControl('Optional label shown before the filter chips'),
    filters: hiddenControl,
    className: hiddenControl,
  },
};
export default meta;
type Story = StoryObj<typeof ActiveFiltersBar>;

export const Default: Story = {
  args: {
    filters: [
      { id: '1', label: 'Status: Active', onRemove: () => {} },
      { id: '2', label: 'Type: Invoice', onRemove: () => {} },
      { id: '3', label: 'Date: Last 30 days', onRemove: () => {} },
    ],
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Active filters:',
    filters: [
      { id: '1', label: 'Category: Work', onRemove: () => {} },
      { id: '2', label: 'Priority: High', onRemove: () => {} },
    ],
  },
};

export const Empty: Story = {
  parameters: {
    controls: {
      disable: true,
    },
  },
  args: {
    filters: [],
  },
};

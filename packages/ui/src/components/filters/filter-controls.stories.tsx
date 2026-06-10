import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ActiveFilter } from './active-filters-bar';
import { FilterControls, type FilterControlsProps } from './filter-controls';

interface FilterControlsPreviewProps {
  children: React.ReactNode;
  showActiveFilters?: boolean;
  activeFilters?: ActiveFilter[];
}

function FilterControlsPreview(props: FilterControlsPreviewProps) {
  const { children, showActiveFilters, activeFilters, ...rest } = props;

  const filterControlsProps: FilterControlsProps = {
    children,
    ...(showActiveFilters !== undefined && { showActiveFilters }),
    ...(activeFilters !== undefined && { activeFilters }),
    ...rest,
  };

  return <FilterControls {...filterControlsProps} />;
}

const meta = {
  title: 'Patterns/Filters/FilterControls',
  component: FilterControlsPreview,
  tags: ['autodocs'],
} satisfies Meta<typeof FilterControlsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: null,
  },
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <FilterControls>
      <select className="h-9 rounded-md border px-3 text-sm">
        <option>All statuses</option>
        <option>Active</option>
        <option>Inactive</option>
      </select>
      <select className="h-9 rounded-md border px-3 text-sm">
        <option>All types</option>
        <option>Invoice</option>
        <option>Payment</option>
      </select>
    </FilterControls>
  ),
};

export const WithActiveFilters: Story = {
  args: {
    children: null,
  },
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <FilterControls
      showActiveFilters
      activeFilters={[
        { id: '1', label: 'Status: Active', onRemove: () => {} },
        { id: '2', label: 'Type: Invoice', onRemove: () => {} },
      ]}
    >
      <select className="h-9 rounded-md border px-3 text-sm">
        <option>Active</option>
      </select>
      <select className="h-9 rounded-md border px-3 text-sm">
        <option>Invoice</option>
      </select>
    </FilterControls>
  ),
};

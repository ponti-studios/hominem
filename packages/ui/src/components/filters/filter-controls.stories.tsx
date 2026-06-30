import type { Meta, StoryObj } from "@storybook/react-vite";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import type { ActiveFilter } from "./active-filters-bar";
import { FilterControls, type FilterControlsProps } from "./filter-controls";

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
  title: "Patterns/Filters/FilterControls",
  component: FilterControlsPreview,
  tags: ["autodocs"],
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
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="invoice">Invoice</SelectItem>
          <SelectItem value="payment">Payment</SelectItem>
        </SelectContent>
      </Select>
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
        { id: "1", label: "Status: Active", onRemove: () => {} },
        { id: "2", label: "Type: Invoice", onRemove: () => {} },
      ]}
    >
      <Select defaultValue="active">
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Active" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue="invoice">
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Invoice" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="invoice">Invoice</SelectItem>
        </SelectContent>
      </Select>
    </FilterControls>
  ),
};

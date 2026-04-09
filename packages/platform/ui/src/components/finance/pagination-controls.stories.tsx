import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { hiddenControl, numberControl } from '../../storybook/controls';
import { PaginationControls, type PaginationControlsProps } from './pagination-controls';

const meta: Meta<PaginationControlsProps> = {
  title: 'Patterns/Finance/PaginationControls',
  component: PaginationControls,
  tags: ['autodocs'],
  argTypes: {
    currentPage: numberControl('Zero-based page index currently shown', {
      defaultValue: 0,
      min: 0,
    }),
    totalPages: numberControl('Total number of pages available', { defaultValue: 5, min: 0 }),
    onPageChange: hiddenControl,
  },
  args: {
    currentPage: 0,
    totalPages: 5,
    onPageChange: () => {},
  },
  render: (args) => {
    const [currentPage, setCurrentPage] = useState(args.currentPage);

    useEffect(() => {
      setCurrentPage(args.currentPage);
    }, [args.currentPage]);

    return (
      <div className="w-full max-w-xl">
        <PaginationControls {...args} currentPage={currentPage} onPageChange={setCurrentPage} />
      </div>
    );
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LastPage: Story = {
  args: {
    currentPage: 4,
    onPageChange: () => {},
  },
};

export const HiddenWhenEmpty: Story = {
  parameters: {
    controls: {
      disable: true,
    },
  },
  args: {
    totalPages: 0,
    onPageChange: () => {},
  },
};

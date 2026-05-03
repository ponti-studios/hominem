import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';

function CollapsiblePreview() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full max-w-md">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger text="@peduarte starred 3 repositories" />
        <CollapsibleContent>
          <div className="rounded-md border px-4 py-2 font-mono text-sm">@radix-ui/primitives</div>
          <div className="rounded-md border px-4 py-2 font-mono text-sm">@radix-ui/colors</div>
          <div className="rounded-md border px-4 py-2 font-mono text-sm">@stitches/react</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const meta = {
  title: 'Patterns/DataDisplay/Collapsible',
  component: CollapsiblePreview,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof CollapsiblePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

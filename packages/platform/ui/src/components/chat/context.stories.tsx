import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  CitationMarker,
  Context,
  ContextContent,
  ContextHeader,
  ContextItem,
  InlineCitation,
} from './context';

function ContextPreview(props: { children: React.ReactNode }) {
  return <Context {...props} />;
}

const meta = {
  title: 'Patterns/Chat/Context',
  component: ContextPreview,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof ContextPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="max-w-sm">
      <Context>
        <ContextHeader title="Context" count={2} />
        <ContextContent>
          <ContextItem>
            <p className="text-sm font-medium">Meeting Notes — March 2024</p>
            <p className="text-xs text-muted-foreground mt-1">
              Discussed Q1 planning and team capacity.
            </p>
          </ContextItem>
          <ContextItem>
            <p className="text-sm font-medium">Project Brief</p>
            <p className="text-xs text-muted-foreground mt-1">
              Overview of the new product feature requirements.
            </p>
          </ContextItem>
        </ContextContent>
      </Context>
    </div>
  ),
};

export const Citations: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="space-y-4 max-w-sm">
      <p className="text-sm">
        The framework was released in 2020
        <InlineCitation index={1} />. It has since gained widespread adoption
        <InlineCitation index={2} />.
      </p>
      <div className="flex gap-2 items-center">
        <CitationMarker index={1} />
        <span className="text-sm text-muted-foreground">Release announcement post</span>
      </div>
      <div className="flex gap-2 items-center">
        <CitationMarker index={2} />
        <span className="text-sm text-muted-foreground">State of JS survey 2023</span>
      </div>
    </div>
  ),
};

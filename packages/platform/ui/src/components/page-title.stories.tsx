import type { Meta, StoryObj } from '@storybook/react-vite';

import { hiddenControl, selectControl, textControl } from '../storybook/controls';
import { PageTitle } from './page-title';
import { Button } from './ui/button';

const meta = {
  title: 'Layout/PageTitle',
  component: PageTitle,
  tags: ['autodocs'],
  args: {
    title: 'Page Title',
  },
  argTypes: {
    title: textControl('Primary heading text shown in the page title'),
    subtitle: textControl('Optional subtitle shown below the title'),
    variant: selectControl(
      ['serif', 'sans', 'large'] as const,
      'Typography variant used for the title',
      {
        defaultValue: 'serif',
      },
    ),
    actions: hiddenControl,
    className: hiddenControl,
  },
} satisfies Meta<typeof PageTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSubtitle: Story = {
  args: {
    title: 'My Notes',
    subtitle: '24 notes',
  },
};

export const WithActions: Story = {
  args: {
    title: 'My Notes',
    subtitle: '24 notes',
  },
  render: (args) => <PageTitle {...args} actions={<Button size="sm">New Note</Button>} />,
};

export const Variants: Story = {
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="body-4 text-text-tertiary mb-2">serif (default)</p>
        <PageTitle title="Serif Heading" subtitle="Subtitle text" />
      </div>
      <div>
        <p className="body-4 text-text-tertiary mb-2">sans</p>
        <PageTitle title="Sans Heading" subtitle="Subtitle text" variant="sans" />
      </div>
      <div>
        <p className="body-4 text-text-tertiary mb-2">large</p>
        <PageTitle title="Large Heading" subtitle="Subtitle text" variant="large" />
      </div>
    </div>
  ),
};

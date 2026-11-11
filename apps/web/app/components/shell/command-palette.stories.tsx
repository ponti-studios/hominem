import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';

import { CommandPalette } from './command-palette';

const meta = {
  title: 'Shell/Command Palette',
  component: CommandPalette,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onClose: () => {} },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

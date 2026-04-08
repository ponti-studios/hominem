import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { Heading } from '../typography/heading';
import { Text } from '../typography/text';
import { Page } from './page';

const meta = {
  title: 'Layout/Page',
  component: Page,
  tags: ['autodocs'],
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Page maxWidth="sm" className="py-8">
      <Heading level={1}>Account Settings</Heading>
      <Text muted>Manage your profile, security, and session preferences.</Text>
    </Page>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Account Settings' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Manage your profile, security, and session preferences.'),
    ).toBeInTheDocument();
  },
};

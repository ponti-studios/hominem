import type { Meta, StoryObj } from '@storybook/react-vite';
import { Paperclip } from 'lucide-react';

import { MetaBadge } from './meta-badge';
import { PreviewCard } from './preview-card';

const meta = {
  title: 'Surfaces/PreviewCard',
  component: PreviewCard,
  tags: ['autodocs'],
} satisfies Meta<typeof PreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <PreviewCard interactive>
      <PreviewCard.Header meta={<div>Apr 6, 2026</div>}>
        <PreviewCard.Title>Quarterly planning notes</PreviewCard.Title>
        <PreviewCard.Description>
          Shared priorities, open questions, and the latest direction for the team.
        </PreviewCard.Description>
      </PreviewCard.Header>
      <PreviewCard.Footer>
        <MetaBadge icon={<Paperclip className="size-3" />}>Files</MetaBadge>
      </PreviewCard.Footer>
    </PreviewCard>
  ),
};

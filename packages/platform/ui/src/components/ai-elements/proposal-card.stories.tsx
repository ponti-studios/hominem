import type { ReviewItem } from '@hominem/rpc/types';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { hiddenControl, selectControl, textControl } from '../../storybook/controls';
import { ProposalCard, ProposalList } from './proposal-card';

const proposalTypeOptions = ['note', 'task', 'task_list', 'tracker'] as const;

type ProposalCardStoryArgs = {
  proposedType: ReviewItem['proposedType'];
  proposedTitle: string;
  onReview: () => void;
  onReject: () => void;
};

const reviewItemTemplate: Omit<ReviewItem, 'proposedType' | 'proposedTitle'> = {
  id: '1',
  sessionId: 'session-1',
  proposedChanges: ['Summarised 12 discussion points', 'Extracted 3 action items'],
  previewContent: '# Q3 Planning\n\nKey decisions made today...',
  createdAt: '2026-04-01T00:00:00.000Z',
};

function ProposalCardPreview({
  proposedType,
  proposedTitle,
  onReview,
  onReject,
}: ProposalCardStoryArgs) {
  return (
    <ProposalCard
      item={proposalCardItem(proposedType, proposedTitle)}
      onReview={onReview}
      onReject={onReject}
    />
  );
}

function proposalCardItem(
  proposedType: ReviewItem['proposedType'],
  proposedTitle: string,
): ReviewItem {
  return {
    ...reviewItemTemplate,
    proposedType,
    proposedTitle,
  };
}

const meta = {
  title: 'Patterns/AI/ProposalCard',
  component: ProposalCardPreview,
  tags: ['autodocs'],
  argTypes: {
    proposedType: selectControl(proposalTypeOptions, 'Type of proposal shown in the card', {
      defaultValue: 'note',
    }),
    proposedTitle: textControl('Title shown for the proposal card'),
    onReview: hiddenControl,
    onReject: hiddenControl,
  },
} satisfies Meta<typeof ProposalCardPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Note: Story = {
  args: {
    proposedType: 'note',
    proposedTitle: 'Meeting notes from Q3 planning',
    onReview: () => undefined,
    onReject: () => undefined,
  },
};

export const Task: Story = {
  args: {
    proposedType: 'task',
    proposedTitle: 'Follow up with design team',
    onReview: () => undefined,
    onReject: () => undefined,
  },
};

export const List: Story = {
  args: {
    proposedType: 'note',
    proposedTitle: '',
    onReview: () => undefined,
    onReject: () => undefined,
  },
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => (
    <ProposalList
      items={[
        proposalCardItem('note', 'Meeting notes from Q3 planning'),
        { ...proposalCardItem('task', 'Send recap email'), id: '2' },
        {
          ...proposalCardItem('task_list', 'Sprint backlog items'),
          id: '3',
        },
      ]}
      onReview={() => undefined}
      onReject={() => undefined}
    />
  ),
};

export const EmptyList: Story = {
  args: {
    proposedType: 'note',
    proposedTitle: '',
    onReview: () => undefined,
    onReject: () => undefined,
  },
  parameters: {
    controls: {
      disable: true,
    },
  },
  render: () => <ProposalList items={[]} onReview={() => {}} onReject={() => {}} />,
};

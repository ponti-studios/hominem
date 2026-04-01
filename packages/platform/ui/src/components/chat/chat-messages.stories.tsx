import type { Meta, StoryObj } from '@storybook/react-vite';

import { booleanControl, hiddenControl, selectControl } from '../../storybook/controls';
import { ChatMessages } from './chat-messages';
import { mockChatMessages } from './chat-story-data';

type ChatMessagesStoryArgs = React.ComponentProps<typeof ChatMessages> & {
  scenario: 'conversation' | 'empty' | 'loading' | 'streaming';
};

const meta = {
  title: 'Patterns/Chat/ChatMessages',
  component: ChatMessages,
  tags: ['autodocs'],
  argTypes: {
    scenario: selectControl(
      ['conversation', 'empty', 'loading', 'streaming'] as const,
      'Message set shown in the preview',
      {
        defaultValue: 'conversation',
      },
    ),
    messages: hiddenControl,
    status: hiddenControl,
    error: hiddenControl,
    speakingId: hiddenControl,
    speechLoadingId: hiddenControl,
    onRegenerate: hiddenControl,
    onEdit: hiddenControl,
    onDelete: hiddenControl,
    onSpeak: hiddenControl,
    showDebug: booleanControl('Shows message metadata in each message row', false),
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<ChatMessagesStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

function ChatMessagesPreview({
  scenario,
  showDebug,
}: {
  scenario: ChatMessagesStoryArgs['scenario'];
  showDebug?: boolean;
}) {
  if (scenario === 'loading') {
    return (
      <div className="w-full bg-background" style={{ height: 360 }}>
        <ChatMessages messages={[]} isLoading showDebug={showDebug} />
      </div>
    );
  }

  if (scenario === 'empty') {
    return (
      <div className="w-full bg-background" style={{ height: 360 }}>
        <ChatMessages messages={[]} status="idle" showDebug={showDebug} />
      </div>
    );
  }

  if (scenario === 'streaming') {
    return (
      <div className="w-full bg-background" style={{ height: 720 }}>
        <ChatMessages messages={mockChatMessages} status="streaming" showDebug={showDebug} />
      </div>
    );
  }

  return (
    <div className="w-full bg-background" style={{ height: 720 }}>
      <ChatMessages messages={mockChatMessages} status="streaming" showDebug={showDebug} />
    </div>
  );
}

export const Conversation: Story = {
  args: {
    scenario: 'conversation',
  },
  render: (args) => <ChatMessagesPreview scenario={args.scenario} showDebug={args.showDebug} />,
};

export const EmptyLoading: Story = {
  args: {
    scenario: 'loading',
  },
  render: (args) => <ChatMessagesPreview scenario={args.scenario} showDebug={args.showDebug} />,
};

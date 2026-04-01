import type { Meta, StoryObj } from '@storybook/react-vite';

import { booleanControl, hiddenControl, selectControl } from '../../storybook/controls';
import type { ExtendedMessage } from '../../types/chat';
import { ChatMessage, type ChatMessageProps } from './chat-message';
import {
  mockAssistantMessage,
  mockStreamingAssistantMessage,
  mockUserMessage,
} from './chat-story-data';

const messageFixtures = {
  assistant: mockAssistantMessage,
  streaming: mockStreamingAssistantMessage,
  user: mockUserMessage,
} as const;

type ChatMessageStoryArgs = ChatMessageProps & {
  fixture: keyof typeof messageFixtures;
};

const meta: Meta<ChatMessageStoryArgs> = {
  title: 'Patterns/Chat/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs'],
  argTypes: {
    fixture: selectControl(
      ['user', 'assistant', 'streaming'] as const,
      'Message fixture shown in the preview',
      {
        defaultValue: 'user',
      },
    ),
    message: hiddenControl,
    isStreaming: hiddenControl,
    speakingId: hiddenControl,
    speechLoadingId: hiddenControl,
    onRegenerate: hiddenControl,
    onEdit: hiddenControl,
    onDelete: hiddenControl,
    onSpeak: hiddenControl,
    showDebug: booleanControl('Shows message metadata in the message body', false),
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

function ChatMessagePreview({
  fixture,
  showDebug,
}: {
  fixture: keyof typeof messageFixtures;
  showDebug?: boolean;
}) {
  const message = messageFixtures[fixture] as ExtendedMessage;

  if (fixture === 'user') {
    return (
      <div className="w-full max-w-3xl bg-background p-4">
        <ChatMessage
          message={message}
          showDebug={showDebug}
          onEdit={() => undefined}
          onDelete={() => undefined}
        />
      </div>
    );
  }

  if (fixture === 'assistant') {
    return (
      <div className="w-full max-w-3xl bg-background p-4">
        <ChatMessage
          message={message}
          showDebug={showDebug}
          onRegenerate={() => undefined}
          onSpeak={() => undefined}
          onDelete={() => undefined}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl bg-background p-4">
      <ChatMessage message={message} showDebug={showDebug} isStreaming onDelete={() => undefined} />
    </div>
  );
}

export const UserMessage: Story = {
  args: {
    fixture: 'user',
  },
  render: (args) => <ChatMessagePreview fixture={args.fixture} showDebug={args.showDebug} />,
};

export const AssistantReply: Story = {
  args: {
    fixture: 'assistant',
  },
  render: (args) => <ChatMessagePreview fixture={args.fixture} showDebug={args.showDebug} />,
};

export const StreamingAssistant: Story = {
  args: {
    fixture: 'streaming',
  },
  render: (args) => <ChatMessagePreview fixture={args.fixture} showDebug={args.showDebug} />,
};

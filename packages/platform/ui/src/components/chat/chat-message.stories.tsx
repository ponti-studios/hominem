import type { Meta, StoryObj } from '@storybook/react-vite';

import { booleanControl, selectControl } from '../../storybook/controls';
import type { ExtendedMessage } from '../../types/chat';
import { ChatMessage } from './chat-message';
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

const meta = {
  title: 'Patterns/Chat/ChatMessage',
  component: ChatMessagePreview,
  tags: ['autodocs'],
  argTypes: {
    fixture: selectControl(
      ['user', 'assistant', 'streaming'] as const,
      'Message fixture shown in the preview',
      {
        defaultValue: 'user',
      },
    ),
    showDebug: booleanControl('Shows message metadata in the message body', false),
  },
} satisfies Meta<typeof ChatMessagePreview>;

function ChatMessagePreview({
  fixture,
  showDebug = false,
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

export default meta;
type Story = StoryObj<typeof meta>;

export const UserMessage: Story = {
  args: {
    fixture: 'user',
    showDebug: false,
  },
};

export const AssistantReply: Story = {
  args: {
    fixture: 'assistant',
    showDebug: false,
  },
};

export const StreamingAssistant: Story = {
  args: {
    fixture: 'streaming',
    showDebug: false,
  },
};

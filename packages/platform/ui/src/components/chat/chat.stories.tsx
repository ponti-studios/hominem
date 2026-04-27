import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';

import { booleanControl, selectControl } from '../../storybook/controls';
import { Chat } from './chat';
import { mockChatMessages, mockSessionSources, renderChatIcon } from './chat-story-data';

type ChatStoryArgs = ComponentProps<typeof Chat> & {
  sourceFixture: 'note' | 'capture';
};

const meta = {
  title: 'Patterns/Chat/Chat',
  component: ChatPreview,
  tags: ['autodocs'],
  argTypes: {
    sourceFixture: selectControl(
      ['note', 'capture'] as const,
      'Session source fixture shown in the preview',
      {
        defaultValue: 'note',
      },
    ),
    status: selectControl(['idle', 'streaming', 'submitted'] as const, 'Message stream status', {
      defaultValue: 'streaming',
    }),
    isLoading: booleanControl('Shows the loading shimmer instead of live messages', false),
    showDebug: booleanControl('Shows message metadata and debug data', false),
    isVoiceModeActive: booleanControl('Shows the voice mode overlay', false),
    isVoiceModeRecording: booleanControl('Shows the recording state in voice mode', false),
    voiceModeState: selectControl(
      ['idle', 'listening', 'processing', 'speaking', 'error'] as const,
      'Voice mode overlay state',
      {
        defaultValue: 'idle',
      },
    ),
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ChatPreview>;

function ChatPreview({
  sourceFixture,
  status = 'streaming',
  isLoading = false,
  showDebug = false,
  isVoiceModeActive = false,
  voiceModeState = 'idle',
  isVoiceModeRecording = false,
}: Pick<
  ChatStoryArgs,
  | 'sourceFixture'
  | 'status'
  | 'isLoading'
  | 'showDebug'
  | 'isVoiceModeActive'
  | 'voiceModeState'
  | 'isVoiceModeRecording'
>) {
  const source = mockSessionSources[sourceFixture];
  const messages = sourceFixture === 'capture' ? mockChatMessages.slice(0, 2) : mockChatMessages;
  const statusCopy = sourceFixture === 'capture' ? 'Voice mode' : 'Active conversation';

  return (
    <div className="w-full bg-background" style={{ height: 760 }}>
      <Chat
        source={source}
        resolvedSource={source}
        statusCopy={statusCopy}
        renderIcon={renderChatIcon}
        messages={messages}
        status={status}
        isLoading={isLoading}
        showDebug={showDebug}
        isVoiceModeActive={isVoiceModeActive}
        voiceModeState={voiceModeState}
        isVoiceModeRecording={isVoiceModeRecording}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onRegenerate={() => undefined}
        onSpeak={() => undefined}
      />
    </div>
  );
}

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    sourceFixture: 'note',
    status: 'streaming',
    isLoading: false,
    showDebug: false,
    isVoiceModeActive: false,
    voiceModeState: 'idle',
    isVoiceModeRecording: false,
  },
};

export const VoiceModeActive: Story = {
  args: {
    sourceFixture: 'capture',
    status: 'idle',
    isLoading: false,
    showDebug: false,
    isVoiceModeActive: true,
    voiceModeState: 'listening',
    isVoiceModeRecording: true,
  },
};

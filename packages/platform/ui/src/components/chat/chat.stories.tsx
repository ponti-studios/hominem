import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';

import { booleanControl, hiddenControl, selectControl } from '../../storybook/controls';
import { Chat } from './chat';
import { mockChatMessages, mockSessionSources, renderChatIcon } from './chat-story-data';

type ChatStoryArgs = ComponentProps<typeof Chat> & {
  sourceFixture: 'note' | 'thought';
};

const meta = {
  title: 'Patterns/Chat/Chat',
  component: ChatPreview,
  tags: ['autodocs'],
  argTypes: {
    sourceFixture: selectControl(
      ['note', 'thought'] as const,
      'Session source fixture shown in the preview',
      {
        defaultValue: 'note',
      },
    ),
    source: hiddenControl,
    resolvedSource: hiddenControl,
    renderIcon: hiddenControl,
    messages: hiddenControl,
    statusCopy: hiddenControl,
    speechErrorMessage: hiddenControl,
    voiceModeErrorMessage: hiddenControl,
    onDebugChange: hiddenControl,
    onTransform: hiddenControl,
    onArchive: hiddenControl,
    onOpenSearch: hiddenControl,
    onToggleVoiceMode: hiddenControl,
    onStartVoiceModeRecording: hiddenControl,
    onStopVoiceModeRecording: hiddenControl,
    onDelete: hiddenControl,
    onEdit: hiddenControl,
    onRegenerate: hiddenControl,
    onSpeak: hiddenControl,
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
    topInset: hiddenControl,
    canTransform: hiddenControl,
    isDebugEnabled: hiddenControl,
    isArchiving: hiddenControl,
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<ChatStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

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
  const messages = sourceFixture === 'thought' ? mockChatMessages.slice(0, 2) : mockChatMessages;
  const statusCopy = sourceFixture === 'thought' ? 'Voice mode' : 'Active conversation';

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
    sourceFixture: 'thought',
    status: 'idle',
    isLoading: false,
    showDebug: false,
    isVoiceModeActive: true,
    voiceModeState: 'listening',
    isVoiceModeRecording: true,
  },
};

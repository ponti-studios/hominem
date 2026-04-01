import type { Meta, StoryObj } from '@storybook/react-vite';
import { Paperclip } from 'lucide-react';
import type { ComponentProps } from 'react';

import {
  booleanControl,
  hiddenControl,
  numberControl,
  selectControl,
  textControl,
} from '../../storybook/controls';
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from './prompt-input';

type PromptInputStoryArgs = ComponentProps<typeof PromptInput> & {
  placeholder: string;
  submitStatus: 'ready' | 'streaming';
  textareaDisabled: boolean;
};

const meta: Meta<PromptInputStoryArgs> = {
  title: 'Patterns/AI/PromptInput',
  component: PromptInput,
  tags: ['autodocs'],
  argTypes: {
    globalDrop: booleanControl('Allows dragging files anywhere in the prompt area', false),
    multiple: booleanControl('Allows selecting multiple files', true),
    maxFiles: numberControl('Maximum number of attachments allowed', { min: 1, defaultValue: 10 }),
    accept: textControl('Accepted file types for attachments'),
    syncHiddenInput: booleanControl('Syncs the hidden file input with attachments state', false),
    placeholder: textControl('Placeholder text shown in the prompt textarea'),
    submitStatus: selectControl(
      ['ready', 'streaming'] as const,
      'Status shown on the submit button',
      {
        defaultValue: 'ready',
      },
    ),
    textareaDisabled: booleanControl('Disables the textarea in the streaming example', false),
    onSubmit: hiddenControl,
    onError: hiddenControl,
    children: hiddenControl,
    className: hiddenControl,
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

function PromptInputPreview({
  placeholder,
  submitStatus,
  textareaDisabled,
  ...props
}: PromptInputStoryArgs) {
  return (
    <PromptInput {...props} className="max-w-lg border rounded-md p-2">
      <PromptInputBody>
        <PromptInputTextarea placeholder={placeholder} disabled={textareaDisabled} />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputButton tooltip="Attach file">
            <Paperclip className="size-4" />
          </PromptInputButton>
        </PromptInputTools>
        <PromptInputSubmit status={submitStatus} />
      </PromptInputFooter>
    </PromptInput>
  );
}

export const Default: Story = {
  args: {
    globalDrop: false,
    multiple: true,
    maxFiles: 10,
    syncHiddenInput: false,
    placeholder: 'Type your message...',
    submitStatus: 'ready',
    textareaDisabled: false,
  },
  render: (args) => <PromptInputPreview {...args} />,
};

export const Streaming: Story = {
  args: {
    globalDrop: false,
    multiple: true,
    maxFiles: 10,
    syncHiddenInput: false,
    placeholder: 'Type your message...',
    submitStatus: 'streaming',
    textareaDisabled: true,
  },
  render: (args) => <PromptInputPreview {...args} />,
};

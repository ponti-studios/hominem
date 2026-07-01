import React from 'react';

import { ChatComposerEntry } from '~/components/composer/ChatComposerContent';
import { ComposerProvider } from '~/components/composer/ComposerContext';
import {
  InboxComposerContent,
  type InboxComposerContentProps,
} from '~/components/composer/InboxComposerContent';

interface ComposerInboxProps {
  mode: 'inbox';
}

interface ComposerChatProps {
  mode: 'chat';
  chatId: string;
  testID?: string;
}

type InboxComposerProps = ComposerInboxProps & InboxComposerContentProps;

export type ComposerProps = InboxComposerProps | ComposerChatProps;

export function Composer(props: ComposerProps) {
  if (props.mode === 'inbox') {
    const { mode: _mode, ...inboxProps } = props;

    return (
      <ComposerProvider>
        <InboxComposerContent {...inboxProps} />
      </ComposerProvider>
    );
  }

  return <ChatComposerEntry key={props.chatId} {...props} />;
}

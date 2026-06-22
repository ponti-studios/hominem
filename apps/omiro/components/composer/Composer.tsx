import React from 'react';

import { ChatComposerEntry } from '~/components/composer/ChatComposerContent';
import { ComposerProvider } from '~/components/composer/ComposerContext';
import {
  FeedComposerContent,
  type FeedComposerContentProps,
} from '~/components/composer/FeedComposerContent';

interface ComposerFeedProps {
  mode: 'feed';
}

interface ComposerChatProps {
  mode: 'chat';
  chatId: string;
  initialMessage?: string;
  testID?: string;
}

type FeedComposerProps = ComposerFeedProps & FeedComposerContentProps;

export type ComposerProps = FeedComposerProps | ComposerChatProps;

export function Composer(props: ComposerProps) {
  if (props.mode === 'feed') {
    const { mode: _mode, ...feedProps } = props;

    return (
      <ComposerProvider>
        <FeedComposerContent {...feedProps} />
      </ComposerProvider>
    );
  }

  return <ChatComposerEntry key={props.chatId} {...props} />;
}

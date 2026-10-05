import { View } from 'react-native';

import { EmptyState } from '~/components/ui';
import t from '~/translations';

import type { InboxTabKind } from './InboxTabScreen';

export function StreamEmptyState({ kind }: { kind: InboxTabKind }) {
  return (
    <View style={{ paddingTop: 48 }}>
      {kind === 'note' ? (
        <EmptyState
          description={t.stream.emptyState.notes.description}
          sfSymbol="note.text"
          title={t.stream.emptyState.notes.title}
          tone="coral"
        />
      ) : (
        <EmptyState
          description={t.stream.emptyState.chats.description}
          sfSymbol="bubble.left"
          title={t.stream.emptyState.chats.title}
          tone="violet"
        />
      )}
    </View>
  );
}

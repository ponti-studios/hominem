import { View } from 'react-native';

import { EmptyState } from '~/components/ui';
import t from '~/translations';

import type { StreamFilter } from './StreamScreen';

interface StreamEmptyStateProps {
  filter: StreamFilter;
}

export function StreamEmptyState({ filter }: StreamEmptyStateProps) {
  return (
    <View style={{ paddingTop: 48 }}>
      <StreamEmptyContent filter={filter} />
    </View>
  );
}

function StreamEmptyContent({ filter }: StreamEmptyStateProps) {
  if (filter === 'notes') {
    return (
      <EmptyState
        description={t.stream.emptyState.notes.description}
        sfSymbol="note.text"
        title={t.stream.emptyState.notes.title}
        tone="coral"
      />
    );
  }

  if (filter === 'chats') {
    return (
      <EmptyState
        description={t.stream.emptyState.chats.description}
        sfSymbol="bubble.left"
        title={t.stream.emptyState.chats.title}
        tone="violet"
      />
    );
  }

  return (
    <EmptyState
      description={t.stream.emptyState.all.description}
      sfSymbol="sparkles"
      title={t.stream.emptyState.all.title}
      tone="sun"
    />
  );
}

import { View } from 'react-native';

import { EmptyState } from '~/components/ui';
import t from '~/translations';

// Shown when a search matches nothing on this tab.
export function StreamSearchEmpty({ query }: { query: string }) {
  return (
    <View style={{ paddingTop: 48 }} testID="stream-search-empty">
      <EmptyState
        description={t.stream.search.emptyDescription}
        sfSymbol="magnifyingglass"
        title={t.stream.search.emptyTitle(query)}
        tone="violet"
      />
    </View>
  );
}

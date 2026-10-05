import { useState } from 'react';

import { StreamScreen, type StreamFilter } from '~/components/inbox/StreamScreen';

export default function StreamRoute() {
  const [filter, setFilter] = useState<StreamFilter>('all');
  return <StreamScreen filter={filter} onFilterChange={setFilter} />;
}

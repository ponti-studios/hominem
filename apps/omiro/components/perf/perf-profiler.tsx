import { Profiler, type ReactNode } from 'react';

import { recordCommit } from '~/services/perf/stream-perf';

// Dev builds only: reports React's render time for this subtree to the stream
// bench. In production it renders its children untouched.
export function PerfProfiler({ id, children }: { id: string; children: ReactNode }) {
  if (!__DEV__) {
    return children;
  }
  return (
    <Profiler id={id} onRender={(_id, _phase, actualDuration) => recordCommit(actualDuration)}>
      {children}
    </Profiler>
  );
}

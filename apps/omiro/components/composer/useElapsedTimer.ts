import { useEffect, useState } from 'react';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Ticks off a fixed `startedAt` timestamp (not a local counter) so the
// elapsed time stays correct even if the panel showing it remounts mid-recording.
export function useElapsedTimer(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (startedAt === null) return '0:00';
  return formatElapsed(now - startedAt);
}

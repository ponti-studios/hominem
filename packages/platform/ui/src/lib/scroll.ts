import type { Virtualizer } from '@tanstack/react-virtual';

export function scrollToBottom(
  container: HTMLDivElement | null,
  virtualizer?: Virtualizer<HTMLDivElement, Element> | null,
  shouldUseVirtual?: boolean,
  lastIndex?: number,
): void {
  if (!container) return;

  if (shouldUseVirtual && virtualizer && lastIndex !== undefined) {
    virtualizer.scrollToIndex(lastIndex, { align: 'end' });
  } else {
    container.scrollTop = container.scrollHeight;
  }
}

export function getScrollDistanceFromBottom(container: HTMLDivElement | null): number {
  if (!container) return Number.POSITIVE_INFINITY;
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

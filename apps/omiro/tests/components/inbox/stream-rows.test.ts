import { describe, expect, it } from 'vitest';

import type { InboxStreamItemData } from '~/components/inbox/InboxStreamItem.types';
import { filterStreamItems, getEnteringItemIds } from '~/components/inbox/stream-rows';

function item(id: string): InboxStreamItemData {
  return {
    id,
    entityId: id,
    title: id,
    preview: null,
    updatedAt: new Date().toISOString(),
    route: `/notes/${id}`,
    kind: 'note',
    variant: 'document',
  };
}

describe('getEnteringItemIds', () => {
  it('returns the leading run of unseen ids for a new capture at the top', () => {
    const items = [item('new-1'), item('old-1'), item('old-2')];

    expect(getEnteringItemIds(items, new Set(['old-1', 'old-2']))).toEqual(new Set(['new-1']));
  });

  it('returns every id in a multi-item unseen run at the top', () => {
    const items = [item('new-1'), item('new-2'), item('old-1')];

    expect(getEnteringItemIds(items, new Set(['old-1']))).toEqual(new Set(['new-1', 'new-2']));
  });

  it('ignores pagination appends below already-seen items', () => {
    const items = [item('old-1'), item('old-2'), item('page-2-a'), item('page-2-b')];

    expect(getEnteringItemIds(items, new Set(['old-1', 'old-2']))).toEqual(new Set());
  });

  it('returns empty when everything was seen, so filter switches mount static', () => {
    const items = [item('a'), item('b')];

    expect(getEnteringItemIds(items, new Set(['a', 'b']))).toEqual(new Set());
  });

  it('returns empty when a seen item reorders to the top', () => {
    const items = [item('bumped'), item('other')];

    expect(getEnteringItemIds(items, new Set(['bumped', 'other']))).toEqual(new Set());
  });
});

describe('filterStreamItems', () => {
  const rows = [
    { ...item('a'), title: 'Trip to Lisbon', preview: 'Book the **flights** first' },
    { ...item('b'), title: 'Groceries', preview: 'Milk, eggs' },
    { ...item('c'), title: null, preview: 'lisbon restaurants' },
  ];

  it('keeps every row for an empty or blank search', () => {
    expect(filterStreamItems(rows, '')).toBe(rows);
    expect(filterStreamItems(rows, '   ')).toBe(rows);
  });

  it('matches the title or the preview, ignoring case', () => {
    expect(filterStreamItems(rows, 'LISBON').map((row) => row.id)).toEqual(['a', 'c']);
  });

  it('requires every word, in any order', () => {
    expect(filterStreamItems(rows, 'flights trip').map((row) => row.id)).toEqual(['a']);
    expect(filterStreamItems(rows, 'trip eggs')).toEqual([]);
  });

  it('searches the preview text, not its markdown', () => {
    expect(filterStreamItems(rows, 'the flights').map((row) => row.id)).toEqual(['a']);
    expect(filterStreamItems(rows, '**')).toEqual([]);
  });
});

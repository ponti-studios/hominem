import { expect } from 'vitest';

const noteFeedIds = {
  newest: '11111111-1111-4111-8111-111111111111',
  middle: '22222222-2222-4222-8222-222222222222',
  oldest: '33333333-3333-4333-8333-333333333333',
} as const;

export function createNoteFeedRows(ownerUserId: string) {
  return [
    {
      id: noteFeedIds.newest,
      owner_userid: ownerUserId,
      title: 'Newest',
      content: 'Newest body',
      createdat: new Date('2026-04-02T12:02:00.000Z'),
      updatedat: new Date('2026-04-02T12:02:00.000Z'),
    },
    {
      id: noteFeedIds.middle,
      owner_userid: ownerUserId,
      title: 'Middle',
      content: 'Middle body',
      createdat: new Date('2026-04-02T12:01:00.000Z'),
      updatedat: new Date('2026-04-02T12:01:00.000Z'),
    },
    {
      id: noteFeedIds.oldest,
      owner_userid: ownerUserId,
      title: 'Oldest',
      content: 'Oldest body',
      createdat: new Date('2026-04-02T12:00:00.000Z'),
      updatedat: new Date('2026-04-02T12:00:00.000Z'),
    },
  ];
}

export function expectFirstNoteFeedPage(page: {
  notes: Array<{ id: string; contentPreview?: string }>;
  nextCursor: string | null;
}) {
  expect(page.notes.map((note) => note.id)).toEqual([noteFeedIds.newest, noteFeedIds.middle]);
  expect(page.notes[0]?.contentPreview).toBe('Newest body');
  expect(page.nextCursor).toBeTruthy();
}

export function expectSecondNoteFeedPage(page: {
  notes: Array<{ id: string }>;
  nextCursor: string | null;
}) {
  expect(page.notes.map((note) => note.id)).toEqual([noteFeedIds.oldest]);
  expect(page.nextCursor).toBeNull();
}

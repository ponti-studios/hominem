import { describe, expect, it } from 'vitest';

import { flattenNoteFeedPages } from './use-notes';

describe('flattenNoteFeedPages', () => {
  it('returns notes in bottom-anchored display order', () => {
    const notes = flattenNoteFeedPages({
      pages: [
        {
          notes: [
            {
              id: 'newest',
              title: 'Newest',
              contentPreview: 'Newest body',
              createdAt: '2026-04-05T12:02:00.000Z',
              authorId: 'user-1',
              metadata: { hasAttachments: false },
            },
            {
              id: 'middle',
              title: 'Middle',
              contentPreview: 'Middle body',
              createdAt: '2026-04-05T12:01:00.000Z',
              authorId: 'user-1',
              metadata: { hasAttachments: false },
            },
          ],
          nextCursor: 'cursor-1',
        },
        {
          notes: [
            {
              id: 'oldest',
              title: 'Oldest',
              contentPreview: 'Oldest body',
              createdAt: '2026-04-05T12:00:00.000Z',
              authorId: 'user-1',
              metadata: { hasAttachments: false },
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [null, 'cursor-1'],
    });

    expect(notes.map((note) => note.id)).toEqual(['oldest', 'middle', 'newest']);
  });
});

import { describe, expect, it } from 'vitest';

import type { InboxStreamItemData } from '~/components/inbox/InboxStreamItem.types';
import { getSpotlightUpdates } from '~/services/system/spotlight';

interface RowInput {
  id: string;
  kind?: 'chat' | 'note';
  preview?: string | null;
  title?: string | null;
}

function row({ id, kind = 'note', preview = null, title = null }: RowInput): InboxStreamItemData {
  const common = {
    entityId: id,
    id,
    preview,
    route: `/${kind}/${id}`,
    title,
    updatedAt: '2026-11-01T10:00:00.000Z',
  };
  return kind === 'chat'
    ? { ...common, kind, variant: 'conversation' }
    : { ...common, kind, variant: 'document' };
}

describe('getSpotlightUpdates', () => {
  it('indexes a titled row with its plain-text preview as the body', () => {
    expect(
      getSpotlightUpdates(
        [row({ id: 'n1', preview: '# Packing\n- **passport**', title: 'Trip' })],
        new Map(),
      ),
    ).toEqual([
      {
        body: 'Packing passport',
        id: 'n1',
        kind: 'note',
        title: 'Trip',
        updatedAt: '2026-11-01T10:00:00.000Z',
      },
    ]);
  });

  it('uses the preview as the title when a row has no title', () => {
    expect(getSpotlightUpdates([row({ id: 'n2', preview: 'call the bank' })], new Map())).toEqual([
      expect.objectContaining({ body: null, id: 'n2', title: 'call the bank' }),
    ]);
  });

  it('skips a row with nothing to search for', () => {
    expect(getSpotlightUpdates([row({ id: 'n3', title: '  ' })], new Map())).toEqual([]);
  });

  it('skips rows already indexed at the same version and re-sends changed ones', () => {
    const known = new Map([
      ['note:same', '2026-11-01T10:00:00.000Z'],
      ['note:changed', '2026-10-01T10:00:00.000Z'],
    ]);
    const updates = getSpotlightUpdates(
      [row({ id: 'same', title: 'Same' }), row({ id: 'changed', title: 'Changed' })],
      known,
    );
    expect(updates.map((update) => update.id)).toEqual(['changed']);
  });

  it('keeps a chat and a note with the same id apart', () => {
    const known = new Map([['note:x', '2026-11-01T10:00:00.000Z']]);
    const chat = row({ id: 'x', kind: 'chat', title: 'Chat' });
    expect(getSpotlightUpdates([chat], known).map((update) => update.kind)).toEqual(['chat']);
  });
});

import { describe, expect, it } from 'vitest';

import {
  describeToolArgs,
  formatToolName,
  getToolCallPhase,
} from '~/components/chat/chat-tool-call.helpers';

describe('getToolCallPhase', () => {
  it('maps confirmation and execution status to the display phase', () => {
    const base = {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'task_create',
      args: {},
    } as const;
    expect(getToolCallPhase({ ...base, confirmationStatus: 'pending' })).toBe('asking');
    expect(getToolCallPhase({ ...base, confirmationStatus: 'rejected' })).toBe('rejected');
    expect(getToolCallPhase({ ...base, executionStatus: 'failed' })).toBe('failed');
    expect(getToolCallPhase({ ...base, executionStatus: 'completed' })).toBe('done');
    expect(getToolCallPhase(base)).toBe('running');
  });
});

describe('formatToolName', () => {
  it('turns identifiers into sentence-case labels', () => {
    expect(formatToolName('create_collection')).toBe('Create collection');
    expect(formatToolName('createCollection')).toBe('Create collection');
  });
});

describe('describeToolArgs', () => {
  it('lists arguments as label/value pairs and skips empty ones', () => {
    expect(describeToolArgs({ collection_name: 'Trips', note: '', extra: null, count: 3 })).toEqual(
      [
        { label: 'Collection name', value: 'Trips' },
        { label: 'Count', value: '3' },
      ],
    );
  });

  it('truncates long values and ignores non-object args', () => {
    const [entry] = describeToolArgs({ body: 'x'.repeat(300) });
    expect(entry?.value.length).toBe(140);
    expect(entry?.value.endsWith('…')).toBe(true);
    expect(describeToolArgs(undefined)).toEqual([]);
    expect(describeToolArgs(['a'])).toEqual([]);
  });
});

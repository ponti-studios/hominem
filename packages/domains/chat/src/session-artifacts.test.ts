import { describe, expect, it } from 'vitest';

import { buildArtifactProposal, buildNoteProposal } from './session-artifacts';

const messages = [
  { role: 'system' as const, content: 'System context' },
  { role: 'user' as const, content: '  Ship the release  ' },
  { role: 'assistant' as const, content: 'Absolutely' },
];

describe('session artifacts', () => {
  it('builds note proposals', () => {
    const proposal = buildNoteProposal(messages);

    expect(proposal.proposedType).toBe('note');
    expect(proposal.proposedTitle).toBe('Ship the release');
    expect(proposal.proposedChanges).toContain('Captured 3 messages into this note');
    expect(proposal.previewContent).toContain('User: Ship the release');
  });

  it.each([
    ['task', 'Untitled task'],
    ['task_list', 'Untitled task list'],
  ] as const)('builds %s proposals', (type, fallbackTitle) => {
    const proposal = buildArtifactProposal(messages, type);

    expect(proposal.proposedType).toBe(type);
    expect(proposal.proposedTitle).toBe('Ship the release');
    expect(proposal.proposedChanges[0]).toBe(
      `Captured 3 messages into this ${type === 'task_list' ? 'task list' : 'task'}`,
    );
    expect(proposal.previewContent).toContain('Assistant: Absolutely');

    const emptyProposal = buildArtifactProposal(
      [{ role: 'assistant' as const, content: '  ' }],
      type,
    );
    expect(emptyProposal.proposedTitle).toBe(fallbackTitle);
  });
});

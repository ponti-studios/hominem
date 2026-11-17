import { beforeAll, describe, expect, it } from 'vitest';

import { searchTools, stem } from './discovery';
import { ensureMcpToolsRegistered } from './register-tools';
import { listTools } from './tool-registry';

// Phrasings here are held out: none of them appear in tool examples. They test retrieval, not
// memorized wording. Two known limits are kept as `todo` on purpose. Keyword search cannot tell
// "tag a trip" from "tag" plus "trip", and it has no synonyms for "tell you about".
const topNames = (query: string, n = 5) =>
  searchTools(query, listTools(), n).tools.map((tool) => tool.name);

beforeAll(async () => {
  await ensureMcpToolsRegistered();
});

describe('stem', () => {
  it('folds plurals so notes and note match', () => {
    expect(stem('notes')).toBe('note');
    expect(stem('events')).toBe('event');
    expect(stem('categories')).toBe('category');
    expect(stem('address')).toBe('address');
  });
});

describe('searchTools retrieval', () => {
  it.each([
    ['how many hours of sleep did I get', 'health_sleep_summary'],
    ['what is stored in this container', 'container_get'],
    ['what have I spent in each category', 'finance_spending_by_category'],
  ])('"%s" surfaces %s in the top 5', (query, expected) => {
    expect(topNames(query)).toContain(expected);
  });

  it('ignores generic words, so a query of only generic words matches nothing', () => {
    expect(searchTools('list past date range', listTools(), 10).count).toBe(0);
  });

  it('keeps the same output shape', () => {
    const out = searchTools('notes', listTools(), 3);
    expect(Object.keys(out).sort()).toEqual(['count', 'hasMore', 'tools']);
  });

  it.todo(
    '"tag my vacation trip" surfaces tag_entity (known limit: keyword overlap with trip tools)',
  );
  it.todo(
    '"what did I tell you about my sister" surfaces search_memories (known limit: no synonyms)',
  );
});

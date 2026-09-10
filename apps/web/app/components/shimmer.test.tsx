// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: vi.fn() };
});

import { useReducedMotion } from 'motion/react';

import { Shimmer } from './shimmer';

import styles from './shimmer.module.css';

afterEach(cleanup);

describe('Shimmer', () => {
  it('renders the shimmering text as a paragraph by default', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);

    render(<Shimmer>Thinking...</Shimmer>);

    const node = screen.getByText('Thinking...');
    expect(node.tagName).toBe('P');
    expect(node.className).toContain(styles.shimmerText);
  });

  it('renders as the given element', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);

    render(<Shimmer as="span">Working on it</Shimmer>);

    expect(screen.getByText('Working on it').tagName).toBe('SPAN');
  });

  it('falls back to plain, non-animated text when the user prefers reduced motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);

    render(<Shimmer as="span">Thinking...</Shimmer>);

    const node = screen.getByText('Thinking...');
    expect(node.tagName).toBe('SPAN');
    expect(node.className).toContain('text-muted-foreground');
  });
});

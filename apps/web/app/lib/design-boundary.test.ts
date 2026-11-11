import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Strict design-system compliance, enforced as a ratchet. The old
// hand-rolled patterns below must only ever shrink: a file on the
// grandfather list gets migrated and removed from the list; a file
// NOT on the list that matches a pattern fails the build.
//
// New UI must compose from `~/components/design` (SectionCard, Stat,
// PanelState, FilterTabs, PageHeader, DataTable, ChartCard,
// Field, SelectField) instead of re-inventing these shapes.

const APP_DIR = join(process.cwd(), 'app');
const DESIGN_DIR = join(APP_DIR, 'components/design');

const PRIMITIVE_FILES = new Set([
  'app/components/design/data-table.tsx',
  'app/components/design/form-field.tsx',
  'app/components/design/chart-card.tsx',
  'app/components/design/skeleton.tsx',
]);

const GRANDFATHERED: Record<string, string[]> = {
  // rounded-xl border border-border bg-card — migrate to SectionCard
  'rounded-xl border border-border bg-card': [],
  // <table — migrate to DataTable
  '<table': [],
  // animate-pulse — migrate to ListSkeleton / BlockSkeleton / ChartCard states
  'animate-pulse': [],
  // <select — migrate to SelectField
  '<select': [],
};

function allTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') allTsx(full, out);
    } else if (
      entry.endsWith('.tsx') &&
      !entry.endsWith('.stories.tsx') &&
      !entry.endsWith('.test.tsx')
    ) {
      out.push(full);
    }
  }
  return out;
}

describe('design system boundary', () => {
  const files = allTsx(APP_DIR);

  it('does not reintroduce the retired neon palette into route UI', () => {
    const retired = ['#d7ff3e', '#9d7bff', '#5eead4'];
    const offenders = files.filter((full) => {
      const source = readFileSync(full, 'utf8').toLowerCase();
      return retired.some((value) => source.includes(value));
    });
    expect(offenders.map((full) => full.replace(`${APP_DIR}/`, ''))).toEqual([]);
  });

  it('keeps Storybook aligned with the monochrome contract', () => {
    const stories = readdirSync(DESIGN_DIR).filter((name) => name.endsWith('.stories.tsx'));
    expect(stories).toContain('monochrome.stories.tsx');

    const retired = ['#d7ff3e', '#9d7bff', '#5eead4', 'aurora-stage', 'glass'];
    const violations = stories.flatMap((name) => {
      const source = readFileSync(join(DESIGN_DIR, name), 'utf8').toLowerCase();
      return retired.filter((value) => source.includes(value)).map((value) => `${name}: ${value}`);
    });
    expect(violations).toEqual([]);
  });

  it('keeps the web theme monochrome and free of decorative chrome', () => {
    const css = readFileSync(join(APP_DIR, 'app.css'), 'utf8').toLowerCase();
    const retired = [
      '--volt',
      '--violet',
      '--cyan',
      'aurora-stage',
      '.glass',
      'linear-gradient',
      'text-shadow',
      'backdrop-filter',
    ];
    expect(retired.filter((value) => css.includes(value))).toEqual([]);
    expect(css).toContain('--background: #ffffff');
    expect(css).toContain('--primary: #0a0a0a');
    expect(css).toContain('--border-default: #e0e0e0');
  });

  for (const [pattern, allowed] of Object.entries(GRANDFATHERED)) {
    it(`no new '${pattern}' outside the migration backlog`, () => {
      const offenders = files
        .map((full) => `app${full.replace(APP_DIR, '')}`)
        .filter((rel) => {
          if (PRIMITIVE_FILES.has(rel)) return false;
          const source = readFileSync(join(APP_DIR, rel.replace(/^app\//, '')), 'utf8');
          return source.includes(pattern);
        });
      const unexpected = offenders.filter((file) => !allowed.includes(file));
      expect(
        unexpected,
        `migrate to the design system instead of hand-rolling '${pattern}': ${unexpected.join(', ')}`,
      ).toEqual([]);
    });

    it(`backlog for '${pattern}' has no stale entries`, () => {
      const stale = allowed.filter((rel) => {
        try {
          const source = readFileSync(join(APP_DIR, rel.replace(/^app\//, '')), 'utf8');
          return !source.includes(pattern);
        } catch {
          return true;
        }
      });
      expect(stale, `already migrated — remove from the backlog: ${stale.join(', ')}`).toEqual([]);
    });
  }
});

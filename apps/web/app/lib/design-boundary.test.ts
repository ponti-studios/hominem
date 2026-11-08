import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Strict design-system compliance, enforced as a ratchet. The old
// hand-rolled patterns below must only ever shrink: a file on the
// grandfather list gets migrated and removed from the list; a file
// NOT on the list that matches a pattern fails the build.
//
// New UI must compose from `~/components/design` (SectionCard, Stat,
// PanelState, SegmentedControl, PageHeader, DataTable, ChartCard,
// Field, SelectField) instead of re-inventing these shapes.

const APP_DIR = join(process.cwd(), 'app');

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

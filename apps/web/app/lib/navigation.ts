import { DOMAINS, type Domain } from '~/domains';

export type PaletteItem = {
  key: string;
  label: string;
  hint: string;
  path: string;
  keywords: string;
  accent: string;
  kind: 'domain' | 'page' | 'action';
};

/** Every navigable target, flattened for the command palette. */
export function buildPaletteIndex(): PaletteItem[] {
  const items: PaletteItem[] = [];
  for (const domain of DOMAINS.filter((d) => d.enabled)) {
    items.push({
      key: domain.id,
      label: domain.label,
      hint: domain.tagline,
      path: domain.path,
      keywords: [domain.label, domain.tagline, ...domain.keywords].join(' ').toLowerCase(),
      accent: domain.accent,
      kind: 'domain',
    });
    for (const sub of domain.subNav) {
      items.push({
        key: `${domain.id}:${sub.path}`,
        label: `${domain.label} — ${sub.label}`,
        hint: sub.path,
        path: sub.path,
        keywords: [domain.label, sub.label, ...(sub.keywords ?? [])].join(' ').toLowerCase(),
        accent: domain.accent,
        kind: 'page',
      });
    }
  }
  items.push(
    {
      key: 'action:usage',
      label: 'Usage',
      hint: 'AI allowance and MCP calls',
      path: '/usage',
      keywords: 'usage allowance limits billing ai',
      accent: '#5eead4',
      kind: 'action',
    },
    {
      key: 'action:settings',
      label: 'Settings',
      hint: 'Account and workspace',
      path: '/settings',
      keywords: 'settings account preferences',
      accent: '#9ba3b4',
      kind: 'action',
    },
  );
  return items;
}

export function searchPalette(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const terms = q.split(/\s+/);
  return items.filter((item) => terms.every((term) => item.keywords.includes(term)));
}

/** `g` then `<key>` sequences for keyboard-first domain jumps. */
export const GO_SEQUENCES: Record<string, string> = {
  t: '/tasks',
  c: '/collections',
  f: '/finance',
  r: '/career',
};

export function domainForPath(pathname: string): Domain | undefined {
  const sorted = [...DOMAINS].sort((a, b) => b.path.length - a.path.length);
  return sorted.find(
    (d) => d.enabled && (pathname === d.path || pathname.startsWith(`${d.path}/`)),
  );
}

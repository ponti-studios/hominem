import { Briefcase, Library, ListTodo, Wallet, type LucideIcon } from 'lucide-react';

// The platform's domain registry. One list drives navigation, the home surface,
// and (later) agent context. `enabled` is false until a domain's routes actually
// exist in this app — the standalone Finance and Career apps are the source of
// truth until they are migrated (docs/web.sub-apps.md).
export type Domain = {
  id: 'tasks' | 'collections' | 'finance' | 'career';
  label: string;
  path: string;
  icon: LucideIcon;
  enabled: boolean;
};

export const DOMAINS: readonly Domain[] = [
  { id: 'tasks', label: 'Tasks', path: '/tasks', icon: ListTodo, enabled: true },
  { id: 'collections', label: 'Collections', path: '/collections', icon: Library, enabled: true },
  { id: 'finance', label: 'Finance', path: '/finance', icon: Wallet, enabled: true },
  { id: 'career', label: 'Career', path: '/career', icon: Briefcase, enabled: true },
];

export const ENABLED_DOMAINS = DOMAINS.filter((domain) => domain.enabled);

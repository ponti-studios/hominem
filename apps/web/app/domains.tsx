import { Briefcase, Library, ListTodo, Wallet, type LucideIcon } from 'lucide-react';

// The platform's domain registry. One list drives the sidebar, the topbar
// breadcrumbs, the command palette, and intent-prefetch. `enabled` is false
// until a domain's routes actually exist in this app.
export type SubNavItem = {
  label: string;
  path: string;
  end?: boolean;
  keywords?: string[];
};

export type Domain = {
  id: 'tasks' | 'collections' | 'finance' | 'career';
  label: string;
  tagline: string;
  path: string;
  icon: LucideIcon;
  keywords: string[];
  subNav: SubNavItem[];
  enabled: boolean;
};

export const DOMAINS: readonly Domain[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    tagline: 'Things to do, scheduled or not',
    path: '/tasks',
    icon: ListTodo,
    keywords: ['todo', 'do', 'schedule', 'today', 'plan'],
    subNav: [],
    enabled: true,
  },
  {
    id: 'collections',
    label: 'Collections',
    tagline: 'Notes and sets worth keeping',
    path: '/collections',
    icon: Library,
    keywords: ['notes', 'sets', 'library', 'saved'],
    subNav: [],
    enabled: true,
  },
  {
    id: 'finance',
    label: 'Finance',
    tagline: 'Money in, money out, runway ahead',
    path: '/finance',
    icon: Wallet,
    keywords: ['money', 'spending', 'accounts', 'runway', 'reconcile', 'transfers', 'budget'],
    subNav: [
      { label: 'Overview', path: '/finance', end: true, keywords: ['home', 'summary'] },
      { label: 'Analytics', path: '/finance/analytics', keywords: ['spending', 'charts'] },
      { label: 'Accounts', path: '/finance/accounts', keywords: ['banks', 'balances'] },
      { label: 'Runway', path: '/finance/runway', keywords: ['burn', 'forecast'] },
      { label: 'Afford it?', path: '/finance/affordability', keywords: ['can i afford', 'buy'] },
      {
        label: 'Transactions',
        path: '/finance/transactions',
        keywords: ['ledger', 'categorize', 'uncategorized'],
      },
      { label: 'Reconcile', path: '/finance/reconcile', keywords: ['true up', 'ledger'] },
      { label: 'Transfers', path: '/finance/transfers', keywords: ['move', 'pairs'] },
    ],
    enabled: true,
  },
  {
    id: 'career',
    label: 'Career',
    tagline: 'Work, proof, and what comes next',
    path: '/career',
    icon: Briefcase,
    keywords: ['work', 'job', 'resume', 'applications', 'profile', 'skills'],
    subNav: [
      { label: 'Overview', path: '/career', end: true, keywords: ['home', 'summary'] },
      { label: 'Profile', path: '/career/profile', keywords: ['about', 'bio'] },
      { label: 'Work', path: '/career/work', keywords: ['experience', 'jobs'] },
      { label: 'Projects', path: '/career/projects', keywords: ['portfolio', 'work samples'] },
      { label: 'Skills', path: '/career/skills', keywords: ['stack', 'abilities'] },
      { label: 'Testimonials', path: '/career/testimonials', keywords: ['praise', 'references'] },
      { label: 'Applications', path: '/career/applications', keywords: ['jobs', 'pipeline'] },
    ],
    enabled: true,
  },
];

export const ENABLED_DOMAINS = DOMAINS.filter((domain) => domain.enabled);

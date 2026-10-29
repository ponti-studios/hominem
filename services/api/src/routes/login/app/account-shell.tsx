// @jsxImportSource react
import type { ReactNode } from 'react';

import styles from './account-shell.module.css';

const links = [
  { href: '/account', label: 'Account' },
  { href: '/account/usage', label: 'Usage' },
  { href: '/account/billing', label: 'Billing' },
  { href: '/account/connections', label: 'Connections' },
  { href: '/account/data', label: 'Data' },
];

export function AccountShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <a className={styles.wordmark} href="/account">
          Hominem
        </a>
        <span className={styles.meta}>Account</span>
      </header>
      <nav aria-label="Account" className={styles.nav}>
        {links.map((link) => (
          <a
            aria-current={
              active === link.href ||
              (link.href === '/account/usage' && active.startsWith('/account/usage/'))
                ? 'page'
                : undefined
            }
            href={link.href}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

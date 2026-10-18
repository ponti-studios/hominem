// @jsxImportSource react
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { apiFetch } from './api';
import { AuthContent, AuthShell } from './auth-shell';
import type { SettingsInit } from './init';

import styles from './settings-page.module.css';

type McpToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

type MonthlyUsage = {
  isOverLimit: boolean;
  limitUsd: number;
  totalCostUsd: number;
};

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const usagePeriodFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  year: '2-digit',
});

function formatUsd(amount: number): string {
  return usdFormatter.format(amount);
}

function formatUsagePeriod(): string {
  const parts = usagePeriodFormatter.formatToParts(new Date());
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  return `${month} '${year}`;
}

function formatPounds(pence: number): string {
  return `£${(Math.max(0, pence) / 100).toFixed(2)}`;
}

type CreditEntry = { kind: 'grant' | 'topup'; amountPence: number; at: string };

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : shortDate.format(date);
}

/** "today", "3 days ago", or "never used" for a token's last use. */
function usedLabel(lastUsedAt: string | null, now = Date.now()): string {
  if (!lastUsedAt) return 'never used';
  const days = Math.floor((now - new Date(lastUsedAt).getTime()) / 86_400_000);
  if (days <= 0) return 'used today';
  return days === 1 ? 'used yesterday' : `used ${days} days ago`;
}

function getInitials(name: string, fallback: string): string {
  const source = name.trim() || fallback;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function scopeLabel(token: McpToken): string {
  return token.scopes.length === 0 ? 'All scopes' : token.scopes.join(', ');
}

function copyTextLegacy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

type SheetName = 'profile' | 'credit' | 'tokens' | 'data';

const ICONS: Record<SheetName, string> = {
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  credit: 'M3 7h18v10H3zM3 11h18M7 15h3',
  tokens: 'M15 7a4 4 0 1 1-3.5 6L4 20.5V17h3v-3h3l1.5-1.5A4 4 0 0 1 15 7Z',
  data: 'M12 4v10m0 0-4-4m4 4 4-4M5 19h14',
};

function NavRow({
  icon,
  label,
  value,
  last,
  onOpen,
}: {
  icon: SheetName;
  label: string;
  value: string;
  last?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      aria-label={value ? `${label}: ${value}` : label}
      className={styles.navRow}
      data-last={last ? true : undefined}
      onClick={onOpen}
      type="button"
    >
      <span aria-hidden="true" className={styles.iconTile}>
        <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
          <path
            d={ICONS[icon]}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </span>
      <span className={styles.navLabel}>{label}</span>
      <span className={styles.navValue}>{value}</span>
      <span aria-hidden="true" className={styles.chevron}>
        ›
      </span>
    </button>
  );
}

/** A panel that rises over the account home, like a Thames settings sheet. */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.sheetLayer}>
      <button aria-label="Close" className={styles.scrim} onClick={onClose} type="button" />
      <div aria-label={title} aria-modal="true" className={styles.sheet} role="dialog">
        <div className={styles.grab} />
        <div className={styles.sheetHead}>
          <h3 className={styles.sheetTitle}>{title}</h3>
          <button className={styles.doneButton} onClick={onClose} type="button">
            Done
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
      </div>
    </div>
  );
}

export function SettingsPage({
  user,
  loginNextUrl,
  creditUrl,
  creditPence,
  embedded,
}: SettingsInit) {
  const queryClient = useQueryClient();
  const name = user.name ?? '';
  const email = user.email ?? '';
  const initials = getInitials(name, email);

  const [nameInput, setNameInput] = useState(name);
  const [saveStatus, setSaveStatus] = useState<{ message: string; error?: boolean } | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [tokenStatus, setTokenStatus] = useState<{ message: string; error?: boolean } | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeAsk, setRevokeAsk] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const tokenInputRef = useRef<HTMLInputElement | null>(null);
  const tokenValueRef = useRef<HTMLElement | null>(null);

  const usageQuery = useQuery({
    queryKey: ['usage', 'monthly'],
    queryFn: () => apiFetch<MonthlyUsage>('/api/usage/monthly'),
  });

  const historyQuery = useQuery({
    queryKey: ['credit-history'],
    queryFn: () => apiFetch<{ entries: CreditEntry[] }>('/auth/settings/credit-history'),
    enabled: Boolean(creditUrl),
  });

  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: () => apiFetch<{ tokens: McpToken[] }>('/auth/settings/mcp-tokens'),
  });

  // A raw token value must never survive navigation — clear the reveal on
  // every mount and on bfcache restore (Safari restores DOM state).
  useEffect(() => {
    setRevealedToken(null);
    setCopyLabel('Copy');
    const onPageshow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setRevealedToken(null);
        setCopyLabel('Copy');
      }
    };
    window.addEventListener('pageshow', onPageshow);
    return () => window.removeEventListener('pageshow', onPageshow);
  }, []);

  const saveName = useMutation({
    mutationFn: async () => {
      const response = await fetch('/auth/settings/profile', {
        method: 'POST',
        body: new URLSearchParams({ name: nameInput.trim() }),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      if (!response.ok) {
        const body: { error?: string } | null = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Could not save name.');
      }
    },
    onSuccess: () => {
      setSaveStatus({ message: 'Saved' });
    },
    onError: (error: Error) => {
      setSaveStatus({ message: error.message, error: true });
    },
  });

  const createToken = useMutation({
    mutationFn: (tokenNameValue: string) =>
      apiFetch<McpToken & { token: string }>('/auth/settings/mcp-tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: tokenNameValue }),
      }),
    onSuccess: (created) => {
      setRevealedToken(created.token);
      setCopyLabel('Copy');
      setTokenName('');
      setCreateOpen(false);
      setTokenStatus(null);
      void queryClient.invalidateQueries({ queryKey: ['mcp-tokens'] });
    },
    onError: (error: Error) => {
      setTokenStatus({ message: error.message, error: true });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () =>
      apiFetch<{ deleted: boolean }>('/auth/settings/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: deleteEmail }),
      }),
    onSuccess: () => setDeleted(true),
    onError: (error: Error) => setDeleteError(error.message),
  });

  const revokeToken = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ revoked: boolean }>(`/auth/settings/mcp-tokens/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => {
      setRevokeAsk(null);
      void queryClient.invalidateQueries({ queryKey: ['mcp-tokens'] });
    },
    onError: (error: Error) => {
      setTokenStatus({ message: error.message, error: true });
    },
  });

  const handleCopy = async () => {
    if (!revealedToken) return;
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(revealedToken);
        copied = true;
      } catch {
        copied = copyTextLegacy(revealedToken);
      }
    } else {
      copied = copyTextLegacy(revealedToken);
    }
    if (copied) {
      setCopyLabel('Copied');
      setTimeout(() => setCopyLabel('Copy'), 1500);
    } else {
      setTokenStatus({ message: 'Copy failed — select the token text manually.', error: true });
    }
  };

  const usage = usageQuery.data;
  const percent = usage ? Math.min(100, (usage.totalCostUsd / usage.limitUsd) * 100) : 0;
  const nameChanged = nameInput.trim() !== name;

  const lastAdded = historyQuery.data?.entries[0];

  if (deleted) {
    return (
      <AuthShell>
        <AuthContent wide>
          <div className="w-full text-left">
            <h2 className="m-0 text-3xl font-semibold text-auth-text">Account deleted</h2>
            <p className={styles.mcpCopy}>
              Your account and what it kept are gone. You can close this window.
            </p>
          </div>
        </AuthContent>
      </AuthShell>
    );
  }

  const tokenCount = tokensQuery.data?.tokens.filter((token) => !token.revokedAt).length ?? 0;
  const creditValue = creditPence === null ? '' : formatPounds(creditPence);
  const rows: { icon: SheetName; label: string; value: string }[] = [
    { icon: 'profile', label: 'Profile', value: name || email },
    {
      icon: 'credit',
      label: creditUrl ? 'Credit' : 'AI usage',
      value: creditUrl ? creditValue : usage ? formatUsd(usage.totalCostUsd) : '',
    },
    {
      icon: 'tokens',
      label: 'Connected assistants',
      value: tokenCount ? String(tokenCount) : 'None',
    },
    { icon: 'data', label: 'Your data', value: '' },
  ];
  const sheetTitles: Record<SheetName, string> = {
    profile: 'Profile',
    credit: creditUrl ? 'Credit' : 'AI usage',
    tokens: 'Connected assistants',
    data: 'Your data',
  };
  const sheetBody: Record<SheetName, ReactNode> = {
    profile: (
      <>
        <section className={`${styles.section} w-full`}>
          <div className={styles.identityRow}>
            <span aria-hidden="true" className={styles.avatar}>
              {initials}
            </span>
            <input
              aria-label="Name"
              className={styles.nameInput}
              placeholder="Your name"
              spellCheck={false}
              type="text"
              value={nameInput}
              onChange={(event) => {
                setNameInput(event.target.value);
                setSaveStatus(null);
              }}
            />
          </div>
          <p className={styles.email}>{email || 'Not available'}</p>
          <div className={styles.saveRow}>
            <button
              className={styles.saveButton}
              hidden={!nameChanged}
              onClick={() => saveName.mutate()}
              type="button"
            >
              Save
            </button>
            <p
              className={styles.saveStatus}
              data-error={saveStatus?.error ? true : undefined}
              hidden={!saveStatus && !nameChanged}
            >
              {saveStatus?.message ?? ''}
            </p>
          </div>
        </section>
      </>
    ),
    credit: (
      <>
        {creditUrl ? (
          <section className={`${styles.section} w-full`}>
            <p className={styles.bigAmount}>
              {creditPence === null ? '—' : formatPounds(creditPence)}
            </p>
            <p className={styles.mcpCopy}>
              {lastAdded && lastAdded.kind === 'topup'
                ? `Last added ${formatPounds(lastAdded.amountPence)} on ${formatDay(lastAdded.at)} · `
                : ''}
              Doesn’t expire. Works in Thames.
            </p>
            <a
              className={`${styles.saveButton} ${styles.primaryButton} ${styles.linkButton}`}
              href={creditUrl}
            >
              Add credit
            </a>
            {historyQuery.data?.entries.length ? (
              <details className={styles.payments}>
                <summary>Payments</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>What</th>
                      <th>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyQuery.data.entries.map((entry) => (
                      <tr key={`${entry.at}-${entry.kind}`}>
                        <td>{formatDay(entry.at)}</td>
                        <td>{entry.kind === 'grant' ? 'Free credit' : 'Top-up'}</td>
                        <td>{formatPounds(entry.amountPence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={styles.mcpCopy}>Receipts are emailed by Stripe.</p>
              </details>
            ) : null}
          </section>
        ) : (
          <section className={`${styles.section} w-full`} data-settings-usage>
            <p className={styles.sectionLabel}>AI usage · {formatUsagePeriod()}</p>
            <div className={styles.usageSummary}>
              <p className={styles.usageAmount}>{usage ? formatUsd(usage.totalCostUsd) : '—'}</p>
              <p className={styles.usageLimit}>
                {usage ? `of ${formatUsd(usage.limitUsd)} · ${percent.toFixed(0)}%` : '\u00a0'}
              </p>
            </div>
            <div aria-hidden="true" className={styles.usageBar}>
              <div className={styles.usageBarFill} style={{ width: `${percent}%` }} />
            </div>
            <p
              className={styles.usageReset}
              data-over-limit={usage?.isOverLimit ? true : undefined}
            >
              {usage?.isOverLimit
                ? "You've reached this month's free AI usage limit. It resets at the start of next month."
                : 'Resets at the start of next month.'}
            </p>
            <a
              className="text-sm font-medium text-auth-primary no-underline hover:underline hover:underline-offset-3"
              href="/auth/settings/ai"
            >
              Usage details →
            </a>
          </section>
        )}
      </>
    ),
    tokens: (
      <>
        <section className={`${styles.section} w-full`}>
          <p className={styles.mcpCopy}>
            Let Muse, Claude or ChatGPT reach your data with a personal token. A token is shown
            once, when you make it.
          </p>

          {tokensQuery.data?.tokens.length ? (
            <ul className={styles.tokenList}>
              {tokensQuery.data.tokens.map((token) => (
                <li className={styles.tokenItem} key={token.id}>
                  <div className={styles.tokenIdentity}>
                    <span className={styles.tokenName}>{token.name}</span>
                    <span className={styles.tokenMeta}>
                      {token.tokenPrefix}… · {scopeLabel(token)} · {usedLabel(token.lastUsedAt)}
                    </span>
                  </div>
                  {revokeAsk === token.id ? (
                    <button
                      className={styles.tokenRevoke}
                      disabled={revokeToken.isPending}
                      onClick={() => revokeToken.mutate(token.id)}
                      type="button"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      className={styles.tokenRevoke}
                      onClick={() => setRevokeAsk(token.id)}
                      type="button"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          <div className={styles.tokenCreateHeader}>
            <button
              className={styles.tokenAddButton}
              onClick={() => setCreateOpen((open) => !open)}
              type="button"
            >
              {createOpen ? 'Cancel' : '+ Add token'}
            </button>
          </div>

          <div className={styles.tokenCreateWrap} data-open={createOpen ? true : undefined}>
            <div className={styles.tokenCreateRow}>
              <input
                aria-label="Token name"
                autoFocus={createOpen}
                className={styles.tokenNameInput}
                placeholder="Token name"
                ref={tokenInputRef}
                spellCheck={false}
                type="text"
                value={tokenName}
                onChange={(event) => {
                  setTokenName(event.target.value);
                  setTokenStatus(null);
                }}
              />
              <button
                className={styles.saveButton}
                disabled={createToken.isPending}
                onClick={() => {
                  const value = tokenName.trim();
                  if (!value) {
                    setTokenStatus({ message: 'Enter a name for the token.', error: true });
                    return;
                  }
                  createToken.mutate(value);
                }}
                type="button"
              >
                Create token
              </button>
            </div>
          </div>

          <p
            className={styles.saveStatus}
            data-error={tokenStatus?.error ? true : undefined}
            hidden={!tokenStatus}
          >
            {tokenStatus?.message ?? ''}
          </p>
          <div className={styles.tokenReveal} hidden={!revealedToken}>
            <p className={styles.mcpCopy}>Copy this token now — it won't be shown again.</p>
            <div className={styles.tokenRevealRow}>
              <code className={styles.tokenCode} ref={tokenValueRef}>
                {revealedToken ?? ''}
              </code>
              <button className={styles.saveButton} onClick={handleCopy} type="button">
                {copyLabel}
              </button>
            </div>
          </div>
        </section>
      </>
    ),
    data: (
      <>
        <section className={`${styles.section} w-full`}>
          {creditUrl ? (
            <p className={styles.mcpCopy}>
              Memory and saved conversations are managed in the Thames app, under Settings.
            </p>
          ) : null}
          <div className={styles.actionRow}>
            <a className={`${styles.saveButton} ${styles.linkButton}`} href="/auth/settings/export">
              Download my data
            </a>
            <button
              className={`${styles.saveButton} ${styles.dangerText}`}
              onClick={() => setDeleteOpen((open) => !open)}
              type="button"
            >
              {deleteOpen ? 'Cancel' : 'Delete my account'}
            </button>
          </div>
          {deleteOpen ? (
            <div className={styles.deleteBox}>
              <p className={styles.mcpCopy}>
                This removes your memory, saved conversations, tokens and any credit left. Credit
                isn’t refunded. It can’t be undone. Type your email to confirm.
              </p>
              <div className={styles.tokenCreateRow}>
                <input
                  aria-label="Your email"
                  autoCapitalize="none"
                  autoComplete="off"
                  className={styles.tokenNameInput}
                  placeholder={email}
                  spellCheck={false}
                  type="email"
                  value={deleteEmail}
                  onChange={(event) => {
                    setDeleteEmail(event.target.value);
                    setDeleteError(null);
                  }}
                />
                <button
                  className={`${styles.saveButton} ${styles.dangerText}`}
                  disabled={
                    deleteAccount.isPending ||
                    deleteEmail.trim().toLowerCase() !== email.toLowerCase()
                  }
                  onClick={() => deleteAccount.mutate()}
                  type="button"
                >
                  {deleteAccount.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
              <p className={styles.saveStatus} data-error hidden={!deleteError}>
                {deleteError ?? ''}
              </p>
            </div>
          ) : null}
        </section>
      </>
    ),
  };

  return (
    <AuthShell bare>
      <div className={styles.page}>
        <h1 className={styles.pageTitle} id="settings-title">
          Account
        </h1>

        <section className={styles.hero}>
          <div className={styles.identityRow}>
            <span aria-hidden="true" className={styles.avatar}>
              {initials}
            </span>
            <span className={styles.who}>
              <span className={styles.whoName}>{name || email}</span>
              {name ? <span className={styles.whoEmail}>{email}</span> : null}
            </span>
          </div>
          {creditUrl ? (
            <>
              <div>
                <p className={styles.heroLabel}>Credit</p>
                <p className={styles.bigAmount}>
                  {creditPence === null ? '—' : formatPounds(creditPence)}
                </p>
                <p className={styles.heroNote}>Doesn’t expire. Works in Thames.</p>
              </div>
              <a className={styles.addButton} href={creditUrl}>
                Add credit
              </a>
            </>
          ) : (
            <>
              <div>
                <p className={styles.heroLabel}>AI usage · {formatUsagePeriod()}</p>
                <p className={styles.bigAmount}>{usage ? formatUsd(usage.totalCostUsd) : '—'}</p>
                <p className={styles.heroNote}>
                  {usage ? `of ${formatUsd(usage.limitUsd)} free this month` : '\u00a0'}
                </p>
              </div>
              <div aria-hidden="true" className={styles.usageBar}>
                <div className={styles.usageBarFill} style={{ width: `${percent}%` }} />
              </div>
            </>
          )}
        </section>

        <div className={styles.card}>
          {rows.map((row, index) => (
            <NavRow
              key={row.icon}
              icon={row.icon}
              label={row.label}
              last={index === rows.length - 1}
              onOpen={() => setSheet(row.icon)}
              value={row.value}
            />
          ))}
        </div>

        {embedded ? null : (
          <form action="/logout" method="post">
            <input name="next" type="hidden" value={loginNextUrl} />
            <button className={styles.signOut} type="submit">
              Sign out
            </button>
          </form>
        )}
        {sheet ? (
          <Sheet title={sheetTitles[sheet]} onClose={() => setSheet(null)}>
            {sheetBody[sheet]}
          </Sheet>
        ) : null}
      </div>
    </AuthShell>
  );
}

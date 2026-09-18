// @jsxImportSource react
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { apiFetch } from './api';
import { AuthContent, AuthDangerButton, AuthShell } from './auth-shell';
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

export function SettingsPage({ user, loginNextUrl }: SettingsInit) {
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
  const tokenInputRef = useRef<HTMLInputElement | null>(null);
  const tokenValueRef = useRef<HTMLElement | null>(null);

  const usageQuery = useQuery({
    queryKey: ['usage', 'monthly'],
    queryFn: () => apiFetch<MonthlyUsage>('/api/usage/monthly'),
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

  const revokeToken = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ revoked: boolean }>(`/auth/settings/mcp-tokens/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => {
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

  return (
    <AuthShell>
      <AuthContent wide>
        <div className="w-full text-left">
          <div className="mb-2 flex items-center gap-2">
            <h2 id="settings-title" className="m-0 text-3xl font-semibold text-auth-text">
              Account
            </h2>
          </div>
        </div>

        <section className={`${styles.section} w-full`}>
          <p className={styles.sectionLabel}>Account</p>
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

        <section className={`${styles.section} w-full`} data-settings-usage>
          <p className={styles.sectionLabel}>AI usage · {formatUsagePeriod()}</p>
          <div className={styles.usageSummary}>
            <p className={styles.usageAmount}>{usage ? formatUsd(usage.totalCostUsd) : '—'}</p>
            <p className={styles.usageLimit}>
              {usage ? `of ${formatUsd(usage.limitUsd)} · ${percent.toFixed(0)}%` : '&nbsp;'}
            </p>
          </div>
          <div aria-hidden="true" className={styles.usageBar}>
            <div className={styles.usageBarFill} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.usageReset} data-over-limit={usage?.isOverLimit ? true : undefined}>
            {usage?.isOverLimit
              ? "You've reached this month's free AI usage limit. It resets at the start of next month."
              : 'Resets at the start of next month.'}
          </p>
        </section>

        <a
          className="w-full text-left text-sm font-medium text-auth-primary no-underline hover:underline hover:underline-offset-3"
          href="/auth/settings/ai"
        >
          AI usage details →
        </a>

        <section className={`${styles.section} w-full`}>
          <p className={styles.sectionLabel}>MCP access</p>
          <p className={styles.mcpCopy}>
            Personal tokens that let AI assistants connect to your data through the Model Context
            Protocol (Muse, ChatGPT, Claude, …). A token is shown once at creation.
          </p>

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

          {tokensQuery.data?.tokens.length ? (
            <ul className={styles.tokenList}>
              {tokensQuery.data.tokens.map((token) => (
                <li className={styles.tokenItem} key={token.id}>
                  <div className={styles.tokenIdentity}>
                    <span className={styles.tokenName}>{token.name}</span>
                    <span className={styles.tokenMeta}>
                      {token.tokenPrefix} · {scopeLabel(token)}
                    </span>
                  </div>
                  <button
                    className={styles.tokenRevoke}
                    disabled={revokeToken.isPending}
                    onClick={() => revokeToken.mutate(token.id)}
                    type="button"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

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

        <section className={`${styles.section} w-full`}>
          <form action="/logout" method="post">
            <input name="next" type="hidden" value={loginNextUrl} />
            <AuthDangerButton type="submit">Sign out</AuthDangerButton>
          </form>
        </section>
      </AuthContent>
    </AuthShell>
  );
}

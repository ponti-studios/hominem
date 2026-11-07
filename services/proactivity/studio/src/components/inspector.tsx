import { useEffect, useRef, useState } from 'react';

import {
  evidenceName,
  formatDateShort,
  formatFactValue,
  formatRelative,
  formatTime,
  friendlyDefer,
  humanizeKey,
  isSensitiveKey,
  kindLabel,
  matchTarget,
  IconCheck,
  IconClose,
  IconMail,
  IconRefresh,
} from '../format';
import type { Evidence, StudioEvent, StudioResult } from '../types';

export type InspectTab = 'decision' | 'evidence' | 'email';

type InspectorProps = {
  result: StudioResult;
  event: StudioEvent;
  actioned: boolean;
  rerunning: boolean;
  initialTab: InspectTab;
  onClose: () => void;
  onRerun: () => void;
  onAccept: () => void;
  onSnooze: () => void;
  onResume: () => void;
};

export function Inspector({
  result,
  event,
  actioned,
  rerunning,
  initialTab,
  onClose,
  onRerun,
  onAccept,
  onSnooze,
  onResume,
}: InspectorProps) {
  const [tab, setTab] = useState<InspectTab>(initialTab);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const target = matchTarget(result.decision.kind, result.expected);

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <header className="sheet-head">
          <div className="sheet-heading">
            <div className="sheet-eyebrow">
              <span className={`kind-badge kind-${result.decision.kind}`}>
                {kindLabel[result.decision.kind]}
              </span>
              <span>{formatTime(event.at)}</span>
              <span className="separator">/</span>
              <span>{event.sourceLabel}</span>
              {event.injected ? <span className="mini-tag whatif">What if</span> : null}
            </div>
            <h2 id="sheet-title">{result.goalTitle}</h2>
            <p className="sheet-event">{event.title}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close details"
          >
            <IconClose />
          </button>
        </header>

        <div className="tabs" role="tablist" aria-label="Decision details">
          {(['decision', 'evidence', 'email'] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`tab-${name}`}
              aria-selected={tab === name}
              aria-controls={`panel-${name}`}
              onClick={() => setTab(name)}
            >
              {name === 'decision' ? 'Decision' : name === 'evidence' ? 'Evidence' : 'Email'}
            </button>
          ))}
        </div>

        <div className="sheet-body">
          {tab === 'decision' ? (
            <div role="tabpanel" id="panel-decision" aria-labelledby="tab-decision">
              {result.decision.kind === 'propose' ? (
                <p className="decision-summary">{result.decision.summary}</p>
              ) : null}

              <section className="sheet-section">
                <p className="sheet-label">Why</p>
                <p className="sheet-copy">
                  {result.decision.kind === 'defer'
                    ? friendlyDefer(result.decision.reason)
                    : result.decision.reason}
                </p>
              </section>

              {result.decision.kind === 'propose' ? (
                <section className="sheet-section">
                  <p className="sheet-label">One next step</p>
                  <p className="sheet-step">{result.decision.nextStep}</p>
                </section>
              ) : null}

              {result.decision.kind === 'defer' ? (
                <section className="sheet-section">
                  <p className="sheet-label">Next check</p>
                  <p className="sheet-copy">
                    {formatDateShort(result.decision.reevaluateAt)} · Hominem will look again.
                  </p>
                </section>
              ) : null}

              {result.decision.evidenceIds.length > 0 ? (
                <section className="sheet-section">
                  <p className="sheet-label">Cited evidence</p>
                  <div className="evidence-chips">
                    {result.decision.evidenceIds.map((id) => {
                      const evidence =
                        result.evidence.find((item) => item.id === id) ??
                        result.previousEvidence.find((item) => item.id === id);
                      return (
                        <span key={id} className="evidence-chip-static">
                          {evidence ? evidenceName(evidence) : id}
                          {result.evidence.some((item) => item.id === id) ? '' : ' · before'}
                        </span>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {result.expected ? (
                <div className={`target target-${target}`}>
                  <span className="sheet-label">Evaluation fixture</span>
                  <span>
                    Target <b>{result.expected}</b>
                    {target === 'match' ? ' · matches' : ` · actual ${result.decision.kind}`}
                  </span>
                </div>
              ) : (
                <div className="target target-none">
                  <span className="sheet-label">What-if</span>
                  <span>No fixture target. This is an injected fact.</span>
                </div>
              )}

              <section className="sheet-section">
                <p className="sheet-label">Run</p>
                <dl className="meta-grid">
                  <div>
                    <dt>Source</dt>
                    <dd>
                      {result.source === 'model'
                        ? 'Model decision'
                        : result.source === 'preflight'
                          ? 'Safety preflight'
                          : 'Journal replay'}
                    </dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{result.model}</dd>
                  </div>
                  <div>
                    <dt>Latency</dt>
                    <dd>{result.latencyMs} ms</dd>
                  </div>
                  <div>
                    <dt>Evaluated</dt>
                    <dd title={result.evaluatedAt}>
                      {formatRelative(result.evaluatedAt, new Date().toISOString())}
                    </dd>
                  </div>
                </dl>
                <p className="source-note">
                  {result.source === 'model'
                    ? 'A fresh structured-output call. The decision was validated against the supplied evidence before it reached the engine.'
                    : result.source === 'preflight'
                      ? 'No model call was made. The evidence failed a deterministic safety check, so the engine deferred before spending a call.'
                      : 'Replayed from the SQLite journal. Run the check again for a fresh live decision.'}
                </p>
              </section>
            </div>
          ) : null}

          {tab === 'evidence' ? (
            <div role="tabpanel" id="panel-evidence" aria-labelledby="tab-evidence">
              <p className="sheet-intro">
                Exactly what the engine saw at {formatTime(event.at)} on {formatDateShort(event.at)}
                . Changed values are marked.
              </p>
              {result.evidence.map((evidence) => (
                <EvidenceBlock
                  key={evidence.id}
                  current={evidence}
                  previous={findPrevious(evidence, result.previousEvidence)}
                />
              ))}
              {result.previousEvidence.length === 0 ? (
                <p className="section-empty">No prior state was supplied.</p>
              ) : null}
            </div>
          ) : null}

          {tab === 'email' ? (
            <div role="tabpanel" id="panel-email" aria-labelledby="tab-email">
              <EmailPanel result={result} />
            </div>
          ) : null}
        </div>

        <footer className="sheet-foot">
          <button type="button" className="btn secondary" onClick={onRerun} disabled={rerunning}>
            <IconRefresh size={12} /> {rerunning ? 'Running…' : 'Run again'}
          </button>
          {result.decision.kind === 'propose' ? (
            result.held ? (
              <button type="button" className="btn" onClick={onResume}>
                Resume delivery
              </button>
            ) : actioned ? (
              <span className="added">
                <IconCheck size={12} /> In your plan
              </span>
            ) : (
              <>
                <button type="button" className="btn" onClick={onAccept}>
                  Add to plan
                </button>
                <button type="button" className="btn ghost" onClick={onSnooze}>
                  Not now
                </button>
              </>
            )
          ) : null}
        </footer>
      </aside>
    </>
  );
}

function EmailPanel({ result }: { result: StudioResult }) {
  if (result.decision.kind !== 'propose') {
    return (
      <div className="email-withheld">
        <span className="sheet-label">No message</span>
        <p>
          Hominem only writes when it proposes. This check came back{' '}
          {result.decision.kind === 'defer' ? 'waiting for better evidence' : 'quiet'}, so nothing
          was sent.
        </p>
      </div>
    );
  }

  if (result.held) {
    return (
      <div className="email-withheld">
        <span className="sheet-label">Held by your preference</span>
        <p>
          This would have been an email. You asked Hominem to hold this goal until{' '}
          {formatDateShort(result.heldUntil ?? result.evaluatedAt)}.
        </p>
      </div>
    );
  }

  if (!result.delivery) {
    return (
      <div className="email-withheld">
        <span className="sheet-label">No message</span>
        <p>No delivery intent was planned for this decision.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="sheet-intro">
        This is the exact message the delivery policy produced. Nothing is actually sent in the
        demo.
      </p>
      <article className="email-preview">
        <header className="email-head">
          <div className="email-row">
            <span>To</span>
            <strong>Maya Chen</strong>
          </div>
          <div className="email-row">
            <span>Subject</span>
            <strong>{result.delivery.subject}</strong>
          </div>
          <div className="email-row">
            <span>Queued</span>
            <span>{formatRelative(result.delivery.sendAt, new Date().toISOString())}</span>
          </div>
        </header>
        <div className="email-body">{result.delivery.body}</div>
      </article>
      <p className="source-note">
        <IconMail size={12} /> Idempotency key: {result.delivery.idempotencyKey}
      </p>
    </div>
  );
}

type EvidenceRow = {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
  changed: boolean;
  added: boolean;
};

function EvidenceBlock({ current, previous }: { current: Evidence; previous?: Evidence }) {
  const rows = rowsFor(previous, current);
  return (
    <section className="ev-block">
      <header className="ev-head">
        <div>
          <h3>{evidenceName(current)}</h3>
          <p>
            {current.domain} · observed {formatDateShort(current.observedAt)}
          </p>
        </div>
        <span className="ev-id">{current.id}</span>
      </header>
      <div className="ev-table-wrap">
        <table className="ev-table">
          <thead>
            <tr>
              <th scope="col">Fact</th>
              {previous ? <th scope="col">Before</th> : null}
              <th scope="col">{previous ? 'After' : 'Value'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.changed ? 'is-changed' : ''}>
                <th scope="row">{row.label}</th>
                {previous ? (
                  <td className={row.before === undefined ? 'is-missing' : ''}>
                    {row.before === undefined ? '—' : renderValue(row.key, row.before)}
                  </td>
                ) : null}
                <td>{renderValue(row.key, row.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function rowsFor(previous: Evidence | undefined, current: Evidence): EvidenceRow[] {
  const keys = new Set([...Object.keys(previous?.facts ?? {}), ...Object.keys(current.facts)]);
  return [...keys].sort().map((key) => {
    const before = previous?.facts[key];
    const after = current.facts[key];
    return {
      key,
      label: humanizeKey(key),
      before,
      after,
      changed: !sameValue(before, after),
      added: before === undefined && after !== undefined,
    };
  });
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function renderValue(key: string, value: unknown) {
  if (isSensitiveKey(key)) return <span className="redacted">[redacted]</span>;
  return formatFactValue(value);
}

function findPrevious(current: Evidence, previous: Evidence[]): Evidence | undefined {
  return previous.find((item) => item.domain === current.domain && item.source === current.source);
}

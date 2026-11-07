import {
  evidenceName,
  formatDateShort,
  formatTime,
  friendlyDefer,
  IconCheck,
  IconChevron,
} from '../format';
import type { StudioEvent, StudioResult, StudioView } from '../types';

type InspectTab = 'decision' | 'evidence' | 'email';

type FeedProps = {
  view: StudioView;
  events: StudioEvent[];
  goalFilter: string | null;
  runningEventId: string | null;
  onRun: (eventId: string) => void;
  onInspect: (result: StudioResult, tab?: InspectTab) => void;
  onAccept: (result: StudioResult) => void;
  onSnooze: (goalId: string) => void;
  onResume: (goalId: string) => void;
};

export function Feed({
  view,
  events,
  goalFilter,
  runningEventId,
  onRun,
  onInspect,
  onAccept,
  onSnooze,
  onResume,
}: FeedProps) {
  const actioned = new Set(view.actions.map((action) => `${action.eventId}:${action.goalId}`));

  const entries = events.flatMap((event) =>
    event.results
      .filter((result) => !goalFilter || result.goalId === goalFilter)
      .map((result) => ({ event, result })),
  );
  const proposals = entries
    .filter(
      ({ result }) =>
        result.decision.kind === 'propose' &&
        !result.held &&
        !actioned.has(`${result.eventId}:${result.goalId}`),
    )
    .sort((a, b) => Date.parse(a.event.at) - Date.parse(b.event.at));
  const held = entries
    .filter(({ result }) => result.decision.kind === 'propose' && result.held)
    .sort((a, b) => Date.parse(a.event.at) - Date.parse(b.event.at));
  const planned = entries
    .filter(
      ({ result }) =>
        result.decision.kind === 'propose' &&
        !result.held &&
        actioned.has(`${result.eventId}:${result.goalId}`),
    )
    .sort((a, b) => Date.parse(a.event.at) - Date.parse(b.event.at));
  const defers = entries
    .filter(({ result }) => result.decision.kind === 'defer')
    .sort((a, b) => Date.parse(a.event.at) - Date.parse(b.event.at));
  const quiet = entries
    .filter(({ result }) => result.decision.kind === 'quiet')
    .sort((a, b) => Date.parse(a.event.at) - Date.parse(b.event.at));
  const pending = events
    .filter((event) => event.status === 'pending' || event.status === 'error')
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  if (events.length === 0) {
    return (
      <div className="feed-empty">
        <p className="eyebrow">No signals</p>
        <p>Nothing landed on this day. Pick another day, or inject a change.</p>
      </div>
    );
  }

  return (
    <div className="feed">
      {pending.length > 0 ? (
        <section className="feed-section">
          <div className="section-head">
            <h2>Not checked yet</h2>
            <span className="section-count">{pending.length}</span>
          </div>
          <div className="rows">
            {pending.map((event) => (
              <PendingRow
                key={event.id}
                event={event}
                now={view.now}
                running={runningEventId === event.id}
                onRun={() => onRun(event.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="feed-section" id="needs-you">
        <div className="section-head">
          <h2>Worth your attention</h2>
          <span className="section-count">{proposals.length}</span>
        </div>
        {proposals.length === 0 ? (
          <p className="section-empty">Nothing needs a decision here.</p>
        ) : (
          proposals.map(({ event, result }) => (
            <ProposalCard
              key={result.id}
              event={event}
              result={result}
              actioned={actioned.has(`${result.eventId}:${result.goalId}`)}
              onInspect={onInspect}
              onAccept={onAccept}
              onSnooze={onSnooze}
              onResume={onResume}
            />
          ))
        )}
      </section>

      {planned.length > 0 ? (
        <section className="feed-section" id="in-plan">
          <div className="section-head">
            <h2>In your plan</h2>
            <span className="section-count">{planned.length}</span>
          </div>
          {planned.map(({ event, result }) => (
            <ProposalCard
              key={result.id}
              event={event}
              result={result}
              actioned
              onInspect={onInspect}
              onAccept={onAccept}
              onSnooze={onSnooze}
              onResume={onResume}
            />
          ))}
        </section>
      ) : null}

      {held.length > 0 ? (
        <section className="feed-section" id="held">
          <div className="section-head">
            <h2>Held by you</h2>
            <span className="section-count">{held.length}</span>
          </div>
          {held.map(({ event, result }) => (
            <ProposalCard
              key={result.id}
              event={event}
              result={result}
              actioned={actioned.has(`${result.eventId}:${result.goalId}`)}
              onInspect={onInspect}
              onAccept={onAccept}
              onSnooze={onSnooze}
              onResume={onResume}
            />
          ))}
        </section>
      ) : null}

      <section className="feed-section" id="ledger">
        <div className="section-head">
          <h2>Held back</h2>
          <span className="section-count">{defers.length}</span>
        </div>
        {defers.length === 0 ? (
          <p className="section-empty">Nothing was held back.</p>
        ) : (
          <div className="rows">
            {defers.map(({ event, result }) => (
              <div className="row" key={result.id}>
                <span className="row-time">{formatTime(event.at)}</span>
                <div className="row-body">
                  <div className="row-top">
                    <span className="row-goal">{result.goalTitle}</span>
                    {result.source === 'preflight' ? (
                      <span className="mini-tag">Safety check</span>
                    ) : null}
                    {event.injected ? <span className="mini-tag whatif">What if</span> : null}
                  </div>
                  <p className="row-title">
                    {result.decision.kind === 'defer'
                      ? friendlyDefer(result.decision.reason)
                      : result.decision.reason}
                  </p>
                  <p className="row-why">
                    {event.title} · {event.sourceLabel}
                  </p>
                </div>
                <div className="row-side">
                  {result.decision.kind === 'defer' ? (
                    <span className="recheck">
                      Recheck {formatDateShort(result.decision.reevaluateAt)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => onInspect(result, 'decision')}
                  >
                    Why <IconChevron size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="feed-section" id="quiet">
        <div className="section-head">
          <h2>Checked, no action</h2>
          <span className="section-count">{quiet.length}</span>
        </div>
        {quiet.length === 0 ? (
          <p className="section-empty">No checks came back quiet.</p>
        ) : (
          <div className="rows rows-quiet">
            {quiet.map(({ event, result }) => (
              <div className="row row-quiet" key={result.id}>
                <span className="row-time">{formatTime(event.at)}</span>
                <div className="row-body">
                  <p className="row-title">{result.decision.reason}</p>
                  <p className="row-why">
                    {result.goalTitle} · {event.title}
                  </p>
                </div>
                <div className="row-side">
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => onInspect(result, 'decision')}
                  >
                    Why <IconChevron size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProposalCard({
  event,
  result,
  actioned,
  onInspect,
  onAccept,
  onSnooze,
  onResume,
}: {
  event: StudioEvent;
  result: StudioResult;
  actioned: boolean;
  onInspect: (result: StudioResult, tab?: InspectTab) => void;
  onAccept: (result: StudioResult) => void;
  onSnooze: (goalId: string) => void;
  onResume: (goalId: string) => void;
}) {
  if (result.decision.kind !== 'propose') return null;
  const decision = result.decision;
  const evidence = decision.evidenceIds
    .map(
      (id) =>
        result.evidence.find((item) => item.id === id) ??
        result.previousEvidence.find((item) => item.id === id),
    )
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <article className={`proposal-card ${actioned ? 'is-actioned' : ''}`}>
      <div className="proposal-eyebrow">
        <span>{formatTime(event.at)}</span>
        <span className="separator">/</span>
        <span>{event.sourceLabel}</span>
        {event.injected ? <span className="mini-tag whatif">What if</span> : null}
        {result.held ? <span className="mini-tag held">Held by you</span> : null}
      </div>
      <p className="proposal-goal">{result.goalTitle}</p>
      <h3>{decision.summary}</h3>
      <p className="proposal-reason">{decision.reason}</p>

      <div className="next-step">
        <span className="next-label">One next step</span>
        <p>{decision.nextStep}</p>
      </div>

      {evidence.length > 0 ? (
        <div className="evidence-chips" aria-label="Evidence cited">
          {evidence.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onInspect(result, 'evidence')}
              title={`${item.source} · ${formatDateShort(item.observedAt)}`}
            >
              {evidenceName(item)}
              {result.evidence.some((current) => current.id === item.id) ? '' : ' · before'}
            </button>
          ))}
        </div>
      ) : null}

      {result.held ? (
        <div className="held-panel">
          <span>
            Nothing will be sent until {formatDateShort(result.heldUntil ?? event.at)}. Hominem
            keeps watching.
          </span>
          <button type="button" className="text-button" onClick={() => onResume(result.goalId)}>
            Resume delivery
          </button>
        </div>
      ) : (
        <div className="proposal-actions">
          {actioned ? (
            <span className="added">
              <IconCheck size={12} /> In your plan
            </span>
          ) : (
            <button type="button" className="btn" onClick={() => onAccept(result)}>
              Add to plan
            </button>
          )}
          <button type="button" className="btn secondary" onClick={() => onSnooze(result.goalId)}>
            Not now
          </button>
          <button type="button" className="btn ghost" onClick={() => onInspect(result, 'decision')}>
            Why this? <IconChevron size={11} />
          </button>
        </div>
      )}
    </article>
  );
}

function PendingRow({
  event,
  now,
  running,
  onRun,
}: {
  event: StudioEvent;
  now: string;
  running: boolean;
  onRun: () => void;
}) {
  const future = Date.parse(event.at) > Date.parse(now);
  return (
    <div className={`row row-pending ${event.error ? 'has-error' : ''}`}>
      <span className="row-time">{formatTime(event.at)}</span>
      <div className="row-body">
        <div className="row-top">
          <span className="row-goal">{event.domainLabel}</span>
          <span className="mini-tag">{event.channelLabel}</span>
          {future ? <span className="mini-tag">Upcoming</span> : null}
          {event.injected ? <span className="mini-tag whatif">What if</span> : null}
        </div>
        <p className="row-title">{event.title}</p>
        <p className="row-why">{event.summary}</p>
        {event.error ? <p className="row-error">{event.error}</p> : null}
      </div>
      <div className="row-side">
        <button type="button" className="btn small" onClick={onRun} disabled={running}>
          {running ? 'Checking…' : event.error ? 'Retry' : future ? 'Run ahead' : 'Check now'}
        </button>
      </div>
    </div>
  );
}

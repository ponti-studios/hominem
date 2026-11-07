import { plural } from '../format';
import type { StudioView } from '../types';

type SidePanelProps = {
  view: StudioView;
  injecting: string | null;
  disabled: boolean;
  onInject: (presetId: string) => void;
  onReset: () => void;
};

export function SidePanel({ view, injecting, disabled, onInject, onReset }: SidePanelProps) {
  const { stats } = view;
  return (
    <aside className="side">
      <section className="panel">
        <p className="eyebrow">This week</p>
        <div className="withheld">
          <strong>{stats.avoided}</strong>
          <span>{plural(stats.avoided, 'message')} withheld</span>
        </div>
        <p className="panel-note">
          {stats.checks} {plural(stats.checks, 'check')} · {stats.proposals}{' '}
          {plural(stats.proposals, 'proposal')} · {stats.deferred} {plural(stats.deferred, 'wait')}{' '}
          · {stats.quiet} quiet
        </p>
        <dl className="stat-rows">
          <div>
            <dt>Model calls</dt>
            <dd>{stats.modelCalls}</dd>
          </div>
          <div>
            <dt>Safety preflights</dt>
            <dd>{stats.preflightDefers}</dd>
          </div>
          <div>
            <dt>Average latency</dt>
            <dd>{stats.averageLatencyMs === 0 ? '—' : `${stats.averageLatencyMs} ms`}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <p className="eyebrow">Change the world</p>
        <p className="panel-note">
          Inject a fact. The same engine re-evaluates the affected goals, live — one model call per
          goal.
        </p>
        <div className="shocks">
          {view.presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="shock"
              onClick={() => onInject(preset.id)}
              disabled={disabled || injecting !== null}
            >
              <span>{injecting === preset.id ? 'Checking…' : preset.label}</span>
              <span className="shock-hint">{preset.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Engine</p>
        <dl className="stat-rows">
          <div>
            <dt>Model</dt>
            <dd className="mono-value">{view.model}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{view.modelReady ? 'Live' : 'No key'}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>SQLite journal</dd>
          </div>
        </dl>
        <p className="engine-note">
          {view.modelReady
            ? 'Structured output, evidence-grounded. Deferrals can come from a deterministic safety check before the model is called.'
            : 'Set OPENROUTER_API_KEY and restart to evaluate live.'}
        </p>
      </section>

      <button type="button" className="reset" onClick={onReset}>
        Reset the week
      </button>
    </aside>
  );
}

import type { StudioView } from '../types';

type TopbarProps = {
  view: StudioView;
  onToday: () => void;
  onNavigate: (target: 'plan' | 'ledger') => void;
};

export function Topbar({ view, onToday, onNavigate }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" type="button" onClick={onToday} aria-label="Hominem, go to today">
          hominem
        </button>
        <nav className="nav" aria-label="Sections">
          <button type="button" onClick={onToday}>
            Today
          </button>
          <button type="button" onClick={() => onNavigate('plan')}>
            Plan
          </button>
          <button type="button" onClick={() => onNavigate('ledger')}>
            Ledger
          </button>
        </nav>
        <div className="topbar-right">
          <span className={`live-pill ${view.modelReady ? 'is-live' : 'is-offline'}`}>
            <span className="live-dot" aria-hidden="true" />
            {view.modelReady ? 'Live engine' : 'No model key'}
          </span>
          <span className="topbar-model">{view.model}</span>
          <span className="avatar" title={view.owner.name}>
            {view.owner.initials}
          </span>
        </div>
      </div>
    </header>
  );
}

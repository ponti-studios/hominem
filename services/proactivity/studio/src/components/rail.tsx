import { formatDateShort, formatTime, IconCheck } from '../format';
import type { StudioView } from '../types';
import { WeekStrip } from './week-strip';

type RailProps = {
  view: StudioView;
  selectedDay: number;
  selectedGoal: string | null;
  onSelectDay: (index: number) => void;
  onSelectGoal: (goalId: string | null) => void;
  onToggleAction: (id: string, status: 'open' | 'done') => void;
  onResume: (goalId: string) => void;
};

const stateLabels = {
  attention: 'Needs you',
  waiting: 'Waiting',
  'on-track': 'On track',
  unchecked: 'Not checked',
} as const;

export function Rail({
  view,
  selectedDay,
  selectedGoal,
  onSelectDay,
  onSelectGoal,
  onToggleAction,
  onResume,
}: RailProps) {
  const openActions = view.actions.filter((action) => action.status === 'open');
  const doneActions = view.actions.filter((action) => action.status === 'done');

  return (
    <aside className="rail">
      <div className="rail-block">
        <p className="eyebrow">This week</p>
        <WeekStrip days={view.days} selected={selectedDay} onSelect={onSelectDay} />
      </div>

      <div className="rail-block">
        <div className="rail-heading">
          <p className="eyebrow">Goals</p>
          {selectedGoal ? (
            <button type="button" className="text-button" onClick={() => onSelectGoal(null)}>
              Clear
            </button>
          ) : null}
        </div>
        <div className="goals">
          {view.goals.map((goal) => {
            const preference = view.preferences.find((item) => item.goalId === goal.id);
            return (
              <div key={goal.id} className="goal-wrap">
                <button
                  type="button"
                  className={`goal ${selectedGoal === goal.id ? 'is-selected' : ''}`}
                  aria-pressed={selectedGoal === goal.id}
                  onClick={() => onSelectGoal(selectedGoal === goal.id ? null : goal.id)}
                >
                  <span className={`state-dot state-${goal.state}`} aria-hidden="true" />
                  <span className="goal-copy">
                    <span className="goal-title">{goal.title}</span>
                    <span className="goal-meta">
                      {stateLabels[goal.state]}
                      {goal.lastCheckedAt ? ` · ${formatTime(goal.lastCheckedAt)}` : ''}
                    </span>
                  </span>
                </button>
                {preference ? (
                  <div className="preference">
                    <span>
                      {preference.mode === 'mute' ? 'Muted' : 'Snoozed'} until{' '}
                      {formatDateShort(preference.until)}
                    </span>
                    <button type="button" className="text-button" onClick={() => onResume(goal.id)}>
                      Resume
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rail-block" id="plan">
        <p className="eyebrow">Your plan</p>
        {openActions.length === 0 && doneActions.length === 0 ? (
          <p className="rail-empty">
            Nothing added yet. Accept a proposal and the next step lands here.
          </p>
        ) : (
          <div className="plan-list">
            {[...openActions, ...doneActions].map((action) => (
              <div
                key={action.id}
                className={`plan-item ${action.status === 'done' ? 'is-done' : ''}`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={action.status === 'done'}
                  className="plan-check"
                  onClick={() =>
                    onToggleAction(action.id, action.status === 'done' ? 'open' : 'done')
                  }
                  aria-label={action.status === 'done' ? 'Mark as open' : 'Mark as done'}
                >
                  {action.status === 'done' ? <IconCheck size={11} /> : null}
                </button>
                <span>{action.nextStep}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

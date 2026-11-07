import type { StudioDay } from '../types';

type WeekStripProps = {
  days: StudioDay[];
  selected: number;
  onSelect: (index: number) => void;
};

export function WeekStrip({ days, selected, onSelect }: WeekStripProps) {
  return (
    <div className="week" role="group" aria-label="Days this week">
      {days.map((day) => (
        <button
          key={day.index}
          type="button"
          className={`week-day ${day.isStoryDay ? 'is-today' : ''} ${
            selected === day.index ? 'is-selected' : ''
          }`}
          aria-pressed={selected === day.index}
          aria-label={`${day.weekday} ${day.dayNumber} ${day.month}`}
          onClick={() => onSelect(day.index)}
        >
          <span className="week-weekday">{day.weekday}</span>
          <span className="week-number">{day.dayNumber}</span>
          <span className="week-dots" aria-hidden="true">
            {Array.from({ length: day.counts.propose }).map((_, index) => (
              <i key={`p-${index}`} className="dot dot-propose" />
            ))}
            {Array.from({ length: day.counts.defer }).map((_, index) => (
              <i key={`d-${index}`} className="dot dot-defer" />
            ))}
            {Array.from({ length: day.counts.quiet }).map((_, index) => (
              <i key={`q-${index}`} className="dot dot-quiet" />
            ))}
            {day.counts.pending > 0 ? <i className="dot dot-pending" /> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

import { progressButton } from './styles.generated';

type AnimatedProgressButtonProps = {
  children: unknown;
  complete: boolean;
  message: string;
  progress: number;
};

export function AnimatedProgressButton({
  children,
  complete,
  message,
  progress,
}: AnimatedProgressButtonProps) {
  return (
    <div
      class={progressButton.progressButton}
      data-complete={String(complete)}
      data-progress-button
      data-progress-zero={progress <= 0 ? true : undefined}
      style={`--progress: ${Math.max(0, Math.min(1, progress)) * 100}`}
    >
      <svg aria-hidden="true" class={progressButton.border}>
        <defs>
          <linearGradient id="progress-button-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop class={progressButton.gradientStart} offset="0%" />
            <stop class={progressButton.gradientEnd} offset="100%" />
          </linearGradient>
        </defs>
        <rect class={progressButton.track} />
        <rect class={progressButton.progress} pathLength="100" />
      </svg>
      <span class={progressButton.helper}>
        <span
          aria-hidden="true"
          class={progressButton.arrow}
          data-progress-arrow
          hidden={progress === 0}
        >
          ↑
        </span>
        <span data-progress-message>{message}</span>
      </span>
      <div class={progressButton.action}>{children}</div>
    </div>
  );
}

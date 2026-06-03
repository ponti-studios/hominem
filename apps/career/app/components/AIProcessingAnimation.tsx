import { LoadingSpinner } from '@hominem/ui/loading-spinner';
import { memo } from 'react';

const processingSteps = ['Extracting experience', 'Structuring skills', 'Optimizing language'];

export const AIProcessingAnimation = memo(() => {
  return (
    <div className="mx-auto w-full max-w-xs rounded-md border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <LoadingSpinner variant="md" />

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Analyzing resume</p>
          <p className="text-xs text-muted-foreground">
            Turning your resume into structured portfolio content.
          </p>
        </div>

        <div className="grid w-full gap-1.5">
          {processingSteps.map((step) => (
            <div
              key={step}
              className="flex items-center justify-between rounded border border-border bg-muted/40 px-3 py-1.5"
            >
              <span className="text-xs text-muted-foreground">{step}</span>
              <span className="size-1.5 rounded-full bg-accent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

AIProcessingAnimation.displayName = 'AIProcessingAnimation';

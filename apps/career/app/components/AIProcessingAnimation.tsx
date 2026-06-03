import { LoadingSpinner } from '@hominem/ui/loading-spinner';
import { memo } from 'react';

const processingSteps = ['Extracting experience', 'Structuring skills', 'Optimizing language'];

export const AIProcessingAnimation = memo(() => {
  return (
    <div className="mx-auto w-full max-w-sm rounded-md border border-border bg-card p-6 text-card-foreground">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex size-20 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
          <LoadingSpinner variant="lg" />
        </div>

        <div className="space-y-2">
          <h2 className="heading-3 text-foreground">Analyzing Resume Data</h2>
          <p className="body-2 text-muted-foreground">
            Turning your resume into structured portfolio content.
          </p>
        </div>

        <div className="grid w-full gap-2">
          {processingSteps.map((step) => (
            <div
              key={step}
              className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{step}</span>
              <span className="size-2 rounded-full bg-accent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

AIProcessingAnimation.displayName = 'AIProcessingAnimation';

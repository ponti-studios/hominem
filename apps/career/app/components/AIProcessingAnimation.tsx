import { LoadingSpinner } from '@hominem/ui/loading-spinner';
import { memo } from 'react';

import { cn } from '~/lib/utils';
export type ResumeUploadStep = 'uploading' | 'extracting' | 'analyzing' | 'saving';

const processingSteps: { id: ResumeUploadStep; label: string }[] = [
  { id: 'uploading', label: 'Uploading PDF' },
  { id: 'extracting', label: 'Reading PDF text' },
  { id: 'analyzing', label: 'Analyzing resume' },
  { id: 'saving', label: 'Saving portfolio' },
];

interface AIProcessingAnimationProps {
  activeStep?: ResumeUploadStep;
  message?: string;
}

export const AIProcessingAnimation = memo(
  ({
    activeStep = 'uploading',
    message = 'Turning your resume into structured portfolio content.',
  }: AIProcessingAnimationProps) => {
    const activeIndex = processingSteps.findIndex((step) => step.id === activeStep);

    return (
      <div className="w-full rounded-md border border-border bg-card p-4 text-card-foreground">
        <div className="flex flex-col items-center gap-4 text-center">
          <LoadingSpinner variant="md" />

          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {processingSteps[activeIndex]?.label ?? 'Processing resume'}
            </p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>

          <div className="grid w-full gap-1.5">
            {processingSteps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center justify-between rounded border border-border bg-muted/40 px-3 py-1.5"
              >
                <span className="text-xs text-muted-foreground">{step.label}</span>
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    index <= activeIndex ? 'bg-accent' : 'bg-muted-foreground/30',
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
);

AIProcessingAnimation.displayName = 'AIProcessingAnimation';

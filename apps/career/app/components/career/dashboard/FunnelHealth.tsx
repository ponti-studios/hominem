import { Card, CardContent } from '@hominem/ui/card';

import type { ApplicationWithCompany } from '~/types/applications';

interface StepRate {
  label: string;
  rate: number;
}

function getStepRates(applications: ApplicationWithCompany[]): StepRate[] {
  const total = applications.length;
  if (total === 0) return [];

  const responses = applications.filter((a) => a.response_date).length;
  const interviews = applications.filter((a) => a.first_interview_date).length;
  const offers = applications.filter((a) => a.status === 'OFFER' || a.status === 'ACCEPTED').length;

  return [
    {
      label: 'Applied → Response',
      rate: total > 0 ? (responses / total) * 100 : 0,
    },
    {
      label: 'Response → Interview',
      rate: responses > 0 ? (interviews / responses) * 100 : 0,
    },
    {
      label: 'Interview → Offer',
      rate: interviews > 0 ? (offers / interviews) * 100 : 0,
    },
  ];
}

function getInterpretation(steps: StepRate[]): string {
  if (steps.length === 0) return 'Add applications to see how your search is performing.';

  const [responseStep, interviewStep, offerStep] = steps;

  if (responseStep.rate < 15) {
    return 'Few companies are responding. The problem is likely targeting or application materials — not your interview skills.';
  }
  if (interviewStep.rate < 40) {
    return "You're getting responses but losing people at the screening stage. Your resume or initial pitch may need sharper tailoring.";
  }
  if (offerStep.rate < 25) {
    return "You're reaching interviews but not converting to offers. That's a closing problem — focus on interview preparation and how you handle the offer conversation.";
  }
  return 'Your funnel looks healthy. Keep the volume and quality up.';
}

function rateColor(rate: number) {
  if (rate >= 40) return 'text-success';
  if (rate >= 20) return 'text-warning';
  return 'text-destructive';
}

interface FunnelHealthProps {
  applications: ApplicationWithCompany[];
}

export function FunnelHealth({ applications }: FunnelHealthProps) {
  const steps = getStepRates(applications);
  const interpretation = getInterpretation(steps);

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {steps.length > 0 ? (
          <div className="flex items-center gap-1">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1 flex-1">
                <div className="flex-1 text-center">
                  <p className={`ui-data-value ${rateColor(step.rate)}`}>
                    {Math.round(step.rate)}%
                  </p>
                  <p className="ui-data-label mt-1">{step.label}</p>
                </div>
                {i < steps.length - 1 && (
                  <span className="text-muted-foreground body-4 shrink-0">→</span>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <p className="footnote text-muted-foreground border-t border-border pt-4">
          {interpretation}
        </p>
      </CardContent>
    </Card>
  );
}

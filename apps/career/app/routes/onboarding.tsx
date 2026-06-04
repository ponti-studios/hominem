import { Button } from '@hominem/ui/button';
import { ArrowRight, CheckCircle2, Copy, Eye, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { UploadResumeForm } from '../components/UploadResumeForm';
import type { UploadResumeResponse } from '../types/resume';

export default function Onboarding() {
  const navigate = useNavigate();
  const [completedUpload, setCompletedUpload] = useState<UploadResumeResponse | null>(null);
  const [copyLabel, setCopyLabel] = useState('');

  const portfolioPath = completedUpload?.portfolioSlug ? `/p/${completedUpload.portfolioSlug}` : null;
  const handleUploadStart = () => undefined;
  const handleUploadComplete = (response: UploadResumeResponse) => setCompletedUpload(response);
  const handleUploadError = () => undefined;
  const copyPortfolioLink = async () => {
    if (!portfolioPath) return;

    await navigator.clipboard.writeText(new URL(portfolioPath, window.location.origin).toString());
    setCopyLabel('Copied');
    setTimeout(() => setCopyLabel(''), 3000);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center">
      {completedUpload ? (
        <div className="mx-auto w-full max-w-lg space-y-4 text-center">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-secondary flex justify-center items-center gap-4 border rounded w-fit px-4 py-2 mx-auto bg-primary">
              <CheckCircle2 className="size-5 text-muted-foreground" />
              Portfolio created
            </h1>
          </div>

          {portfolioPath ? (
            <div className="flex items-center gap-2 rounded-md border bg-secondary px-3 text-left">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {portfolioPath}
              </code>
              <Button type="button" onClick={copyPortfolioLink} variant="ghost" size="xs">
                {copyLabel || <Copy className="size-3" />}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button type="button" onClick={() => navigate(portfolioPath ?? '/account')} variant="primary">
              <Eye className="size-4" />
              View Portfolio
              <ArrowRight className="size-4" />
            </Button>
            <Button type="button" onClick={() => navigate('/editor')} variant="outline">
              Customize
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => setCompletedUpload(null)}
            variant="ghost"
            className="mx-auto"
          >
            <RotateCcw className="size-4" />
            Upload another resume
          </Button>
        </div>
      ) : (
        <UploadResumeForm
          onUploadStart={handleUploadStart}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
      )}
    </div>
  );
}

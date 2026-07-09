import { db, PortfolioRepository } from '@hominem/db';
import { Button } from '@hominem/ui';
import { useState } from 'react';
import { redirect, useFetcher, useNavigate } from 'react-router';

import { FormErrorAlert } from '~/components/FormErrorAlert';
import { UploadResumeForm } from '~/components/UploadResumeForm';
import type { UploadResumeApiResponse } from '~/lib/api-contracts';
import { portfolioContext, userContext } from '~/lib/middleware';

import type { Route } from './+types/onboarding';

function portfolioDisplayName(user: { name?: string | null; email: string }) {
  const name = user.name?.trim();
  if (name) return name;
  const local = user.email.split('@')[0]?.trim();
  return local || 'You';
}

export async function loader({ context }: Route.LoaderArgs) {
  const portfolio = context.get(portfolioContext);
  if (portfolio) {
    throw redirect('/applications');
  }
  return null;
}

export async function action({ context }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const existing = context.get(portfolioContext);

  if (existing) {
    throw redirect('/work');
  }

  try {
    await PortfolioRepository.createDefaultPortfolio(db, {
      ownerUserid: user.id,
      email: user.email,
      name: portfolioDisplayName(user),
    });
  } catch (error) {
    console.error('Failed to create empty portfolio:', error);
    return {
      success: false as const,
      error: 'We couldn’t start your portfolio. Try again.',
    };
  }

  throw redirect('/work');
}

export function meta() {
  return [
    { title: 'Get started — Craftd' },
    {
      name: 'description',
      content: 'Start from your resume or build your foundation as you go.',
    },
  ];
}

export default function Onboarding() {
  const navigate = useNavigate();
  const emptyStartFetcher = useFetcher<typeof action>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isStartingEmpty = emptyStartFetcher.state !== 'idle';
  const emptyStartError =
    emptyStartFetcher.data && 'success' in emptyStartFetcher.data && !emptyStartFetcher.data.success
      ? emptyStartFetcher.data.error
      : null;

  const handleUploadComplete = (_response: UploadResumeApiResponse) => {
    navigate('/work');
  };

  const handleStartEmpty = () => {
    emptyStartFetcher.submit({}, { method: 'POST' });
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 py-4">
      <header className="space-y-2 text-center sm:text-left">
        <p className="ui-eyebrow">Get started</p>
        <h1 className="heading-2 text-foreground">Start from your resume — or build as you go.</h1>
        <p className="body-2 text-muted-foreground">
          Upload a PDF to extract work history and skills automatically. Prefer to type? Start empty
          and add roles whenever you’re ready.
        </p>
      </header>

      <div className="mx-auto w-full max-w-md">
        <UploadResumeForm
          showHeading={false}
          onUploadStart={() => {
            setIsUploading(true);
            setUploadError(null);
          }}
          onUploadComplete={(response) => {
            setIsUploading(false);
            handleUploadComplete(response);
          }}
          onUploadError={(error) => {
            setIsUploading(false);
            setUploadError(error);
          }}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="body-4 text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <FormErrorAlert title="Couldn’t start empty" message={emptyStartError} />

        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full"
          disabled={isUploading || isStartingEmpty}
          isLoading={isStartingEmpty}
          loadingLabel="Starting…"
          onClick={handleStartEmpty}
        >
          Start without a resume
        </Button>

        {uploadError ? (
          <p className="body-4 text-center text-muted-foreground">
            Upload failed? You can still start empty and add details by hand.
          </p>
        ) : null}
      </div>
    </div>
  );
}

import { Button } from '@ponti-studios/ui/primitives';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { UploadResumeForm } from '~/components/UploadResumeForm';
import type { UploadResumeApiResponse } from '~/lib/api-contracts';

export function meta() {
  return [
    { title: 'Import resume — career' },
    {
      name: 'description',
      content: 'Update your portfolio from a resume PDF.',
    },
  ];
}

/**
 * Optional import path. Portfolio already exists (created at sign-in);
 * upload always replaces/updates that single portfolio.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadComplete = (_response: UploadResumeApiResponse) => {
    navigate('/work');
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <header className="space-y-2 text-center sm:text-left">
        <p className="ui-eyebrow">Import</p>
        <h1 className="heading-2 text-foreground">Fill your portfolio from a resume</h1>
        <p className="body-2 text-muted-foreground">
          We’ll replace your current portfolio details with what we extract from the PDF. You can
          always edit afterward.
        </p>
      </header>

      <div className="mx-auto w-full max-w-md">
        <UploadResumeForm
          mode="replace"
          showHeading={false}
          onUploadStart={() => setIsUploading(true)}
          onUploadComplete={(response) => {
            setIsUploading(false);
            handleUploadComplete(response);
          }}
          onUploadError={() => setIsUploading(false)}
        />
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          disabled={isUploading}
          asChild
        >
          <Link to="/work">Skip for now</Link>
        </Button>
      </div>
    </div>
  );
}

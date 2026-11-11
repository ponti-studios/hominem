import { Button } from '@ponti-studios/ui/primitives';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { DetailSection, PageHeader } from '~/components/design';
import { Container } from '~/components/design/container';
import { UploadResumeForm } from '~/modules/career/components/UploadResumeForm';
import type { UploadResumeApiResponse } from '~/modules/career/lib/api-contracts';

export function meta() {
  return [
    { title: 'Import resume — career' },
    {
      name: 'description',
      content: 'Update your profile from a resume PDF.',
    },
  ];
}

/**
 * Optional import path. Profile already exists (created at sign-in);
 * upload always replaces/updates that single profile.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadComplete = (_response: UploadResumeApiResponse) => {
    navigate('/career/work');
  };

  return (
    <Container size="sm">
      <PageHeader eyebrow="Career · Import" title="Fill your profile from a resume" />

      <DetailSection title="Resume PDF">
        <UploadResumeForm
          mode="create"
          onUploadStart={() => setIsUploading(true)}
          onUploadComplete={(response) => {
            setIsUploading(false);
            handleUploadComplete(response);
          }}
          onUploadError={() => setIsUploading(false)}
        />
      </DetailSection>

      <div className="mt-4 flex justify-center">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          disabled={isUploading}
          asChild
        >
          <Link to="/career/work">Skip for now</Link>
        </Button>
      </div>
    </Container>
  );
}

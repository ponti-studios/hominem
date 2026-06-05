import { useNavigate } from 'react-router';

import { UploadResumeForm } from '../components/UploadResumeForm';
import type { UploadResumeApiResponse } from '../lib/api-contracts';

export default function Onboarding() {
  const navigate = useNavigate();
  const handleUploadComplete = (response: UploadResumeApiResponse) => {
    navigate(`/p/${response.portfolioSlug}`);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <UploadResumeForm
        onUploadStart={() => undefined}
        onUploadComplete={handleUploadComplete}
        onUploadError={() => undefined}
      />
    </div>
  );
}

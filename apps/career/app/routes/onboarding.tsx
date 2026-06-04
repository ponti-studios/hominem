import { useNavigate } from 'react-router';

import { UploadResumeForm } from '../components/UploadResumeForm';
import type { UploadResumeResponse } from '../types/resume';

export default function Onboarding() {
  const navigate = useNavigate();
  const handleUploadComplete = (response: UploadResumeResponse) => {
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

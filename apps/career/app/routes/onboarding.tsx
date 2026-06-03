import { useNavigate } from 'react-router';

import { UploadResumeForm } from '../components/UploadResumeForm';
import type { UploadResumeResponse } from '../types/resume';

export default function Onboarding() {
  const navigate = useNavigate();

  const handleUploadStart = () => undefined;
  const handleUploadComplete = (response: UploadResumeResponse) => {
    const slugQuery = response.portfolioSlug
      ? `?slug=${encodeURIComponent(response.portfolioSlug)}`
      : '?completed=true';
    navigate(`/onboarding/complete${slugQuery}`);
  };
  const handleUploadError = () => undefined;

  return (
    <div className="flex flex-col items-center justify-center">
      <UploadResumeForm
        onUploadStart={handleUploadStart}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
      />
    </div>
  );
}

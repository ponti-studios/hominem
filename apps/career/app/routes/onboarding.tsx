import { useNavigate } from 'react-router';

import { UploadResumeForm } from '../components/UploadResumeForm';

export default function Onboarding() {
  const navigate = useNavigate();
  const handleUploadComplete = () => {
    navigate('/work');
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

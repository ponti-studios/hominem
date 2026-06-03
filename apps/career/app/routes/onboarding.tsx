import { useState } from 'react';
import { useNavigate } from 'react-router';

import { AIProcessingAnimation } from '../components/AIProcessingAnimation';
import { UploadResumeForm } from '../components/UploadResumeForm';
import type { ConvertedResumeData } from '../types/resume';

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const handleUploadStart = () => setCurrentStep(1);
  const handleUploadComplete = (_data: ConvertedResumeData) => {
    navigate('/onboarding/complete?completed=true');
  };
  const handleUploadError = () => setCurrentStep(0);

  return (
    <div className="flex flex-col items-center justify-center">
      {currentStep === 0 && (
        <UploadResumeForm
          onUploadStart={handleUploadStart}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
      )}
      {currentStep === 1 && <AIProcessingAnimation />}
    </div>
  );
}

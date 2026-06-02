import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AIProcessingAnimation } from '../components/AIProcessingAnimation'
import { UploadResumeForm } from '../components/UploadResumeForm'
import type { ConvertedResumeData } from '../types/resume'

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0)
  const [conversion, setConversion] = useState<ConvertedResumeData | null>(null)
  const navigate = useNavigate()

  const handleUploadStart = () => setCurrentStep(1)
  const handleUploadComplete = (data: ConvertedResumeData) => {
    navigate('/onboarding/complete?completed=true')
  }
  const handleUploadError = (error: string) => {
    // Reset to upload step so user can try again
    setCurrentStep(0)
  }

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Step Content */}
      {currentStep === 0 && (
        <UploadResumeForm
          onUploadStart={handleUploadStart}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
      )}

      {currentStep === 1 && <AIProcessingAnimation />}

      {currentStep === 2 && conversion && (
        <div className="flex flex-col items-center space-y-4">
          <CheckCircle2 className="text-green-500 w-16 h-16 animate-bounce" />
          <p className="text-lg text-gray-700">Done! Redirecting to review...</p>
        </div>
      )}
    </div>
  )
}

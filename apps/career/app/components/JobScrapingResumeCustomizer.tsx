import { useState } from 'react'
import type { JobPosting, ScrapedJobPostingResponse } from '~/types/applications'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

interface JobAnalysis {
  requiredSkills: string[]
  qualifications: string[]
  cultureKeywords: string[]
  recommendedKeywords: string[]
}

interface CustomizeResumeResponse {
  success: boolean
  customizedResume: string
  jobAnalysis: JobAnalysis | null
  metadata: {
    format: string
    targetLength: string
    focusAreas: string[]
    generatedAt: string
    portfolioId: string
    jobPostingSource: string
    jobPostingUrl?: string
    jobPostingWordCount: number
    jobPostingMetadata: {
      jobTitle?: string
      companyName?: string
      requirements?: string[]
      skills?: string[]
    }
  }
  error?: string
}

type Step = 'scrape' | 'review' | 'generate' | 'result'

interface JobScrapingResumeCustomizerProps {
  onScrapedData?: (data: JobPosting) => void
  showResumeGeneration?: boolean
}

export function JobScrapingResumeCustomizer({
  onScrapedData,
  showResumeGeneration = true,
}: JobScrapingResumeCustomizerProps) {
  const [step, setStep] = useState<Step>('scrape')
  const [jobUrl, setJobUrl] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [scrapedJob, setScrapedJob] = useState<JobPosting | null>(null)
  const [scrapingError, setScrapingError] = useState<string | null>(null)

  // Resume generation state
  const [resumeFormat, setResumeFormat] = useState<
    'professional' | 'modern' | 'technical' | 'executive'
  >('professional')
  const [targetLength, setTargetLength] = useState<'concise' | 'standard' | 'detailed'>('standard')
  const [focusAreas, setFocusAreas] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [resumeResult, setResumeResult] = useState<CustomizeResumeResponse | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)

  // Application saving state
  const [isSaving, setIsSaving] = useState(false)
  const [savedApplication, setSavedApplication] = useState<{
    id: string
    [key: string]: unknown
  } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleScrape = async () => {
    if (!jobUrl.trim()) {
      setScrapingError('Please enter a job posting URL')
      return
    }

    setIsScraping(true)
    setScrapingError(null)
    setScrapedJob(null)

    try {
      const formData = new FormData()
      formData.append('jobUrl', jobUrl.trim())

      const response = await fetch('/api/job/scrape', {
        method: 'POST',
        body: formData,
      })

      const data: ScrapedJobPostingResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape job posting')
      }

      if (data.jobPosting) {
        setScrapedJob(data.jobPosting)
        if (onScrapedData) {
          onScrapedData(data.jobPosting)
        } else {
          setStep('review')
        }
      } else {
        throw new Error('No job posting data received')
      }
    } catch (err) {
      setScrapingError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsScraping(false)
    }
  }

  const handleSaveApplication = async () => {
    if (!scrapedJob) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await fetch('/api/applications/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobPosting: scrapedJob }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save application')
      }

      setSavedApplication(data.application)
      setStep('generate')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateResume = async () => {
    if (!scrapedJob) return

    setIsGenerating(true)
    setGenerationError(null)
    setResumeResult(null)

    try {
      const response = await fetch('/api/resume/customize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobPostingData: scrapedJob,
          resumeFormat,
          targetLength,
          focusAreas: focusAreas
            ? focusAreas
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        }),
      })

      const data: CustomizeResumeResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to customize resume')
      }

      setResumeResult(data)
      setStep('result')
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyResume = () => {
    if (resumeResult?.customizedResume) {
      navigator.clipboard.writeText(resumeResult.customizedResume)
    }
  }

  const handleDownloadResume = () => {
    if (resumeResult?.customizedResume) {
      const blob = new Blob([resumeResult.customizedResume], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customized-resume-${Date.now()}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const resetFlow = () => {
    setStep('scrape')
    setJobUrl('')
    setScrapedJob(null)
    setScrapingError(null)
    setResumeResult(null)
    setGenerationError(null)
    setSavedApplication(null)
    setSaveError(null)
  }

  return (
    <div className="space-y-12">
      {/* Step Indicator */}
      {showResumeGeneration && (
        <div className="flex items-center justify-center space-x-8">
          <div
            className={`flex items-center space-x-3 ${step === 'scrape' ? 'text-black' : 'text-gray-400'}`}
          >
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'scrape' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
            >
              <span className="text-sm font-medium">1</span>
            </div>
            <span className="text-sm font-medium">Scrape</span>
          </div>
          <div
            className={`w-12 h-px ${step === 'review' || step === 'generate' || step === 'result' ? 'bg-black' : 'bg-gray-300'}`}
          />
          <div
            className={`flex items-center space-x-3 ${step === 'review' ? 'text-black' : step === 'generate' || step === 'result' ? 'text-black' : 'text-gray-400'}`}
          >
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'review' ? 'border-black bg-black text-white' : step === 'generate' || step === 'result' ? 'border-black' : 'border-gray-300'}`}
            >
              <span className="text-sm font-medium">2</span>
            </div>
            <span className="text-sm font-medium">Review</span>
          </div>
          <div
            className={`w-12 h-px ${step === 'generate' || step === 'result' ? 'bg-black' : 'bg-gray-300'}`}
          />
          <div
            className={`flex items-center space-x-3 ${step === 'generate' ? 'text-black' : step === 'result' ? 'text-black' : 'text-gray-400'}`}
          >
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'generate' ? 'border-black bg-black text-white' : step === 'result' ? 'border-black' : 'border-gray-300'}`}
            >
              <span className="text-sm font-medium">3</span>
            </div>
            <span className="text-sm font-medium">Generate</span>
          </div>
          <div className={`w-12 h-px ${step === 'result' ? 'bg-black' : 'bg-gray-300'}`} />
          <div
            className={`flex items-center space-x-3 ${step === 'result' ? 'text-black' : 'text-gray-400'}`}
          >
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${step === 'result' ? 'border-black bg-black text-white' : 'border-gray-300'}`}
            >
              <span className="text-sm font-medium">4</span>
            </div>
            <span className="text-sm font-medium">Result</span>
          </div>
        </div>
      )}

      {/* Step 1: Scrape Job Posting */}
      {step === 'scrape' && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-2">Job Posting URL</h2>
            <p className="text-gray-600">Enter the URL of the job posting you'd like to analyze</p>
          </div>

          <div className="space-y-6">
            <div>
              <Input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://example.com/job-posting"
                className="w-full text-center text-lg py-4 border-0 border-b-2 border-gray-300 focus:border-black focus:ring-0 rounded-none"
              />
            </div>

            {scrapingError && (
              <div className="text-center">
                <p className="text-red-600 text-sm">{scrapingError}</p>
              </div>
            )}

            <div className="text-center">
              <Button
                onClick={handleScrape}
                disabled={isScraping || !jobUrl.trim()}
                className={`px-8 py-3 border-0 rounded-none transition-all duration-200 ${
                  isScraping
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                {isScraping ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Scraping...</span>
                  </div>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Review Scraped Job Posting */}
      {step === 'review' && scrapedJob && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-2">
              Review Job Posting
            </h2>
            <p className="text-gray-600">Verify the extracted information before proceeding</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div>
                <h3 className="font-serif text-lg font-medium text-gray-900 mb-2">Position</h3>
                <p className="text-gray-700">{scrapedJob.jobTitle}</p>
              </div>

              <div>
                <h3 className="font-serif text-lg font-medium text-gray-900 mb-2">Company</h3>
                <p className="text-gray-700">{scrapedJob.companyName}</p>
              </div>

              {scrapedJob.requirements.length > 0 && (
                <div>
                  <h3 className="font-serif text-lg font-medium text-gray-900 mb-3">
                    Requirements
                  </h3>
                  <ul className="space-y-2">
                    {scrapedJob.requirements.map((req, index) => (
                      <li
                        key={`req-${index}-${req.slice(0, 20)}`}
                        className="text-gray-700 text-sm"
                      >
                        • {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-serif text-lg font-medium text-gray-900 mb-3">Description</h3>
              <div className="bg-gray-50 p-6 max-h-96 overflow-y-auto">
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {scrapedJob.jobDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12 space-x-4">
            <Button
              onClick={handleSaveApplication}
              disabled={isSaving}
              className={`px-8 py-3 border-0 rounded-none transition-all duration-200 ${
                isSaving
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {isSaving ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : (
                'Save & Continue'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep('scrape')}
              className="px-8 py-3 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-none"
            >
              Back
            </Button>
          </div>

          {saveError && (
            <div className="text-center mt-4">
              <p className="text-red-600 text-sm">{saveError}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Generate Resume */}
      {showResumeGeneration && step === 'generate' && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-2">
              Resume Preferences
            </h2>
            <p className="text-gray-600">Configure your resume format and style</p>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label
                  htmlFor="resumeFormat"
                  className="block font-serif text-sm font-medium text-gray-900 mb-3"
                >
                  Format
                </label>
                <Select
                  id="resumeFormat"
                  value={resumeFormat}
                  onValueChange={(value) => setResumeFormat(value as typeof resumeFormat)}
                  disabled={isGenerating}
                  className="w-full border-0 border-b-2 border-gray-300 focus:border-black focus:ring-0 rounded-none"
                >
                  <option value="professional">Professional</option>
                  <option value="modern">Modern</option>
                  <option value="technical">Technical</option>
                  <option value="executive">Executive</option>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="targetLength"
                  className="block font-serif text-sm font-medium text-gray-900 mb-3"
                >
                  Length
                </label>
                <Select
                  id="targetLength"
                  value={targetLength}
                  onValueChange={(value) => setTargetLength(value as typeof targetLength)}
                  disabled={isGenerating}
                  className="w-full border-0 border-b-2 border-gray-300 focus:border-black focus:ring-0 rounded-none"
                >
                  <option value="concise">Concise</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </Select>
              </div>
            </div>

            <div>
              <label
                htmlFor="focusAreas"
                className="block font-serif text-sm font-medium text-gray-900 mb-3"
              >
                Focus Areas (optional)
              </label>
              <Input
                id="focusAreas"
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="leadership, technical, etc."
                disabled={isGenerating}
                className="w-full border-0 border-b-2 border-gray-300 focus:border-black focus:ring-0 rounded-none"
              />
            </div>
          </div>

          <div className="text-center mt-12 space-x-4">
            <Button
              onClick={handleGenerateResume}
              disabled={isGenerating}
              className={`px-8 py-3 border-0 rounded-none transition-all duration-200 ${
                isGenerating
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {isGenerating ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating...</span>
                </div>
              ) : (
                'Generate Resume'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep('review')}
              className="px-8 py-3 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-none"
            >
              Back
            </Button>
          </div>

          {generationError && (
            <div className="text-center mt-4">
              <p className="text-red-600 text-sm">{generationError}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Display Results */}
      {showResumeGeneration && step === 'result' && resumeResult && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-2">
              Your Customized Resume
            </h2>
            <p className="text-gray-600">Ready to download and apply</p>
          </div>

          {/* Job Analysis */}
          {resumeResult.jobAnalysis && (
            <div className="mb-12">
              <h3 className="font-serif text-lg font-medium text-gray-900 mb-6 text-center">
                Key Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-serif text-sm font-medium text-gray-900 mb-3">
                    Required Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {resumeResult.jobAnalysis.requiredSkills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 border border-gray-300 text-gray-700 text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-serif text-sm font-medium text-gray-900 mb-3">
                    Recommended Keywords
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {resumeResult.jobAnalysis.recommendedKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="px-3 py-1 border border-gray-300 text-gray-700 text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customized Resume */}
          <div className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif text-lg font-medium text-gray-900">Resume Content</h3>
              <div className="space-x-3">
                <Button
                  variant="outline"
                  onClick={handleCopyResume}
                  className="px-4 py-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-none"
                >
                  Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadResume}
                  className="px-4 py-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-none"
                >
                  Download
                </Button>
              </div>
            </div>

            <div className="bg-gray-50 p-8 border border-gray-200">
              <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm leading-relaxed">
                {resumeResult.customizedResume}
              </pre>
            </div>
          </div>

          <div className="text-center space-x-4">
            <Button
              onClick={resetFlow}
              className="px-8 py-3 bg-black text-white hover:bg-gray-800 border-0 rounded-none"
            >
              Start Over
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep('generate')}
              className="px-8 py-3 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-none"
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

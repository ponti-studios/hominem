import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
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
  }
  error?: string
}

interface ResumeCustomizerProps {
  applicationId?: string
  initialJobPosting?: string
}

export function ResumeCustomizer({ applicationId, initialJobPosting = '' }: ResumeCustomizerProps) {
  const [jobPosting, setJobPosting] = useState(initialJobPosting)
  const [jobPostingUrl, setJobPostingUrl] = useState('')
  const [inputMethod, setInputMethod] = useState<'text' | 'url'>('text')
  const [resumeFormat, setResumeFormat] = useState<
    'professional' | 'modern' | 'technical' | 'executive'
  >('professional')
  const [targetLength, setTargetLength] = useState<'concise' | 'standard' | 'detailed'>('standard')
  const [focusAreas, setFocusAreas] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<CustomizeResumeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFormCollapsed, setIsFormCollapsed] = useState(false)

  const handleGenerate = async () => {
    if (inputMethod === 'text' && !jobPosting.trim()) {
      setError('Please paste the job posting content')
      return
    }

    if (inputMethod === 'url' && !jobPostingUrl.trim()) {
      setError('Please enter a job posting URL')
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const requestBody: {
        resumeFormat: typeof resumeFormat
        targetLength: typeof targetLength
        focusAreas: string[]
        jobPosting?: string
        jobPostingUrl?: string
      } = {
        resumeFormat,
        targetLength,
        focusAreas: focusAreas
          ? focusAreas
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      }

      // Add the appropriate field based on input method
      if (inputMethod === 'text') {
        requestBody.jobPosting = jobPosting.trim()
      } else {
        requestBody.jobPostingUrl = jobPostingUrl.trim()
      }

      const response = await fetch('/api/resume/customize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to customize resume')
      }

      setResult(data)
      setIsFormCollapsed(true) // Collapse form when results are available
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyResume = () => {
    if (result?.customizedResume) {
      navigator.clipboard.writeText(result.customizedResume)
      // You could add a toast notification here
    }
  }

  const handleDownloadResume = () => {
    if (result?.customizedResume) {
      const blob = new Blob([result.customizedResume], { type: 'text/markdown' })
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Resume Customizer</h2>
        <p className="text-gray-600">
          Paste a job posting below and we'll generate a customized resume based on your portfolio
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Job Posting & Preferences</CardTitle>
            {result && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFormCollapsed(!isFormCollapsed)}
                className="flex items-center gap-2"
              >
                {isFormCollapsed ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    Show Form
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                    Hide Form
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent
          className={`space-y-4 transition-all duration-300 ${isFormCollapsed ? 'hidden' : 'block'}`}
        >
          {/* Input Method Toggle */}
          <div>
            <label htmlFor="inputMethod" className="block text-sm font-medium text-gray-700 mb-2">
              Input Method
            </label>
            <div className="flex gap-2" id="inputMethod">
              <Button
                type="button"
                variant={inputMethod === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMethod('text')}
                disabled={isGenerating}
              >
                Paste Text
              </Button>
              <Button
                type="button"
                variant={inputMethod === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setInputMethod('url')}
                disabled={isGenerating}
              >
                Job Posting URL
              </Button>
            </div>
          </div>

          {/* Job Posting Input */}
          {inputMethod === 'text' ? (
            <div>
              <label htmlFor="jobPosting" className="block text-sm font-medium text-gray-700 mb-2">
                Job Posting Content *
              </label>
              <textarea
                id="jobPosting"
                value={jobPosting}
                onChange={(e) => setJobPosting(e.target.value)}
                placeholder="Paste the complete job posting here..."
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isGenerating}
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="jobPostingUrl"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Job Posting URL *
              </label>
              <Input
                id="jobPostingUrl"
                type="url"
                value={jobPostingUrl}
                onChange={(e) => setJobPostingUrl(e.target.value)}
                placeholder="https://example.com/job-posting/123"
                disabled={isGenerating}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                We'll automatically scrape and extract the job posting content from the URL
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="resumeFormat"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Resume Format
              </label>
              <Select
                id="resumeFormat"
                value={resumeFormat}
                onValueChange={(value) => setResumeFormat(value as typeof resumeFormat)}
                disabled={isGenerating}
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
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Target Length
              </label>
              <Select
                id="targetLength"
                value={targetLength}
                onValueChange={(value) => setTargetLength(value as typeof targetLength)}
                disabled={isGenerating}
              >
                <option value="concise">Concise (1 page)</option>
                <option value="standard">Standard (1-2 pages)</option>
                <option value="detailed">Detailed (2+ pages)</option>
              </Select>
            </div>

            <div>
              <label htmlFor="focusAreas" className="block text-sm font-medium text-gray-700 mb-2">
                Focus Areas (optional)
              </label>
              <Input
                id="focusAreas"
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="leadership, technical, etc."
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated areas to emphasize</p>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={
              isGenerating || (inputMethod === 'text' ? !jobPosting.trim() : !jobPostingUrl.trim())
            }
            className="w-full"
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {inputMethod === 'url'
                  ? 'Scraping Job Posting...'
                  : 'Generating Customized Resume...'}
              </div>
            ) : inputMethod === 'url' ? (
              'Scrape & Generate Resume'
            ) : (
              'Generate Customized Resume'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-sm">!</span>
              </div>
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Job Analysis */}
          {result.jobAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle>Job Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.jobAnalysis.requiredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Key Qualifications</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {result.jobAnalysis.qualifications.map((qual) => (
                        <li key={qual}>{qual}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Culture Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.jobAnalysis.cultureKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Recommended Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.jobAnalysis.recommendedKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customized Resume */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Customized Resume</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyResume}>
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadResume}>
                    Download
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Generated on {new Date(result.metadata.generatedAt).toLocaleString()} •{' '}
                {result.metadata.format} format • {result.metadata.targetLength} length
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                  {result.customizedResume}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

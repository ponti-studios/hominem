import { Button } from '@hominem/ui/button';
import { Input } from '@hominem/ui/input';
import { LoadingSpinner } from '@hominem/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hominem/ui/select';
import { useState } from 'react';

import type {
  CustomizeResumeApiRequest,
  CustomizeResumeApiResponse,
  JobScrapeApiRequest,
  JobScrapeApiResponse,
} from '~/lib/api-contracts';
import { cn } from '~/lib/utils';
import type { JobPosting } from '~/types/applications';

type Step = 'scrape' | 'review' | 'generate' | 'result';

interface JobScrapingResumeCustomizerProps {
  onScrapedData?: (data: JobPosting) => void;
  showResumeGeneration?: boolean;
}

export function JobScrapingResumeCustomizer({
  onScrapedData,
  showResumeGeneration = true,
}: JobScrapingResumeCustomizerProps) {
  const [step, setStep] = useState<Step>('scrape');
  const [jobUrl, setJobUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedJob, setScrapedJob] = useState<JobPosting | null>(null);
  const [scrapingError, setScrapingError] = useState<string | null>(null);

  // Resume generation state
  const [resumeFormat, setResumeFormat] = useState<
    'professional' | 'modern' | 'technical' | 'executive'
  >('professional');
  const [targetLength, setTargetLength] = useState<'concise' | 'standard' | 'detailed'>('standard');
  const [focusAreas, setFocusAreas] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resumeResult, setResumeResult] = useState<CustomizeResumeApiResponse | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Application saving state
  const [isSaving, setIsSaving] = useState(false);
  const [_savedApplication, setSavedApplication] = useState<{
    id: string;
    [key: string]: unknown;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleScrape = async () => {
    if (!jobUrl.trim()) {
      setScrapingError('Please enter a job posting URL');
      return;
    }

    setIsScraping(true);
    setScrapingError(null);
    setScrapedJob(null);

    try {
      const response = await fetch('/api/job/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: jobUrl.trim() } satisfies JobScrapeApiRequest),
      });

      const data: JobScrapeApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape job posting');
      }

      if (data.job_posting) {
        setScrapedJob(data.job_posting);
        if (onScrapedData) {
          onScrapedData(data.job_posting);
        } else {
          setStep('review');
        }
      } else {
        throw new Error('No job posting data received');
      }
    } catch (err) {
      setScrapingError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsScraping(false);
    }
  };

  const handleSaveApplication = async () => {
    if (!scrapedJob) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/applications/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_posting: scrapedJob }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save application');
      }

      setSavedApplication(data.application);
      setStep('generate');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateResume = async () => {
    if (!scrapedJob) return;

    setIsGenerating(true);
    setGenerationError(null);
    setResumeResult(null);

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
        } satisfies CustomizeResumeApiRequest),
      });

      const data: CustomizeResumeApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to customize resume');
      }

      setResumeResult(data);
      setStep('result');
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyResume = () => {
    if (resumeResult?.customizedResume) {
      navigator.clipboard.writeText(resumeResult.customizedResume);
    }
  };

  const handleDownloadResume = () => {
    if (resumeResult?.customizedResume) {
      const blob = new Blob([resumeResult.customizedResume], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customized-resume-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const resetFlow = () => {
    setStep('scrape');
    setJobUrl('');
    setScrapedJob(null);
    setScrapingError(null);
    setResumeResult(null);
    setGenerationError(null);
    setSavedApplication(null);
    setSaveError(null);
  };

  return (
    <div className="space-y-12">
      {/* Step Indicator */}
      {showResumeGeneration && (
        <div className="flex items-center justify-center space-x-8">
          <div
            className={cn(
              'flex items-center space-x-3',
              step === 'scrape' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center',
                step === 'scrape'
                  ? 'border-accent bg-primary text-primary-foreground'
                  : 'border-border',
              )}
            >
              <span className="text-sm font-medium">1</span>
            </div>
            <span className="text-sm font-medium">Scrape</span>
          </div>
          <div
            className={cn(
              'w-12 h-px',
              step === 'review' || step === 'generate' || step === 'result'
                ? 'bg-primary'
                : 'bg-muted',
            )}
          />
          <div
            className={cn(
              'flex items-center space-x-3',
              step === 'review'
                ? 'text-foreground'
                : step === 'generate' || step === 'result'
                  ? 'text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center',
                step === 'review'
                  ? 'border-accent bg-primary text-primary-foreground'
                  : step === 'generate' || step === 'result'
                    ? 'border-accent'
                    : 'border-border',
              )}
            >
              <span className="text-sm font-medium">2</span>
            </div>
            <span className="text-sm font-medium">Review</span>
          </div>
          <div
            className={cn(
              'w-12 h-px',
              step === 'generate' || step === 'result' ? 'bg-primary' : 'bg-muted',
            )}
          />
          <div
            className={cn(
              'flex items-center space-x-3',
              step === 'generate'
                ? 'text-foreground'
                : step === 'result'
                  ? 'text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center',
                step === 'generate'
                  ? 'border-accent bg-primary text-primary-foreground'
                  : step === 'result'
                    ? 'border-accent'
                    : 'border-border',
              )}
            >
              <span className="text-sm font-medium">3</span>
            </div>
            <span className="text-sm font-medium">Generate</span>
          </div>
          <div className={cn('w-12 h-px', step === 'result' ? 'bg-primary' : 'bg-muted')} />
          <div
            className={cn(
              'flex items-center space-x-3',
              step === 'result' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center',
                step === 'result'
                  ? 'border-accent bg-primary text-primary-foreground'
                  : 'border-border',
              )}
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
            <h2 className="text-xl font-semibold text-foreground mb-2">Job Posting URL</h2>
            <p className="text-muted-foreground">
              Enter the URL of the job posting you'd like to analyze
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <Input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://example.com/job-posting"
                className="w-full text-center text-lg py-4 border-0 border-b-2 border-border focus:border-accent focus:ring-0 rounded-md"
              />
            </div>

            {scrapingError && (
              <div className="text-center">
                <p className="text-destructive text-sm">{scrapingError}</p>
              </div>
            )}

            <div className="text-center">
              <Button
                onClick={handleScrape}
                disabled={isScraping || !jobUrl.trim()}
                variant="primary"
              >
                {isScraping ? <LoadingSpinner variant="sm" /> : 'Continue'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Review Scraped Job Posting */}
      {step === 'review' && scrapedJob && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-2">Review Job Posting</h2>
            <p className="text-muted-foreground">
              Verify the extracted information before proceeding
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div>
                <h3 className="font-sans text-lg font-medium text-foreground mb-2">Position</h3>
                <p className="text-muted-foreground">{scrapedJob.job_title}</p>
              </div>

              <div>
                <h3 className="font-sans text-lg font-medium text-foreground mb-2">Company</h3>
                <p className="text-muted-foreground">{scrapedJob.companyName}</p>
              </div>

              {scrapedJob.requirements.length > 0 && (
                <div>
                  <h3 className="font-sans text-lg font-medium text-foreground mb-3">
                    Requirements
                  </h3>
                  <ul className="space-y-2">
                    {scrapedJob.requirements.map((req, index) => (
                      <li
                        key={`req-${index}-${req.slice(0, 20)}`}
                        className="text-muted-foreground text-sm"
                      >
                        • {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-sans text-lg font-medium text-foreground mb-3">Description</h3>
              <div className="bg-muted p-6 max-h-96 overflow-y-auto">
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {scrapedJob.jobDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12 space-x-4">
            <Button onClick={handleSaveApplication} disabled={isSaving} variant="primary">
              {isSaving ? <LoadingSpinner variant="sm" /> : 'Save & Continue'}
            </Button>
            <Button variant="outline" onClick={() => setStep('scrape')}>
              Back
            </Button>
          </div>

          {saveError && (
            <div className="text-center mt-4">
              <p className="text-destructive text-sm">{saveError}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Generate Resume */}
      {showResumeGeneration && step === 'generate' && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-2">Resume Preferences</h2>
            <p className="text-muted-foreground">Configure your resume format and style</p>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label
                  htmlFor="resumeFormat"
                  className="block font-sans text-sm font-medium text-foreground mb-3"
                >
                  Format
                </label>
                <Select
                  value={resumeFormat}
                  onValueChange={(value) => setResumeFormat(value as typeof resumeFormat)}
                  disabled={isGenerating}
                >
                  <SelectTrigger
                    id="resumeFormat"
                    className="w-full rounded-md border-0 border-b-2 border-border px-0 focus:ring-0"
                  >
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="targetLength"
                  className="block font-sans text-sm font-medium text-foreground mb-3"
                >
                  Length
                </label>
                <Select
                  value={targetLength}
                  onValueChange={(value) => setTargetLength(value as typeof targetLength)}
                  disabled={isGenerating}
                >
                  <SelectTrigger
                    id="targetLength"
                    className="w-full rounded-md border-0 border-b-2 border-border px-0 focus:ring-0"
                  >
                    <SelectValue placeholder="Select length" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label
                htmlFor="focusAreas"
                className="block font-sans text-sm font-medium text-foreground mb-3"
              >
                Focus Areas (optional)
              </label>
              <Input
                id="focusAreas"
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="leadership, technical, etc."
                disabled={isGenerating}
                className="w-full border-0 border-b-2 border-border focus:border-accent focus:ring-0 rounded-md"
              />
            </div>
          </div>

          <div className="text-center mt-12 space-x-4">
            <Button onClick={handleGenerateResume} disabled={isGenerating} variant="primary">
              {isGenerating ? <LoadingSpinner variant="sm" /> : 'Generate Resume'}
            </Button>
            <Button variant="outline" onClick={() => setStep('review')}>
              Back
            </Button>
          </div>

          {generationError && (
            <div className="text-center mt-4">
              <p className="text-destructive text-sm">{generationError}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Display Results */}
      {showResumeGeneration && step === 'result' && resumeResult && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-2">Your Customized Resume</h2>
            <p className="text-muted-foreground">Ready to download and apply</p>
          </div>

          {/* Job Analysis */}
          {resumeResult.jobAnalysis && (
            <div className="mb-12">
              <h3 className="font-sans text-lg font-medium text-foreground mb-6 text-center">
                Key Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-sans text-sm font-medium text-foreground mb-3">
                    Required Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {resumeResult.jobAnalysis.requiredSkills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 border border-border text-muted-foreground text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-sans text-sm font-medium text-foreground mb-3">
                    Recommended Keywords
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {resumeResult.jobAnalysis.recommendedKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="px-3 py-1 border border-border text-muted-foreground text-sm"
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
              <h3 className="font-sans text-lg font-medium text-foreground">Resume Content</h3>
              <div className="space-x-3">
                <Button variant="outline" onClick={handleCopyResume}>
                  Copy
                </Button>
                <Button variant="outline" onClick={handleDownloadResume}>
                  Download
                </Button>
              </div>
            </div>

            <div className="bg-muted p-8 border border-border">
              <pre className="whitespace-pre-wrap text-foreground font-mono text-sm leading-relaxed">
                {resumeResult.customizedResume}
              </pre>
            </div>
          </div>

          <div className="text-center space-x-4">
            <Button onClick={resetFlow} variant="primary">
              Start Over
            </Button>
            <Button variant="outline" onClick={() => setStep('generate')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

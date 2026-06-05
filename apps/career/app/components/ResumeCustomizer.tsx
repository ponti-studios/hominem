import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@hominem/ui/card';
import { Input } from '@hominem/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hominem/ui/select';
import { useState } from 'react';

import type { CustomizeResumeApiRequest, CustomizeResumeApiResponse } from '~/lib/api-contracts';
import { cn } from '~/lib/utils';

interface ResumeCustomizerProps {
  applicationId?: string;
  initialJobPosting?: string;
}

export function ResumeCustomizer({
  applicationId: _applicationId,
  initialJobPosting = '',
}: ResumeCustomizerProps) {
  const [job_posting, setJobPosting] = useState(initialJobPosting);
  const [job_posting_url, setJobPostingUrl] = useState('');
  const [inputMethod, setInputMethod] = useState<'text' | 'url'>('text');
  const [resumeFormat, setResumeFormat] = useState<
    'professional' | 'modern' | 'technical' | 'executive'
  >('professional');
  const [targetLength, setTargetLength] = useState<'concise' | 'standard' | 'detailed'>('standard');
  const [focusAreas, setFocusAreas] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CustomizeResumeApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);

  const handleGenerate = async () => {
    if (inputMethod === 'text' && !job_posting.trim()) {
      setError('Please paste the job posting content');
      return;
    }

    if (inputMethod === 'url' && !job_posting_url.trim()) {
      setError('Please enter a job posting URL');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const requestBody: CustomizeResumeApiRequest = {
        resumeFormat,
        targetLength,
        focusAreas: focusAreas
          ? focusAreas
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };

      // Add the appropriate field based on input method
      if (inputMethod === 'text') {
        requestBody.job_posting = job_posting.trim();
      } else {
        requestBody.job_posting_url = job_posting_url.trim();
      }

      const response = await fetch('/api/resume/customize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as CustomizeResumeApiResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to customize resume');
      }

      setResult(data);
      setIsFormCollapsed(true); // Collapse form when results are available
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyResume = () => {
    if (result?.customizedResume) {
      navigator.clipboard.writeText(result.customizedResume);
      // You could add a toast notification here
    }
  };

  const handleDownloadResume = () => {
    if (result?.customizedResume) {
      const blob = new Blob([result.customizedResume], { type: 'text/markdown' });
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">AI Resume Customizer</h2>
        <p className="text-muted-foreground">
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
          className={cn(
            'space-y-4 transition-all duration-300',
            isFormCollapsed ? 'hidden' : 'block',
          )}
        >
          {/* Input Method Toggle */}
          <div>
            <label
              htmlFor="inputMethod"
              className="block text-sm font-medium text-muted-foreground mb-2"
            >
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
              <label
                htmlFor="job_posting"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Job Posting Content *
              </label>
              <textarea
                id="job_posting"
                value={job_posting}
                onChange={(e) => setJobPosting(e.target.value)}
                placeholder="Paste the complete job posting here..."
                rows={8}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring/50"
                disabled={isGenerating}
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="job_posting_url"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Job Posting URL *
              </label>
              <Input
                id="job_posting_url"
                type="url"
                value={job_posting_url}
                onChange={(e) => setJobPostingUrl(e.target.value)}
                placeholder="https://example.com/job-posting/123"
                disabled={isGenerating}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                We'll automatically scrape and extract the job posting content from the URL
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="resumeFormat"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Resume Format
              </label>
              <Select
                value={resumeFormat}
                onValueChange={(value) => setResumeFormat(value as typeof resumeFormat)}
                disabled={isGenerating}
              >
                <SelectTrigger id="resumeFormat" className="w-full">
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
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Target Length
              </label>
              <Select
                value={targetLength}
                onValueChange={(value) => setTargetLength(value as typeof targetLength)}
                disabled={isGenerating}
              >
                <SelectTrigger id="targetLength" className="w-full">
                  <SelectValue placeholder="Select length" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise (1 page)</SelectItem>
                  <SelectItem value="standard">Standard (1-2 pages)</SelectItem>
                  <SelectItem value="detailed">Detailed (2+ pages)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="focusAreas"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                Focus Areas (optional)
              </label>
              <Input
                id="focusAreas"
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="leadership, technical, etc."
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated areas to emphasize
              </p>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              (inputMethod === 'text' ? !job_posting.trim() : !job_posting_url.trim())
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
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-destructive text-sm">!</span>
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
                    <h4 className="font-medium text-foreground mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.jobAnalysis.requiredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-1 bg-accent/20 text-foreground text-xs rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">Key Qualifications</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {result.jobAnalysis.qualifications.map((qual) => (
                        <li key={qual}>{qual}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">Culture Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.jobAnalysis.cultureKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="px-2 py-1 bg-success/10 text-foreground text-xs rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">Recommended Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.jobAnalysis.recommendedKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="px-2 py-1 bg-accent/10 text-foreground text-xs rounded-full"
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
              <p className="text-sm text-muted-foreground">
                Generated on {new Date(result.metadata.generatedAt).toLocaleString()} •{' '}
                {result.metadata.format} format • {result.metadata.targetLength} length
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
                  {result.customizedResume}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

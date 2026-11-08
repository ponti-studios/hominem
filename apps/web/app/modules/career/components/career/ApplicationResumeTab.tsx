import { Button } from '@ponti-studios/ui/primitives';
import { AlertCircle, CheckCircle, Copy, Download, FileText, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import {
  Chip,
  DetailSection,
  FormGrid,
  PanelState,
  SelectField,
  TextInput,
} from '~/components/design';
import type {
  CustomizeResumeApiRequest,
  CustomizeResumeApiResponse,
  JobAnalysis,
} from '~/modules/career/lib/api-contracts';
import { careerApiUrl } from '~/modules/career/lib/api-url';
import type { CareerApplicationRecord } from '~/modules/career/lib/types/records';
import { getCompanyName } from '~/modules/career/lib/utils/applicationUtils';

const RESUME_FORMATS = ['professional', 'modern', 'technical', 'executive'] as const;
const TARGET_LENGTHS = ['concise', 'standard', 'detailed'] as const;
type ResumeFormat = (typeof RESUME_FORMATS)[number];
type TargetLength = (typeof TARGET_LENGTHS)[number];

// Select hands back a plain string; keep the current choice if it is ever not one we offer.
function parseResumeFormat(value: string | null): ResumeFormat {
  return RESUME_FORMATS.find((format) => format === value) ?? 'professional';
}

function parseTargetLength(value: string | null): TargetLength {
  return TARGET_LENGTHS.find((length) => length === value) ?? 'standard';
}

interface ApplicationResumeTabProps {
  application: CareerApplicationRecord;
  applicationId: string;
}

function toFilenamePart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'resume'
  );
}

function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function ApplicationResumeTab({
  application,
  applicationId: _applicationId,
}: ApplicationResumeTabProps) {
  const fetcher = useFetcher();

  const [resumeFormat, setResumeFormat] = useState<ResumeFormat>('professional');
  const [targetLength, setTargetLength] = useState<TargetLength>('standard');
  const [focusAreas, setFocusAreas] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResume, setGeneratedResume] = useState<string | null>(null);
  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  // The posting text is pushed by the user's own agent (career_application_create/update);
  // Hominem never fetches job sites itself.
  const postingText = application.postingText?.trim() ?? '';
  const hasAnyPosting = postingText.length > 0;
  const resumeFilename = `${toFilenamePart(getCompanyName(application.company))}-${toFilenamePart(
    application.title,
  )}-resume.md`;

  const isSaving = fetcher.state !== 'idle';
  const saveSuccess =
    typeof fetcher.data === 'object' &&
    fetcher.data !== null &&
    'message' in fetcher.data &&
    fetcher.data.message === 'Resume saved successfully';

  async function handleGenerate() {
    if (!hasAnyPosting) {
      setError('This application has no saved job posting text to generate a resume from.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const request: CustomizeResumeApiRequest = {
        resumeFormat,
        targetLength,
        focusAreas: focusAreas
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        job_posting: postingText,
      };
      const response = await fetch(careerApiUrl('/api/career/resume/customize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });
      const data: CustomizeResumeApiResponse = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Generation failed');
      }
      setGeneratedResume(data.customizedResume);
      setJobAnalysis(data.jobAnalysis);
      setShowRegenerate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSave() {
    if (!generatedResume) return;
    const formData = new FormData();
    formData.set('operation', 'save_resume');
    formData.set('resume', generatedResume);
    fetcher.submit(formData, { method: 'POST' });
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  function handleDownload(text: string) {
    downloadMarkdown(resumeFilename, text);
  }

  // A saved resume stays viewable without posting text; only (re)generating needs it.
  if (!hasAnyPosting && !application.resumeUrl) {
    return (
      <PanelState
        title="No job description saved"
        description="Ask your AI agent to save the posting text to this application, then come back to generate a tailored resume."
        icon={<FileText className="size-5" aria-hidden />}
      />
    );
  }

  const showGenerateForm =
    hasAnyPosting && (!application.resumeUrl || showRegenerate || generatedResume);

  return (
    <div className="flex flex-col gap-4">
      {application.resumeUrl && !showRegenerate && !generatedResume && (
        <DetailSection title="Saved Resume">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleCopy(application.resumeUrl!)}>
                <Copy className="size-4 mr-1" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(application.resumeUrl!)}
              >
                <Download className="size-4 mr-1" />
                Download
              </Button>
              {hasAnyPosting && (
                <Button variant="outline" size="sm" onClick={() => setShowRegenerate(true)}>
                  <Sparkles className="size-4 mr-1" />
                  Regenerate
                </Button>
              )}
            </div>
          </div>
          <pre className="max-h-64 overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap text-[#9ba3b4]">
            {application.resumeUrl.slice(0, 800)}
            {application.resumeUrl.length > 800 ? '\n\n…' : ''}
          </pre>
        </DetailSection>
      )}

      {showGenerateForm && (
        <DetailSection
          title={application.resumeUrl ? 'Regenerate Resume' : 'Generate Tailored Resume'}
        >
          <div className="flex flex-col gap-4">
            <FormGrid>
              <SelectField
                label="Format"
                name="resumeFormat"
                value={resumeFormat}
                onChange={(v) => setResumeFormat(parseResumeFormat(v))}
                options={RESUME_FORMATS.map((format) => ({
                  value: format,
                  label: format[0]!.toUpperCase() + format.slice(1),
                }))}
              />
              <SelectField
                label="Length"
                name="targetLength"
                value={targetLength}
                onChange={(v) => setTargetLength(parseTargetLength(v))}
                options={TARGET_LENGTHS.map((length) => ({
                  value: length,
                  label: length[0]!.toUpperCase() + length.slice(1),
                }))}
              />
            </FormGrid>

            <TextInput
              label="Focus Areas"
              hint="Optional, comma-separated"
              name="focusAreas"
              placeholder="e.g. leadership, TypeScript, distributed systems"
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
            />

            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-[#ff9d9d]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                isLoading={isGenerating}
                loadingLabel="Generating..."
                className="flex-1"
              >
                <Sparkles className="size-4 mr-2" />
                Generate Resume
              </Button>
              {showRegenerate && (
                <Button variant="outline" onClick={() => setShowRegenerate(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </DetailSection>
      )}

      {generatedResume && (
        <DetailSection title="Generated Resume">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleCopy(generatedResume)}>
                <Copy className="size-4 mr-1" />
                {copySuccess ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDownload(generatedResume)}>
                <Download className="size-4 mr-1" />
                Download
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                isLoading={isSaving}
                loadingLabel="Saving..."
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle className="size-4 mr-1" />
                    Saved
                  </>
                ) : (
                  'Save to Application'
                )}
              </Button>
            </div>
          </div>
          {jobAnalysis && (
            <div className="mb-4 grid grid-cols-1 gap-4 rounded-xl bg-white/[0.03] p-3 sm:grid-cols-2">
              {jobAnalysis.requiredSkills.length > 0 && (
                <div>
                  <p className="mb-1 text-[13px] font-medium text-[#f2f4f8]">Matched Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {jobAnalysis.requiredSkills.map((skill) => (
                      <Chip key={skill} tone="volt">
                        {skill}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {jobAnalysis.recommendedKeywords.length > 0 && (
                <div>
                  <p className="mb-1 text-[13px] font-medium text-[#f2f4f8]">ATS Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {jobAnalysis.recommendedKeywords.slice(0, 6).map((kw) => (
                      <Chip key={kw}>{kw}</Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <pre className="max-h-[32rem] overflow-y-auto rounded-xl border border-white/10 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-[#f2f4f8]">
            {generatedResume}
          </pre>
        </DetailSection>
      )}
    </div>
  );
}

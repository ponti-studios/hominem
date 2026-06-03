import { Alert, AlertDescription, AlertTitle } from '@hominem/ui';
import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { FileText, LogIn, RefreshCw, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AIProcessingAnimation, type ResumeUploadStep } from './AIProcessingAnimation';
import type { ResumeConvertStage, UploadResumeResponse } from '../types/resume';

interface UploadResumeFormProps {
  onUploadStart: () => void;
  onUploadComplete: (response: UploadResumeResponse) => void;
  onUploadError?: (error: string) => void;
}

type UploadStatus = 'idle' | 'pending' | 'error';

const stageToStep: Partial<Record<ResumeConvertStage, ResumeUploadStep>> = {
  request: 'uploading',
  'file-validation': 'uploading',
  'pdf-extraction': 'extracting',
  'ai-parse': 'analyzing',
  'schema-validation': 'analyzing',
  storage: 'saving',
  database: 'saving',
};

const estimatedSteps: ResumeUploadStep[] = ['uploading', 'extracting', 'analyzing', 'saving'];

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

async function readUploadResponse(response: Response): Promise<UploadResumeResponse> {
  try {
    return (await response.json()) as UploadResumeResponse;
  } catch {
    return {
      error: response.ok
        ? 'Upload succeeded but the response was unreadable. Refresh your account page to check your portfolio.'
        : 'Server returned an unreadable error response. Try again.',
      stage: 'request',
      retryable: true,
    };
  }
}

export function UploadResumeForm({
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UploadResumeFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [activeStep, setActiveStep] = useState<ResumeUploadStep>('uploading');
  const [error, setError] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<ResumeConvertStage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== 'pending') return;

    let stepIndex = 0;
    setActiveStep(estimatedSteps[stepIndex]);
    const interval = window.setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, estimatedSteps.length - 1);
      setActiveStep(estimatedSteps[stepIndex]);
    }, 1600);

    return () => window.clearInterval(interval);
  }, [status]);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      setSelectedFile(droppedFiles[0]);
      setNotice(droppedFiles.length > 1 ? 'Only the first PDF was selected.' : null);
      setError(null);
      setRequiresLogin(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setNotice(null);
    setError(null);
    setRequiresLogin(false);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setError(null);
    setErrorStage(null);
    setNotice(null);
    setRequiresLogin(false);
    setStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelUpload = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus('idle');
    setError('Upload canceled.');
    setErrorStage(null);
    setRequiresLogin(false);
  };

  const uploadResume = async () => {
    setError(null);
    setErrorStage(null);
    setRequiresLogin(false);
    if (!selectedFile) {
      const msg = 'Please select a PDF file';
      setError(msg);
      setStatus('error');
      onUploadError?.(msg);
      return;
    }
    if (!isPdfFile(selectedFile)) {
      const msg = 'Please select a PDF file';
      setError(msg);
      setStatus('error');
      onUploadError?.(msg);
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      const msg = 'File size must be less than 10MB';
      setError(msg);
      setStatus('error');
      onUploadError?.(msg);
      return;
    }

    setStatus('pending');
    onUploadStart();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      const res = await fetch('/api/resume/convert', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
        signal: abortController.signal,
      });
      const result = await readUploadResponse(res);
      abortControllerRef.current = null;

      if (!res.ok) {
        const msg = result.error ?? 'Conversion failed';
        setStatus('error');
        setError(msg);
        setErrorStage(result.stage ?? null);
        setRequiresLogin(res.status === 401 || res.status === 403 || result.stage === 'auth');
        if (result.stage) setActiveStep(stageToStep[result.stage] ?? 'uploading');
        onUploadError?.(msg);
        return;
      }

      if (!result.data) {
        const msg = result.error ?? 'Upload completed, but the response did not include resume data.';
        setStatus('error');
        setError(msg);
        setErrorStage(result.stage ?? 'request');
        onUploadError?.(msg);
        return;
      }

      setActiveStep('saving');
      onUploadComplete(result);
    } catch (uploadError) {
      abortControllerRef.current = null;
      if (uploadError instanceof DOMException && uploadError.name === 'AbortError') return;

      setStatus('error');
      const msg = 'Upload failed';
      setError(msg);
      setErrorStage('request');
      onUploadError?.(msg);
    }
  };

  const isPending = status === 'pending';
  const buttonLabel = status === 'error' && selectedFile ? 'Try Again' : 'Upload Resume';

  return (
    <div className="w-full max-w-md">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">Upload your resume</h1>
        <p className="text-xs text-muted-foreground">
          We'll extract your information and build your portfolio automatically.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div
            className={`rounded-md border-2 border-dashed p-6 text-center transition-colors ${
              isDragging ? 'border-accent/50 bg-accent/10' : 'border-border hover:border-muted-foreground/30'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-3">
              <FileText className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-foreground">
                  Drop your resume here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending}
                    className="text-primary underline"
                  >
                    browse
                  </button>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">PDF only · max 10MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                disabled={isPending}
                className="hidden"
              />

              {selectedFile && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}

          {isPending ? <AIProcessingAnimation activeStep={activeStep} /> : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  <p>{error}</p>
                  {errorStage ? (
                    <p className="text-xs">Failed during {errorStage.replaceAll('-', ' ')}.</p>
                  ) : null}
                  {requiresLogin ? (
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href="/login?next=/onboarding">
                        <LogIn className="size-4" />
                        Sign in
                      </a>
                    </Button>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Button
              type="button"
              onClick={uploadResume}
              disabled={isPending}
              variant="primary"
              fullWidth
            >
              {status === 'error' ? <RefreshCw className="size-4" /> : <Upload className="size-4" />}
              {isPending ? 'Processing…' : buttonLabel}
            </Button>
            {isPending ? (
              <Button type="button" onClick={cancelUpload} variant="outline" fullWidth>
                <X className="size-4" />
                Cancel
              </Button>
            ) : null}
            {selectedFile && !isPending ? (
              <Button type="button" onClick={clearSelectedFile} variant="ghost" fullWidth>
                Use a different PDF
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

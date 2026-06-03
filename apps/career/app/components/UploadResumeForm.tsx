import { Alert, AlertDescription, AlertTitle } from '@hominem/ui';
import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { FileText, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import type { ConvertedResumeData, UploadResumeResponse } from '../types/resume';

interface UploadResumeFormProps {
  onUploadStart: () => void;
  onUploadComplete: (data: ConvertedResumeData) => void;
  onUploadError?: (error: string) => void;
}

export function UploadResumeForm({
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UploadResumeFormProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) setFiles(droppedFiles);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(event.target.files);
  };

  const uploadResume = async () => {
    setError(null);
    if (!files || files.length === 0) {
      const msg = 'Please select a PDF file';
      setError(msg);
      onUploadError?.(msg);
      return;
    }
    const file = files[0];
    if (file.type !== 'application/pdf') {
      const msg = 'Please select a PDF file';
      setError(msg);
      onUploadError?.(msg);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'File size must be less than 10MB';
      setError(msg);
      onUploadError?.(msg);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    onUploadStart();

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + Math.random() * 10 : prev));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await fetch('/api/resume/convert', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      const result = (await res.json()) as UploadResumeResponse;

      clearInterval(progressInterval);
      setUploadProgress(100);
      setIsUploading(false);

      if (!res.ok) {
        let msg = result.error ?? 'Conversion failed';
        if (res.status === 401 || res.status === 403) msg = 'Please log in to upload your resume';
        setError(msg);
        onUploadError?.(msg);
        return;
      }
      onUploadComplete(result.data!);
    } catch {
      clearInterval(progressInterval);
      setIsUploading(false);
      const msg = 'Upload failed';
      setError(msg);
      onUploadError?.(msg);
    }
  };

  const selectedFile = files?.[0];

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

          {isUploading && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Uploading…</span>
                <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted">
                <div
                  className="h-1 rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            onClick={uploadResume}
            disabled={!selectedFile || isUploading}
            variant="primary"
            fullWidth
          >
            <Upload className="size-4" />
            {isUploading ? 'Uploading…' : 'Upload Resume'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

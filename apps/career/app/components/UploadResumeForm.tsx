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

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      setFiles(droppedFiles);
    }
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

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev < 90) {
          return prev + Math.random() * 10;
        }
        return prev;
      });
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

      if (!res.ok || !result.success) {
        let msg = result.success ? 'Conversion failed' : result.error;

        // Handle authentication errors specifically
        if (res.status === 401 || res.status === 403) {
          msg = 'Please log in to upload your resume';
        }

        setError(msg);
        onUploadError?.(msg);
        return;
      }
      onUploadComplete(result.data);
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
    <div className="max-w-2xl mx-auto px-6">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-sans text-3xl font-light text-foreground mb-4">Upload Your Resume</h1>
        <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
          Upload your existing resume to get started. We'll extract your information and help you
          create a beautiful portfolio.
        </p>
      </div>

      {/* Upload Area */}
      <Card className="mb-8 border-border bg-card">
        <CardContent className="p-8">
          <div
            className={`rounded-md border-2 border-dashed p-8 text-center transition-colors ${
              isDragging ? 'border-accent/50 bg-accent/10' : 'border-border hover:border-border'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-2">
                Drop your resume here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary hover:text-primary underline"
                >
                  browse
                </button>
              </h3>
              <p className="text-sm text-muted-foreground mb-6">PDF files only, up to 10MB</p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile && (
                <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Uploading...</span>
                <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {/* Upload Button */}
          <div className="mt-8 flex justify-center">
            <Button
              type="button"
              onClick={uploadResume}
              disabled={!selectedFile || isUploading}
              size="lg"
            >
              {isUploading ? 'Uploading...' : 'Upload Resume'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { FileText, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ConvertedResumeData, UploadResumeResponse } from '../types/resume'
import { ErrorMessage } from './ui/ErrorMessage'

interface UploadResumeFormProps {
  onUploadStart: () => void
  onUploadComplete: (data: ConvertedResumeData) => void
  onUploadError?: (error: string) => void
}

export function UploadResumeForm({
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UploadResumeFormProps) {
  const [files, setFiles] = useState<FileList | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const droppedFiles = event.dataTransfer?.files
    if (droppedFiles && droppedFiles.length > 0) {
      setFiles(droppedFiles)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(event.target.files)
  }

  const uploadResume = async () => {
    setError(null)
    if (!files || files.length === 0) {
      const msg = 'Please select a PDF file'
      setError(msg)
      onUploadError?.(msg)
      return
    }
    const file = files[0]
    if (file.type !== 'application/pdf') {
      const msg = 'Please select a PDF file'
      setError(msg)
      onUploadError?.(msg)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'File size must be less than 10MB'
      setError(msg)
      onUploadError?.(msg)
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    onUploadStart()

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev < 90) {
          return prev + Math.random() * 10
        }
        return prev
      })
    }, 200)

    try {
      const formData = new FormData()
      formData.append('pdf', file)
      const res = await fetch('/api/resume/convert', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      })
      const result = (await res.json()) as UploadResumeResponse

      clearInterval(progressInterval)
      setUploadProgress(100)
      setIsUploading(false)

      if (!res.ok || !result.success) {
        let msg = result.success ? 'Conversion failed' : result.error

        // Handle authentication errors specifically
        if (res.status === 401 || res.status === 403) {
          msg = 'Please log in to upload your resume'
        }

        setError(msg)
        onUploadError?.(msg)
        return
      }
      onUploadComplete(result.data)
    } catch {
      clearInterval(progressInterval)
      setIsUploading(false)
      const msg = 'Upload failed'
      setError(msg)
      onUploadError?.(msg)
    }
  }

  const selectedFile = files?.[0]

  return (
    <div className="max-w-2xl mx-auto px-6">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Upload className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="font-serif text-3xl font-light text-gray-900 mb-4">Upload Your Resume</h1>
        <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
          Upload your existing resume to get started. We'll extract your information and help you
          create a beautiful portfolio.
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center">
            <FileText className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">
              Drop your resume here, or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                browse
              </button>
            </h3>
            <p className="text-sm text-gray-500 mb-6">PDF files only, up to 10MB</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile && (
              <div className="flex items-center gap-3 p-3 rounded-lg">
                <FileText className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
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
              <span className="text-sm font-medium text-gray-900">Uploading...</span>
              <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && <ErrorMessage message={error} />}

        {/* Upload Button */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={uploadResume}
            disabled={!selectedFile || isUploading}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Upload Resume'}
          </button>
        </div>
      </div>
    </div>
  )
}

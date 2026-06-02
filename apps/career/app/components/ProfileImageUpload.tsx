import { Edit, ImageIcon, Upload, User, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '~/components/ui/button'

interface ProfileImageUploadProps {
  currentImageUrl?: string | null | undefined
  onImageUploaded: (imageUrl: string) => void
  onError?: (error: string) => void
}

const ASPECT_RATIO = 1 // Square crop
const MIN_DIMENSION = 150

export function ProfileImageUpload({
  currentImageUrl,
  onImageUploaded,
  onError,
}: ProfileImageUploadProps) {
  const [imgSrc, setImgSrc] = useState<string>(currentImageUrl || '')
  const [crop, setCrop] = useState<Crop>()
  const [isUploading, setIsUploading] = useState(false)
  const [showCropper, setShowCropper] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showUploadZone, setShowUploadZone] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const droppedFiles = event.dataTransfer?.files
    if (droppedFiles && droppedFiles.length > 0) {
      processFile(droppedFiles[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0])
    }
  }

  const processFile = (file: File) => {
    // Validate file
    if (!file.type.startsWith('image/')) {
      onError?.('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      onError?.('Image must be less than 5MB')
      return
    }

    setSelectedFile(file)
    setCrop(undefined) // Makes crop preview update between images.
    const reader = new FileReader()
    reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''))
    reader.readAsDataURL(file)
    setShowCropper(true)
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, ASPECT_RATIO))
  }

  const generateCroppedImage = useCallback(async () => {
    const image = imgRef.current
    const currentCrop = crop

    if (!image || !currentCrop || !currentCrop.width || !currentCrop.height) {
      throw new Error('Image or crop data is missing')
    }

    // Calculate the scale factors between the displayed image and natural image size
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    // Calculate crop dimensions in natural image pixels
    const cropX = currentCrop.x * scaleX
    const cropY = currentCrop.y * scaleY
    const cropWidth = currentCrop.width * scaleX
    const cropHeight = currentCrop.height * scaleY

    // Create canvas for cropping
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Unable to get canvas context')
    }

    // Set canvas dimensions to crop size
    canvas.width = cropWidth
    canvas.height = cropHeight

    // Draw the cropped portion of the image
    ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

    // Convert canvas to blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob from canvas'))
          }
        },
        'image/jpeg',
        0.8
      )
    })
  }, [crop])

  const handleUpload = async () => {
    if (!crop) return

    try {
      setIsUploading(true)

      // Generate cropped image blob
      const croppedImageBlob = await generateCroppedImage()

      // Create form data
      const formData = new FormData()
      formData.append('image', croppedImageBlob, 'profile-image.jpg')
      formData.append('action', 'upload-profile-image')

      // Upload to server
      const response = await fetch('/account', {
        method: 'POST',
        body: formData,
      })

      const result = (await response.json()) as {
        success: boolean
        error?: string
        data?: { imageUrl: string }
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed')
      }

      // Success - only call if we have a valid URL
      const imageUrl = result.data?.imageUrl
      if (imageUrl) {
        onImageUploaded(imageUrl)
        setShowCropper(false)
        setImgSrc('')
        setSelectedFile(null)
        setShowUploadZone(false)
      } else {
        throw new Error('No image URL returned from server')
      }
    } catch (error) {
      console.error('Upload error:', error)
      onError?.(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    setShowCropper(false)
    setImgSrc('')
    setCrop(undefined)
    setSelectedFile(null)
    setShowUploadZone(false)
  }

  if (showCropper) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col p-6">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-lg font-semibold">Crop Profile Image</h3>
            <Button type="button" onClick={handleCancel} variant="ghost" size="sm" className="p-1">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="mb-6 flex-1 flex items-center justify-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCrop(c)}
              aspect={ASPECT_RATIO}
              minWidth={MIN_DIMENSION}
              minHeight={MIN_DIMENSION}
              circularCrop
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={imgSrc}
                style={{
                  transform: 'scale(1) rotate(0deg)',
                  maxHeight: '60vh',
                  maxWidth: '100%',
                  height: 'auto',
                  width: 'auto',
                }}
                onLoad={onImageLoad}
                className="block"
              />
            </ReactCrop>
          </div>

          <div className="flex justify-end space-x-3 shrink-0">
            <Button type="button" onClick={handleCancel} disabled={isUploading} variant="outline">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || !crop}
              variant="primary"
              className="flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Current Profile Image */}
      <div className="flex items-center mb-4">
        <Button
          type="button"
          onClick={() => setShowUploadZone(!showUploadZone)}
          variant="ghost"
          className="relative group p-0"
        >
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg mr-4 group-hover:shadow-xl transition-shadow">
            {currentImageUrl &&
            typeof currentImageUrl === 'string' &&
            currentImageUrl.trim() !== '' ? (
              <img src={currentImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-1 shadow-lg transition-colors">
            <Edit className="w-3 h-3" />
          </div>
        </Button>
      </div>

      {/* Upload Area - Animated */}
      <div
        className={`bg-white rounded-lg border border-gray-200 transition-all duration-300 ease-in-out overflow-hidden ${
          showUploadZone ? 'max-h-96 opacity-100 p-4' : 'max-h-0 opacity-0 p-0 border-opacity-0'
        }`}
      >
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center">
            <ImageIcon className="w-8 h-8 text-gray-400 mb-3" />
            <h3 className="font-medium text-gray-900 mb-1">
              Drop your image here, or{' '}
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 underline p-0 h-auto"
              >
                browse
              </Button>
            </h3>
            <p className="text-sm text-gray-500 mb-4">JPG, PNG, GIF up to 5MB</p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile && (
              <div className="flex items-center gap-3 p-3 rounded-lg">
                <ImageIcon className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}

            {showUploadZone && (
              <Button
                type="button"
                onClick={() => setShowUploadZone(false)}
                variant="ghost"
                className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline p-0 h-auto"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to create aspect crop
function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

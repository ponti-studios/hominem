import { Button } from '@hominem/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@hominem/ui/dialog';
import { LoadingSpinner } from '@hominem/ui/loading-spinner';
import { Upload, User } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import 'react-image-crop/dist/ReactCrop.css';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';

import { cn } from '~/lib/utils';
interface ProfileImageUploadProps {
  currentImageUrl?: string | null | undefined;
  onImageUploaded: (image_url: string) => void;
  onError?: (error: string) => void;
  compact?: boolean;
}

const ASPECT_RATIO = 1; // Square crop
const MIN_DIMENSION = 150;

export function ProfileImageUpload({
  currentImageUrl,
  onImageUploaded,
  onError,
  compact = false,
}: ProfileImageUploadProps) {
  const [imgSrc, setImgSrc] = useState<string>(currentImageUrl || '');
  const [crop, setCrop] = useState<Crop>();
  const [isUploading, setIsUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
      e.currentTarget.value = '';
    }
  };

  const processFile = (file: File) => {
    // Validate file
    if (!file.type.startsWith('image/')) {
      onError?.('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      onError?.('Image must be less than 5MB');
      return;
    }

    setCrop(undefined); // Makes crop preview update between images.
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImgSrc(reader.result?.toString() || '');
      setShowCropper(true);
    });
    reader.readAsDataURL(file);
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, ASPECT_RATIO));
  }

  const generateCroppedImage = useCallback(async () => {
    const image = imgRef.current;
    const currentCrop = crop;

    if (!image || !currentCrop || !currentCrop.width || !currentCrop.height) {
      throw new Error('Image or crop data is missing');
    }

    // Calculate the scale factors between the displayed image and natural image size
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Calculate crop dimensions in natural image pixels
    const cropX = currentCrop.x * scaleX;
    const cropY = currentCrop.y * scaleY;
    const cropWidth = currentCrop.width * scaleX;
    const cropHeight = currentCrop.height * scaleY;

    // Create canvas for cropping
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Unable to get canvas context');
    }

    // Set canvas dimensions to crop size
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw the cropped portion of the image
    ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    // Convert canvas to blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        'image/jpeg',
        0.8,
      );
    });
  }, [crop]);

  const handleUpload = async () => {
    if (!crop) return;

    try {
      setIsUploading(true);

      // Generate cropped image blob
      const croppedImageBlob = await generateCroppedImage();

      // Create form data
      const formData = new FormData();
      formData.append('image', croppedImageBlob, 'profile-image.jpg');
      formData.append('action', 'upload-profile-image');

      // Upload to server
      const response = await fetch('/account', {
        method: 'POST',
        body: formData,
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { image_url: string };
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Success - only call if we have a valid URL
      const image_url = result.data?.image_url;
      if (image_url) {
        onImageUploaded(image_url);
        setShowCropper(false);
        setImgSrc('');
      } else {
        throw new Error('No image URL returned from server');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onError?.(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setShowCropper(false);
    setImgSrc('');
    setCrop(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (showCropper) {
    return (
      <Dialog open={showCropper} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden border-border bg-card">
          <DialogHeader>
            <DialogTitle>Crop Profile Image</DialogTitle>
          </DialogHeader>

          <div className="mb-6 flex flex-1 items-center justify-center overflow-auto">
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

          <div className="flex shrink-0 justify-end gap-3">
            <Button type="button" onClick={handleCancel} disabled={isUploading} variant="outline">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || !crop}
              className="flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <LoadingSpinner variant="sm" />
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
        </DialogContent>
      </Dialog>
    );
  }

  const avatarSizeClass = compact ? 'size-12' : 'size-16';
  const avatarBorderClass = compact ? 'border-2' : 'border-4';
  const avatarIconClass = compact ? 'w-5 h-5' : 'w-6 h-6';

  return (
    <div className="w-full">
      {/* Current Profile Image */}
      <div className={compact ? 'mb-3 flex items-center' : 'mb-4 flex items-center'}>
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          variant="ghost"
          className="group p-0"
          aria-label="Upload profile image"
        >
          <div className="mr-4 flex shrink-0 items-center justify-center">
            <div
              className={cn(
                'flex items-center justify-center overflow-hidden rounded-full border border-border bg-muted',
                avatarSizeClass,
                avatarBorderClass,
              )}
            >
              {currentImageUrl &&
              typeof currentImageUrl === 'string' &&
              currentImageUrl.trim() !== '' ? (
                <img src={currentImageUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className={cn('text-muted-foreground', avatarIconClass)} />
              )}
            </div>
          </div>
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
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
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

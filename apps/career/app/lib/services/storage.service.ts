import type { SupabaseClient } from '@supabase/supabase-js'

export interface UploadFileOptions {
  file: File
  userId: string
  folder: 'resumes' | 'profile-images' | 'documents'
  bucketName?: string
  upsert?: boolean
  cacheControl?: string
}

export interface UploadFileResult {
  success: boolean
  filePath?: string
  publicUrl?: string
  error?: string
}

/**
 * Centralized file upload helper to ensure consistent folder structure
 * and prevent developers from uploading to wrong folders
 */
export async function uploadFile(
  supabase: SupabaseClient,
  options: UploadFileOptions
): Promise<UploadFileResult> {
  const {
    file,
    userId,
    folder,
    bucketName = 'craftd',
    upsert = true,
    cacheControl = '3600',
  } = options

  try {
    // Generate unique filename with timestamp to prevent conflicts
    const timestamp = Date.now()
    const fileExtension = getFileExtension(file)
    const sanitizedOriginalName = sanitizeFileName(file.name)

    let fileName: string
    switch (folder) {
      case 'resumes':
        fileName = `resume-${timestamp}-${sanitizedOriginalName}`
        break
      case 'profile-images':
        fileName = `profile-${timestamp}.${fileExtension}`
        break
      case 'documents':
        fileName = `doc-${timestamp}-${sanitizedOriginalName}`
        break
      default:
        fileName = `file-${timestamp}-${sanitizedOriginalName}`
    }

    const filePath = `public/${userId}/${folder}/${fileName}`

    console.log(`Uploading ${folder} file to ${bucketName}/${filePath}`)

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, {
      cacheControl,
      upsert,
    })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`,
      }
    }

    // Get public URL using the same bucket we uploaded to
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath)

    return {
      success: true,
      filePath,
      publicUrl: urlData.publicUrl,
    }
  } catch (error) {
    console.error('File upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    }
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(
  supabase: SupabaseClient,
  filePath: string,
  bucketName = 'craftd'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage.from(bucketName).remove([filePath])

    if (error) {
      console.error('File deletion error:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    return { success: true }
  } catch (error) {
    console.error('File deletion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown deletion error',
    }
  }
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  options: {
    maxSizeBytes: number
    allowedTypes: readonly string[]
  }
): { valid: boolean; error?: string } {
  if (file.size > options.maxSizeBytes) {
    const maxSizeMB = options.maxSizeBytes / (1024 * 1024)
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    }
  }

  if (!options.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`,
    }
  }

  return { valid: true }
}

/**
 * Helper to get file extension from file
 */
function getFileExtension(file: File): string {
  if (file.type.startsWith('image/')) {
    return file.type.split('/')[1] || 'jpg'
  }

  const name = file.name
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.substring(lastDot + 1) : 'bin'
}

/**
 * Sanitize filename to prevent path traversal and special characters
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .toLowerCase()
}

/**
 * Predefined validation options for common file types
 */
export const FILE_VALIDATION_PRESETS = {
  PDF_RESUME: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf'],
  },
  PROFILE_IMAGE: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  DOCUMENT: {
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },
} as const

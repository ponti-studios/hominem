
import {
  performMobileUploads,
  resolveMobileUploadMimeType,
  type MobileUploadAsset,
} from '../../lib/services/files/use-file-upload'

describe('mobile file upload helper', () => {
  it('derives a mime type from file extension when the picker does not provide one', () => {
    expect(resolveMobileUploadMimeType({
      assetId: 'asset-1',
      fileName: 'receipt.png',
      mimeType: null,
      type: 'image',
      uri: 'file:///tmp/receipt.png',
    })).toBe('image/png')
  })

  it('uploads through one canonical upload request', async () => {
    const upload = jest.fn(async (formData: FormData) => {
      expect(formData.get('originalName')).toBe('receipt.png')
      expect(formData.get('mimetype')).toBe('image/png')
      expect(formData.get('file')).toBeInstanceOf(File)

      return {
        success: true,
        file: {
          id: 'file-1',
          originalName: 'receipt.png',
          type: 'image' as const,
          mimetype: 'image/png',
          size: 4,
          url: 'https://cdn.example.com/receipt.png',
          uploadedAt: '2026-01-01T00:00:00.000Z',
        },
      }
    })
    const fetchImpl: typeof fetch = jest.fn(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url === 'file:///tmp/receipt.png') {
        return new Response(new Blob(['data'], { type: 'image/png' }))
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    }) as typeof fetch

    const asset: MobileUploadAsset = {
      assetId: 'asset-1',
      fileName: 'receipt.png',
      mimeType: null,
      type: 'image',
      uri: 'file:///tmp/receipt.png',
    }

    const result = await performMobileUploads(
      {
        upload,
      },
      [asset],
      { fetchImpl },
    )

    expect(result.errors).toEqual([])
    expect(result.uploaded).toHaveLength(1)
    expect(result.uploaded[0]).toMatchObject({
      assetId: 'asset-1',
      localUri: 'file:///tmp/receipt.png',
      uploadedFile: {
        id: 'file-1',
        originalName: 'receipt.png',
        mimetype: 'image/png',
        url: 'https://cdn.example.com/receipt.png',
      },
    })
    expect(result.uploaded[0]?.uploadedFile.uploadedAt).toBeInstanceOf(Date)
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('collects errors for unsupported file types without aborting the batch', async () => {
    const result = await performMobileUploads(
      {
        upload: jest.fn(async () => ({
          success: true,
          file: {
            id: 'file-1',
            originalName: 'receipt.png',
            type: 'image' as const,
            mimetype: 'image/png',
            size: 4,
            url: 'https://cdn.example.com/receipt.png',
            uploadedAt: '2026-01-01T00:00:00.000Z',
          },
        })),
      },
      [
        {
          assetId: 'asset-1',
          fileName: 'script.exe',
          mimeType: 'application/x-msdownload',
          type: 'document',
          uri: 'file:///tmp/script.exe',
        },
      ],
      {
        fetchImpl: jest.fn() as typeof fetch,
      },
    )

    expect(result.uploaded).toEqual([])
    expect(result.errors).toEqual(['script.exe: Unsupported file type'])
  })
})

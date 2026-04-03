import React from 'react'
import { act, render, waitFor } from '@testing-library/react-native'

import {
  appendVoiceTranscript,
  exceedsAttachmentLimit,
  mapUploadedAssetsToAttachments,
  useComposerMediaActions,
} from '../../components/input/use-composer-media-actions'
import type { MobileComposerAttachment, MobileComposerMode } from '../../components/input/input-context'

const mockLaunchImageLibraryAsync = jest.fn()
const mockUploadAssets = jest.fn()
const mockClearErrors = jest.fn()

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}))

jest.mock('../../utils/services/files/use-file-upload', () => ({
  useFileUpload: () => ({
    uploadAssets: mockUploadAssets,
    clearErrors: mockClearErrors,
    uploadState: {
      errors: [],
      isUploading: false,
      progress: 0,
    },
  }),
}))

let attachments: MobileComposerAttachment[] = []
let message = ''
let mode: MobileComposerMode = 'text'
let isRecording = false
let hookRef: ReturnType<typeof useComposerMediaActions> | null = null

function Probe() {
  hookRef = useComposerMediaActions({
    attachments,
    setAttachments: (value) => {
      attachments = typeof value === 'function' ? value(attachments) : value
    },
    message,
    setMessage: (value) => {
      message = value
    },
    setIsRecording: (value) => {
      isRecording = value
    },
    setMode: (value) => {
      mode = value
    },
  })

  return null
}

describe('composer media actions', () => {
  beforeEach(() => {
    attachments = []
    message = ''
    mode = 'text'
    isRecording = false
    hookRef = null
    mockLaunchImageLibraryAsync.mockReset()
    mockUploadAssets.mockReset()
    mockClearErrors.mockReset()
  })

  it('maps uploaded assets into composer attachments', () => {
    expect(
      mapUploadedAssetsToAttachments([
        {
          localUri: 'file:///tmp/receipt.png',
          uploadedFile: {
            id: 'file-1',
            originalName: 'receipt.png',
            type: 'image',
            mimetype: 'image/png',
            size: 120,
            url: 'https://cdn.example.com/receipt.png',
            uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
      ]),
    ).toEqual([
      {
        id: 'file-1',
        localUri: 'file:///tmp/receipt.png',
        name: 'receipt.png',
        type: 'image',
        uploadedFile: {
          id: 'file-1',
          originalName: 'receipt.png',
          type: 'image',
          mimetype: 'image/png',
          size: 120,
          url: 'https://cdn.example.com/receipt.png',
          uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      },
    ])
  })

  it('formats transcript appends against existing draft text', () => {
    expect(appendVoiceTranscript('', 'captured idea')).toBe('captured idea')
    expect(appendVoiceTranscript('Existing draft', 'captured idea')).toBe(
      'Existing draft\ncaptured idea',
    )
  })

  it('normalizes picker assets through the shared hook', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          assetId: 'asset-1',
          fileName: 'receipt.png',
          mimeType: 'image/png',
          type: 'image',
          uri: 'file:///tmp/receipt.png',
        },
      ],
    })
    mockUploadAssets.mockResolvedValue([
      {
        localUri: 'file:///tmp/receipt.png',
        uploadedFile: {
          id: 'file-1',
          originalName: 'receipt.png',
          type: 'image',
          mimetype: 'image/png',
          size: 120,
          url: 'https://cdn.example.com/receipt.png',
          uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      },
    ])

    render(<Probe />)

    await act(async () => {
      await hookRef?.pickAttachment()
    })

    await waitFor(() => {
      expect(attachments).toEqual([
        {
          id: 'file-1',
          localUri: 'file:///tmp/receipt.png',
          name: 'receipt.png',
          type: 'image',
          uploadedFile: {
            id: 'file-1',
            originalName: 'receipt.png',
            type: 'image',
            mimetype: 'image/png',
            size: 120,
            url: 'https://cdn.example.com/receipt.png',
            uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
      ])
    })
  })

  it('appends camera captures and transcripts through the shared hook', async () => {
    message = 'Existing draft'
    mockUploadAssets.mockResolvedValue([
      {
        localUri: 'file:///tmp/photo.jpg',
        uploadedFile: {
          id: 'file-2',
          originalName: 'photo.jpg',
          type: 'image',
          mimetype: 'image/jpeg',
          size: 240,
          url: 'https://cdn.example.com/photo.jpg',
          uploadedAt: new Date('2026-01-01T00:00:01.000Z'),
        },
      },
    ])

    render(<Probe />)

    await act(async () => {
      await hookRef?.handleCameraCapture({
        uri: 'file:///tmp/photo.jpg',
        fileName: 'photo.jpg',
      })
    })

    act(() => {
      hookRef?.handleVoiceTranscript('captured idea')
    })

    expect(attachments).toHaveLength(1)
    expect(message).toBe('Existing draft\ncaptured idea')
    expect(isRecording).toBe(false)
    expect(mode).toBe('text')
  })

  it('enforces the upload count limit before upload work begins', () => {
    expect(exceedsAttachmentLimit(4, 1)).toBe(false)
    expect(exceedsAttachmentLimit(5, 1)).toBe(true)
  })
})

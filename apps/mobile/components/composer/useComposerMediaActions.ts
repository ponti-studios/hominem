import { classifyFileByMimeType } from '@hominem/rpc';
import type { UploadedFile } from '@hominem/ui/types/upload';
import { CHAT_UPLOAD_MAX_FILE_COUNT } from '@hominem/utils/upload';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { useFileUpload } from '~/services/files/use-file-upload';

import type {
  ComposerAttachment,
  ComposerMode,
} from './composerState';

interface UploadedMobileAsset {
  localUri: string;
  uploadedFile: UploadedFile;
}

interface UseComposerMediaActionsOptions {
  attachments: ComposerAttachment[];
  setAttachments: (
    value:
      | ComposerAttachment[]
      | ((currentValue: ComposerAttachment[]) => ComposerAttachment[]),
  ) => void;
  message: string;
  setMessage: (value: string) => void;
  setIsRecording: (value: boolean) => void;
  setMode: (value: ComposerMode) => void;
}

function getAttachmentType(uploadedFile: UploadedMobileAsset['uploadedFile']): string {
  if (uploadedFile.type !== 'unknown') {
    return uploadedFile.type;
  }

  return classifyFileByMimeType(uploadedFile.mimetype);
}

function mapUploadedAssetsToAttachments(
  assets: UploadedMobileAsset[],
): ComposerAttachment[] {
  return assets.map((asset) => ({
    id: asset.uploadedFile.id,
    name: asset.uploadedFile.originalName,
    type: getAttachmentType(asset.uploadedFile),
    localUri: asset.localUri,
    uploadedFile: asset.uploadedFile,
  }));
}

function appendVoiceTranscript(text: string, transcript: string): string {
  const trimmedTranscript = transcript.trim();

  if (trimmedTranscript.length === 0) {
    return text;
  }

  return text.trim().length > 0 ? `${text}\n${trimmedTranscript}` : trimmedTranscript;
}

function exceedsAttachmentLimit(existingCount: number, nextCount: number): boolean {
  return existingCount + nextCount > CHAT_UPLOAD_MAX_FILE_COUNT;
}

export function useComposerMediaActions({
  attachments,
  setAttachments,
  message,
  setMessage,
  setIsRecording,
  setMode,
}: UseComposerMediaActionsOptions) {
  const { uploadAssets, uploadState, clearErrors } = useFileUpload();

  const appendUploadedAssets = async (
    assets: Array<{
      assetId: string;
      fileName: string | null;
      mimeType: string | null;
      type: string | null;
      uri: string;
    }>,
  ) => {
    const uploadedAssets = await uploadAssets(assets);

    if (uploadedAssets.length === 0) {
      return [];
    }

    const nextAttachments = mapUploadedAssetsToAttachments(uploadedAssets);
    setAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);
    return nextAttachments;
  };

  const pickAttachment = async () => {
    clearErrors();

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: 'images',
      quality: 0.8,
    });

    if (result.canceled) {
      return [];
    }

    if (exceedsAttachmentLimit(attachments.length, result.assets.length)) {
      Alert.alert(`You can upload up to ${CHAT_UPLOAD_MAX_FILE_COUNT} files`);
      return [];
    }

    return appendUploadedAssets(
      result.assets.map((asset) => ({
        assetId: asset.assetId ?? asset.uri,
        fileName: asset.fileName ?? null,
        mimeType: asset.mimeType ?? null,
        type: asset.type ?? null,
        uri: asset.uri,
      })),
    );
  };

  const handleCameraCapture = async (photo: { uri: string; fileName?: string }) => {
    clearErrors();

    const fileName = photo.fileName ?? photo.uri.split('/').pop() ?? 'photo';
    const extension = fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
    
    const mimeTypeMap: Record<string, string> = {
      heic: 'image/heic',
      heif: 'image/heif',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };

    const mimeType = mimeTypeMap[extension] || 'image/jpeg';

    return appendUploadedAssets([
      {
        assetId: photo.uri,
        fileName: photo.fileName ?? null,
        mimeType,
        type: 'image',
        uri: photo.uri,
      },
    ]);
  };

  const handleVoiceTranscript = (transcript: string) => {
    setMessage(appendVoiceTranscript(message, transcript));
    setIsRecording(false);
    setMode('text');
  };

  return {
    uploadState,
    clearErrors,
    pickAttachment,
    handleCameraCapture,
    handleVoiceTranscript,
  };
}

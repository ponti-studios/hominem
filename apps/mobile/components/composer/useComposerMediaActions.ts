import { classifyFileByMimeType } from '@hominem/rpc';
import { UPLOAD_MAX_FILE_COUNT } from '@hominem/storage/constants';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { useFileUpload } from '~/services/files/use-file-upload';
import type { UploadedFile } from '~/types/upload';

import type { ComposerAttachment } from './composerState';

interface UploadedMobileAsset {
  localUri: string;
  uploadedFile: UploadedFile;
}

interface UseComposerMediaActionsOptions {
  attachments: ComposerAttachment[];
  setAttachments: (
    value: ComposerAttachment[] | ((currentValue: ComposerAttachment[]) => ComposerAttachment[]),
  ) => void;
}

function getAttachmentType(uploadedFile: UploadedMobileAsset['uploadedFile']): string {
  if (uploadedFile.type !== 'unknown') {
    return uploadedFile.type;
  }

  return classifyFileByMimeType(uploadedFile.mimetype);
}

function exceedsAttachmentLimit(existingCount: number, nextCount: number): boolean {
  return existingCount + nextCount > UPLOAD_MAX_FILE_COUNT;
}

export function useComposerMediaActions({
  attachments,
  setAttachments,
}: UseComposerMediaActionsOptions) {
  const { uploadAssets, uploadState, clearErrors } = useFileUpload();

  const appendUploadedAssets = async (
    assets: {
      assetId: string;
      fileName: string | null;
      mimeType: string | null;
      type: string | null;
      uri: string;
    }[],
  ) => {
    const uploadedAssets = await uploadAssets(assets);

    if (uploadedAssets.length === 0) {
      return [];
    }

    const nextAttachments = uploadedAssets.map((asset) => ({
      id: asset.uploadedFile.id,
      name: asset.uploadedFile.originalName,
      type: getAttachmentType(asset.uploadedFile),
      localUri: asset.localUri,
      uploadedFile: asset.uploadedFile,
    }));

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
      Alert.alert(`You can upload up to ${UPLOAD_MAX_FILE_COUNT} files`);
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

  return {
    uploadState,
    clearErrors,
    pickAttachment,
    handleCameraCapture,
  };
}

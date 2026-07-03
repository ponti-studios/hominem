import { CareerRepository, db } from '@hominem/db';
import { createStorageService, isStorageServiceError, validateFile } from '@hominem/storage';

import { parseFormData } from '~/lib/route-utils';

import type { AccountActionResult, AccountPageUser, BasicInfoFormValues } from './types';

const profileImageStorage = createStorageService('images', {
  maxFileSize: 5 * 1024 * 1024,
  isPublic: true,
});

const PROFILE_IMAGE_VALIDATION = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

type AccountActionHandler = (args: {
  formData: FormData;
  user: AccountPageUser;
}) => Promise<AccountActionResult<unknown>>;

const accountActionHandlers: Record<string, AccountActionHandler> = {
  delete: handleDeletePortfolioAction,
  'set-current-portfolio': handleSetCurrentPortfolioAction,
  'upload-profile-image': handleUploadProfileImageAction,
  'update-slug': handleUpdateSlugAction,
  'update-basics': handleUpdateBasicsAction,
};

function getProfileImageUploadErrorMessage(error: unknown): string {
  if (!isStorageServiceError(error)) {
    return error instanceof Error ? error.message : 'Failed to upload image';
  }

  switch (error.code) {
    case 'storage.config.missing':
      return 'Profile image storage is not configured yet.';
    case 'storage.credentials.invalid':
      return 'Profile image storage credentials were rejected.';
    case 'storage.bucket.access_denied':
      return 'Profile image storage access was denied.';
    case 'storage.bucket.missing':
      return 'Profile image storage bucket was not found.';
    case 'storage.network.unreachable':
      return 'Profile image storage is temporarily unreachable.';
    default:
      return 'Failed to upload image';
  }
}

export async function handleAccountAction({
  formData,
  user,
}: {
  formData: FormData;
  user: AccountPageUser;
}): Promise<AccountActionResult<unknown>> {
  const action = formData.get('action');

  if (typeof action !== 'string' || !action) {
    throw new Response('Invalid action', { status: 400 });
  }

  const handler = accountActionHandlers[action];

  if (!handler) {
    throw new Response('Invalid action', { status: 400 });
  }

  return handler({ formData, user });
}

async function handleDeletePortfolioAction({
  formData,
  user,
}: {
  formData: FormData;
  user: AccountPageUser;
}): Promise<AccountActionResult> {
  const portfolioId = formData.get('portfolio_id');

  if (typeof portfolioId !== 'string' || !portfolioId) {
    throw new Response('Portfolio ID is required', { status: 400 });
  }

  try {
    await CareerRepository.deletePortfolio(db, user.id, portfolioId);
    return { success: true, message: 'Portfolio deleted successfully' };
  } catch (error) {
    console.error('Failed to delete portfolio:', error);
    throw new Response('Failed to delete portfolio', { status: 500 });
  }
}

async function handleSetCurrentPortfolioAction({
  formData,
  user,
}: {
  formData: FormData;
  user: AccountPageUser;
}): Promise<AccountActionResult> {
  const portfolioId = formData.get('portfolio_id');

  if (typeof portfolioId !== 'string' || !portfolioId) {
    throw new Response('Portfolio ID is required', { status: 400 });
  }

  try {
    await CareerRepository.setCurrentPortfolioByUserId(db, user.id, portfolioId);
    return { success: true, message: 'Current portfolio updated successfully' };
  } catch (error) {
    console.error('Failed to update current portfolio:', error);
    throw new Response('Failed to update current portfolio', { status: 500 });
  }
}

async function handleUploadProfileImageAction({
  formData,
  user,
}: {
  formData: FormData;
  user: AccountPageUser;
}): Promise<AccountActionResult<{ image_url: string }>> {
  try {
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      throw new Response('No image file provided', { status: 400 });
    }

    const validation = validateFile(imageFile, PROFILE_IMAGE_VALIDATION);
    if (!validation.valid) {
      throw new Response(validation.error || 'Invalid file', { status: 400 });
    }

    let uploadResult: { id: string; url: string };

    try {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      uploadResult = await profileImageStorage.storeFile(buffer, imageFile.type, user.id, {
        originalName: imageFile.name,
      });
    } catch (uploadError) {
      throw new Response(getProfileImageUploadErrorMessage(uploadError), { status: 500 });
    }

    try {
      await CareerRepository.updatePortfolioProfileImage(db, user.id, uploadResult.url);
    } catch (updateError) {
      console.error('Database update error:', updateError);
      await profileImageStorage.deleteFile(uploadResult.id, user.id);
      throw new Response('Failed to update portfolio', { status: 500 });
    }

    return {
      success: true,
      message: 'Profile image updated successfully',
      data: { image_url: uploadResult.url },
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to upload profile image:', error);
    throw new Response('Failed to upload profile image', { status: 500 });
  }
}

async function handleUpdateSlugAction({
  formData,
  user,
}: {
  formData: FormData;
  user: AccountPageUser;
}): Promise<AccountActionResult<{ slug: string }>> {
  try {
    const newSlug = formData.get('slug');
    const portfolioId = formData.get('portfolio_id');

    if (
      typeof newSlug !== 'string' ||
      typeof portfolioId !== 'string' ||
      !newSlug ||
      !portfolioId
    ) {
      throw new Response('Slug and portfolio ID are required', { status: 400 });
    }

    if (!/^[a-z0-9-]+$/.test(newSlug)) {
      throw new Response('Slug can only contain lowercase letters, numbers, and hyphens', {
        status: 400,
      });
    }

    if (newSlug.length < 3) {
      throw new Response('Slug must be at least 3 characters long', { status: 400 });
    }

    if (newSlug.length > 50) {
      throw new Response('Slug must be less than 50 characters long', { status: 400 });
    }

    const isAvailable = await CareerRepository.isSlugAvailable(db, newSlug, portfolioId);

    if (!isAvailable) {
      throw new Response('Slug is already taken', { status: 400 });
    }

    await CareerRepository.updatePortfolioSlug(db, user.id, portfolioId, newSlug);

    return {
      success: true,
      message: 'Portfolio URL updated successfully',
      data: { slug: newSlug },
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to update portfolio URL:', error);
    throw new Response('Failed to update portfolio URL', { status: 500 });
  }
}

async function handleUpdateBasicsAction({
  formData,
  user,
}: {
  formData: FormData;
  user: AccountPageUser;
}): Promise<AccountActionResult> {
  const portfolioDataResult = parseFormData<BasicInfoFormValues>(formData, 'portfolioData');

  if ('success' in portfolioDataResult && !portfolioDataResult.success) {
    return { success: false, error: 'Your changes couldn’t be read. Refresh and try again.' };
  }

  const portfolioData = portfolioDataResult as BasicInfoFormValues;

  try {
    await CareerRepository.savePortfolioBasics(db, user.id, portfolioData);
    return { success: true, message: 'Portfolio basics updated successfully' };
  } catch (error) {
    console.error('Failed to update portfolio basics:', error);
    return { success: false, error: 'We couldn’t save your basic info. Try again.' };
  }
}

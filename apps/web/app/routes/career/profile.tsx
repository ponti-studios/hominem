import { userContext } from '~/lib/middleware';
import { ProfilePage } from '~/modules/career/components/account/ProfilePage';
import type { AccountActionResult, ProfileLoaderData } from '~/modules/career/lib/account/types';
import { formText, parseFormData } from '~/modules/career/lib/route-utils';
import {
  createCareerServerClient,
  uploadCareerProfileImage,
} from '~/modules/career/lib/server-client';

import type { Route } from './+types/profile';

export const meta = () => [{ title: 'Profile | Hominem' }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response('Unauthorized', { status: 401 });

  const career = createCareerServerClient(request);
  const [profileRes, socialRes, documentsRes, certificationsRes] = await Promise.all([
    career.profile.detail.$get(),
    career['social-links'].$get(),
    career.documents.$get(),
    career.certifications.$get({ query: {} }),
  ]);

  if (!profileRes.ok) throw new Response('Profile not found', { status: 404 });
  const { profile } = await profileRes.json();
  if (!profile) throw new Response('Profile not found', { status: 404 });

  const data: ProfileLoaderData = {
    user: { id: user.id, name: user.name, email: user.email },
    currentProfile: profile,
    hasProfile: true,
    socialLinks: socialRes.ok ? (await socialRes.json()).socialLinks : null,
    documents: documentsRes.ok ? (await documentsRes.json()).documents : [],
    certifications: certificationsRes.ok ? (await certificationsRes.json()).certifications : [],
  };

  return data;
}

export async function action({ request }: Route.ActionArgs): Promise<AccountActionResult<unknown>> {
  const formData = await request.formData();
  const action = formData.get('action');
  if (typeof action !== 'string' || !action) {
    throw new Response('Invalid action', { status: 400 });
  }

  const career = createCareerServerClient(request);

  switch (action) {
    case 'delete': {
      const response = await career.profile.$delete();
      return response.ok
        ? { success: true, message: 'Profile deleted successfully' }
        : { success: false, error: 'Failed to delete profile' };
    }
    case 'upload-profile-image': {
      const image = formData.get('image');
      if (!(image instanceof File)) {
        return { success: false, error: 'No image file provided' };
      }
      const response = await uploadCareerProfileImage(request, image);
      if (!response.ok) return { success: false, error: 'Failed to upload image' };
      const result = await response.json();
      return {
        success: true,
        message: 'Profile image updated successfully',
        data: { imageUrl: result.imageUrl },
      };
    }
    case 'update-slug': {
      const response = await career.profile.$patch({
        json: { slug: formText(formData, 'slug') ?? null },
      });
      if (!response.ok) return { success: false, error: 'That profile URL is already taken.' };
      return {
        success: true,
        message: 'Profile URL updated successfully',
        data: { slug: formText(formData, 'slug') ?? '' },
      };
    }
    case 'update-visibility': {
      const isPublic = formData.get('isPublic') === 'true';
      const response = await career.profile.$patch({ json: { isPublic } });
      return response.ok
        ? {
            success: true,
            message: isPublic ? 'Profile is now public' : 'Profile is now private',
            data: { isPublic },
          }
        : { success: false, error: "We couldn't update your profile visibility." };
    }
    case 'update-basics': {
      const parsed = parseFormData<{
        name?: string;
        initials?: string | null;
        title?: string | null;
        jobTitle?: string;
        bio?: string;
        tagline?: string;
        currentLocation?: string;
        email?: string;
        phone?: string | null;
        availabilityStatus?: boolean;
        openToRemote?: boolean;
      }>(formData, 'profileData');
      if (!('name' in parsed)) {
        return { success: false, error: 'Your changes couldn’t be read. Refresh and try again.' };
      }
      const [firstName, ...rest] = (parsed.name ?? '').split(' ');
      const response = await career.profile.$patch({
        json: {
          firstName,
          lastName: rest.join(' ') || null,
          headline: parsed.jobTitle ?? null,
          summary: parsed.bio ?? null,
          location: parsed.currentLocation ?? null,
          email: parsed.email ?? null,
          phone: parsed.phone ?? null,
          initials: parsed.initials ?? null,
          tagline: parsed.tagline ?? null,
          title: parsed.title ?? null,
          availabilityStatus: parsed.availabilityStatus ?? false,
          openToRemote: parsed.openToRemote ?? false,
        },
      });
      return response.ok
        ? { success: true, message: 'Profile basics updated successfully' }
        : { success: false, error: 'We couldn’t save your basic info. Try again.' };
    }
    case 'update-social-links': {
      const parsed = parseFormData<{
        github?: string | null;
        linkedin?: string | null;
        twitter?: string | null;
        website?: string | null;
      }>(formData, 'socialLinksData');
      if (!('github' in parsed) && !('linkedin' in parsed)) {
        return {
          success: false,
          error: 'Your social links couldn’t be read. Refresh and try again.',
        };
      }
      const response = await career['social-links'].save.$post({
        json: {
          github: parsed.github ?? null,
          linkedin: parsed.linkedin ?? null,
          twitter: parsed.twitter ?? null,
          website: parsed.website ?? null,
        },
      });
      return response.ok
        ? { success: true, message: 'Social links saved successfully' }
        : { success: false, error: 'We couldn’t save your social links. Try again.' };
    }
    case 'delete-document': {
      const fileId = formText(formData, 'fileId')?.trim();
      if (!fileId) return { success: false, error: 'Choose a file to delete.' };
      const response = await career.documents[':id'].$delete({ param: { id: fileId } });
      if (!response.ok) return { success: false, error: 'That file was not found.' };
      return { success: true, message: 'File deleted' };
    }
    case 'add-certification': {
      const name = formText(formData, 'name')?.trim();
      const issuingOrganization = formText(formData, 'issuingOrganization')?.trim();
      if (!name || !issuingOrganization) {
        return { success: false, error: 'Name and issuing organization are required.' };
      }
      const response = await career.certifications.create.$post({
        json: {
          name,
          issuingOrganization,
          issueDate: formText(formData, 'issueDate') || null,
        },
      });
      return response.ok
        ? { success: true, message: 'Certification added' }
        : { success: false, error: "We couldn't add that certification. Try again." };
    }
    case 'delete-certification': {
      const id = formText(formData, 'id');
      if (!id) return { success: false, error: 'Choose a certification to remove.' };
      const response = await career.certifications.delete.$post({ json: { id } });
      return response.ok
        ? { success: true, message: 'Certification removed' }
        : { success: false, error: "We couldn't remove that certification. Try again." };
    }
    case 'apply-resume-import': {
      const jobId = formText(formData, 'jobId');
      if (!jobId) return { success: false, error: 'Missing resume analysis job.' };
      const response = await career.resume.import.$post({
        json: {
          jobId,
          scalarKeys: formData.getAll('scalarField').map(String),
          listKeys: formData.getAll('listKey').map(String),
        },
      });
      return response.ok
        ? { success: true, message: 'Resume changes applied.' }
        : { success: false, error: "We couldn't apply those changes. Try again." };
    }
    default:
      throw new Response('Invalid action', { status: 400 });
  }
}

export default function ProfileRoute({ loaderData }: Route.ComponentProps) {
  return <ProfilePage loaderData={loaderData} />;
}

import { Switch } from '@ponti-studios/ui/forms';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm, type SubmitHandler } from 'react-hook-form';
import { useRevalidator } from 'react-router';

import { BackLink, DetailSection, PageHeader, PanelState } from '~/components/design';
import { Container } from '~/components/design/container';
import { Button } from '~/components/ui/button';
import {
  BasicInfoForm,
  profileToFormValues,
} from '~/modules/career/components/account/BasicInfoForm';
import { CertificationsSection } from '~/modules/career/components/account/CertificationsSection';
import { ResumeImportSection } from '~/modules/career/components/account/ResumeImportSection';
import { SocialLinksSection } from '~/modules/career/components/account/SocialLinksSection';
import { FormErrorAlert } from '~/modules/career/components/FormErrorAlert';
import { SaveBar } from '~/modules/career/components/SaveBar';
import { SlugEditor } from '~/modules/career/components/SlugEditor';
import type {
  AccountActionResult,
  BasicInfoFormValues,
  CertificationFormValues,
  ProfileDetailsFormValues,
  ProfileLoaderData,
  SocialLinksFormValues,
} from '~/modules/career/lib/account/types';

const SOCIAL_KEYS: readonly string[] = [
  'github',
  'linkedin',
  'twitter',
  'website',
] satisfies (keyof SocialLinksFormValues)[];

export function ProfilePage({ loaderData }: { loaderData: ProfileLoaderData }) {
  const revalidator = useRevalidator();
  const { user, currentProfile, socialLinks, documents, certifications } = loaderData;
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isPublic, setIsPublic] = useState(currentProfile.isPublic);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const lockedEmail = user.email || currentProfile.email || '';
  const detailsDefaultValues = (): ProfileDetailsFormValues => ({
    ...profileToFormValues(currentProfile, lockedEmail),
    github: socialLinks?.github || '',
    linkedin: socialLinks?.linkedin || '',
    twitter: socialLinks?.twitter || '',
    website: socialLinks?.website || '',
  });

  const detailsForm = useForm<ProfileDetailsFormValues>({
    defaultValues: detailsDefaultValues(),
  });
  const {
    handleSubmit: handleDetailsSubmit,
    reset: resetDetails,
    formState: { isDirty: detailsDirty, isSubmitting: detailsSubmitting, dirtyFields },
  } = detailsForm;

  useEffect(() => {
    resetDetails(detailsDefaultValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile, socialLinks, lockedEmail, resetDetails]);

  const submitProfileAction = async <TData,>(
    formData: FormData,
  ): Promise<AccountActionResult<TData>> => {
    const response = await fetch('/career/profile', {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get('content-type');
    const result: AccountActionResult<TData> = contentType?.includes('application/json')
      ? await response.json()
      : {
          success: response.ok,
          error: response.ok ? undefined : await response.text(),
        };

    if (!response.ok) {
      throw new Error(result.error || result.message || 'Request failed');
    }

    return result;
  };

  const handleUpdateSlug = async (slug: string) => {
    const formData = new FormData();
    formData.append('action', 'update-slug');
    formData.append('slug', slug);
    formData.append('profileId', currentProfile.id);

    await submitProfileAction<{ slug: string }>(formData);
    revalidator.revalidate();
  };

  const handleToggleVisibility = async (checked: boolean) => {
    const previous = isPublic;
    setIsPublic(checked);
    setIsTogglingVisibility(true);

    const formData = new FormData();
    formData.append('action', 'update-visibility');
    formData.append('isPublic', String(checked));

    try {
      const result = await submitProfileAction<{ isPublic: boolean }>(formData);
      if (result.success === false) {
        setIsPublic(previous);
      } else {
        revalidator.revalidate();
      }
    } catch {
      setIsPublic(previous);
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!currentProfile.slug || !isPublic) {
      setPdfError('Make your profile public before generating a PDF.');
      return;
    }

    try {
      setPdfGenerating(true);
      setPdfError(null);

      const workerUrl = import.meta.env.VITE_CAREER_PDF_WORKER_URL;
      if (!workerUrl) {
        setPdfError('PDF export is not configured for this environment.');
        return;
      }

      const profileUrl = `${window.location.origin}/p/${currentProfile.slug}`;

      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: profileUrl,
          ownerUserid: user.id,
        }),
      });

      const result: {
        success?: boolean;
        pdfUrl?: string;
        message?: string;
      } = await response.json();

      if (result.success && result.pdfUrl) {
        window.open(result.pdfUrl, '_blank');
        return;
      }

      setPdfError(result.message || 'Failed to generate PDF');
    } catch {
      setPdfError('Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDeleteDocument = async (fileId: string) => {
    const formData = new FormData();
    formData.append('action', 'delete-document');
    formData.append('fileId', fileId);
    const result = await submitProfileAction(formData);
    if (result.success === false) {
      throw new Error(result.error || 'Failed to delete file');
    }
    revalidator.revalidate();
  };

  const handleImageUpload = async (croppedImageBlob: Blob) => {
    const formData = new FormData();
    formData.append('image', croppedImageBlob, 'profile-image.jpg');
    formData.append('action', 'upload-profile-image');

    const result = await submitProfileAction<{ imageUrl: string }>(formData);
    revalidator.revalidate();

    return result.data?.imageUrl;
  };

  const handleSaveBasics = async (values: BasicInfoFormValues) => {
    const formData = new FormData();
    formData.append('action', 'update-basics');
    formData.append('profileData', JSON.stringify(values));

    const result = await submitProfileAction(formData);
    revalidator.revalidate();
    return result;
  };

  const handleSaveSocialLinks = async (values: SocialLinksFormValues) => {
    const formData = new FormData();
    formData.append('action', 'update-social-links');
    formData.append('socialLinksData', JSON.stringify(values));

    const result = await submitProfileAction(formData);
    revalidator.revalidate();
    return result;
  };

  const onSaveDetails: SubmitHandler<ProfileDetailsFormValues> = async (values) => {
    setDetailsError(null);

    const dirtyKeys = Object.keys(dirtyFields);
    const socialChanged = dirtyKeys.some((key) => SOCIAL_KEYS.includes(key));
    const basicsChanged = dirtyKeys.some((key) => !SOCIAL_KEYS.includes(key));

    try {
      const results = await Promise.all([
        basicsChanged ? handleSaveBasics(values) : null,
        socialChanged
          ? handleSaveSocialLinks({
              github: values.github,
              linkedin: values.linkedin,
              twitter: values.twitter,
              website: values.website,
            })
          : null,
      ]);

      const failed = results.find((result) => result && result.success === false);
      if (failed) {
        setDetailsError(failed.error || "We couldn't save your changes. Try again.");
        return;
      }

      resetDetails(values);
    } catch (error) {
      setDetailsError(
        error instanceof Error ? error.message : "We couldn't save your changes. Try again.",
      );
    }
  };

  const handleAddCertification = async (values: CertificationFormValues) => {
    const formData = new FormData();
    formData.append('action', 'add-certification');
    formData.append('name', values.name);
    formData.append('issuingOrganization', values.issuingOrganization);
    if (values.issueDate) formData.append('issueDate', values.issueDate);

    const result = await submitProfileAction(formData);
    revalidator.revalidate();
    return result;
  };

  const handleDeleteCertification = async (id: string) => {
    const formData = new FormData();
    formData.append('action', 'delete-certification');
    formData.append('id', id);

    const result = await submitProfileAction(formData);
    if (result.success === false) {
      throw new Error(result.error || 'Failed to remove certification');
    }
    revalidator.revalidate();
  };

  return (
    <Container size="sm">
      <BackLink to="/career" label="Career" />
      <PageHeader
        eyebrow="Career · Profile"
        title="Profile"
        actions={
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownloadPdf()}
              disabled={pdfGenerating}
            >
              <Download className="size-4" />
              {pdfGenerating ? 'Generating PDF…' : 'Download PDF'}
            </Button>
            {!isPublic ? (
              <p className="mt-1 px-1 text-[13px] text-muted-foreground">
                Make your profile public to generate a PDF.
              </p>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <DetailSection title="Visibility">
          <div className="mb-4 flex items-start justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {isPublic
                ? 'Anyone with the link can view your profile at this URL.'
                : 'Private — only you can see this. Turn it on to share it.'}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {isPublic ? 'Public' : 'Private'}
              </span>
              <Switch
                checked={isPublic}
                disabled={isTogglingVisibility}
                onCheckedChange={handleToggleVisibility}
                aria-label="Toggle profile visibility"
              />
            </div>
          </div>
          <SlugEditor
            profileId={currentProfile.id}
            initialSlug={currentProfile.slug || ''}
            liveUrl={isPublic && currentProfile.slug ? `/p/${currentProfile.slug}` : null}
            onSave={handleUpdateSlug}
          />
        </DetailSection>

        {pdfError ? <PanelState title="PDF export unavailable" description={pdfError} /> : null}

        <ResumeImportSection documents={documents} onDelete={handleDeleteDocument} />

        <FormProvider {...detailsForm}>
          <form onSubmit={handleDetailsSubmit(onSaveDetails)} className="flex flex-col gap-4">
            <FormErrorAlert title="Profile changes weren't saved" message={detailsError} />

            <DetailSection title="Basics">
              <BasicInfoForm profile={currentProfile} onImageUpload={handleImageUpload} />
            </DetailSection>

            <SocialLinksSection />

            <SaveBar dirty={detailsDirty} isSaving={detailsSubmitting} />
          </form>
        </FormProvider>

        <CertificationsSection
          certifications={certifications}
          onAdd={handleAddCertification}
          onDelete={handleDeleteCertification}
        />
      </div>
    </Container>
  );
}

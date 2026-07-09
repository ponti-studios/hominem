import type { PortfolioRecord } from '@hominem/db';
import { Button, Input, Switch, Textarea } from '@hominem/ui';
import { useEffect, useState } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';

import { FormErrorAlert } from '~/components/FormErrorAlert';
import { ProfileImageUpload } from '~/components/ProfileImageUpload';
import { SlugEditor } from '~/components/SlugEditor';
import type { AccountActionResult, BasicInfoFormValues } from '~/lib/account/types';

export function BasicInfoForm({
  portfolio,
  accountEmail,
  onSave,
  onImageUpload,
  onUpdateSlug,
}: {
  portfolio: PortfolioRecord;
  accountEmail?: string | null;
  onSave: (values: BasicInfoFormValues) => Promise<AccountActionResult<unknown>>;
  onImageUpload: (croppedImageBlob: Blob) => Promise<string | undefined>;
  onUpdateSlug: (slug: string) => Promise<void>;
}) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);

  const lockedEmail = accountEmail || portfolio.email || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
    control,
    getValues,
    setValue,
    watch,
  } = useForm<BasicInfoFormValues>({
    defaultValues: portfolioToFormValues(portfolio, lockedEmail),
  });

  const displayName = watch('name') || portfolio.name || lockedEmail || 'Profile';

  useEffect(() => {
    reset(portfolioToFormValues(portfolio, lockedEmail));
  }, [portfolio, lockedEmail, reset]);

  const onSubmit: SubmitHandler<BasicInfoFormValues> = async (formData) => {
    if (!isDirty) {
      return;
    }

    setSubmissionError(null);
    const result = await onSave({ ...formData, email: lockedEmail });

    if (result.success === false) {
      setSubmissionError(result.error || 'We couldn’t save your basic info. Try again.');
      return;
    }

    reset({ ...formData, email: lockedEmail });
  };

  const handleAvailabilityChange = async (checked: boolean) => {
    const previous = getValues('availabilityStatus') ?? false;
    setValue('availabilityStatus', checked, { shouldDirty: false });
    setIsTogglingAvailability(true);
    setSubmissionError(null);

    const result = await onSave({
      ...getValues(),
      email: lockedEmail,
      availabilityStatus: checked,
    });

    setIsTogglingAvailability(false);

    if (result.success === false) {
      setValue('availabilityStatus', previous, { shouldDirty: false });
      setSubmissionError(result.error || 'We couldn’t update availability. Try again.');
      return;
    }

    reset({ ...getValues(), email: lockedEmail, availabilityStatus: checked });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormErrorAlert title="Basic info wasn’t saved" message={submissionError} />

      <section className="space-y-5">
        <div className="flex items-center gap-4">
          <ProfileImageUpload
            compact
            currentImageUrl={portfolio.profileImageUrl || undefined}
            onUpload={onImageUpload}
          />
          <div className="min-w-0 space-y-1">
            <p className="subheading-3 truncate">{displayName}</p>
            <p className="body-4 text-muted-foreground">
              Updated {new Date(portfolio.updatedat).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="email" className="subheading-4 text-muted-foreground">
              Email
            </label>
            <Input id="email" type="email" value={lockedEmail} disabled readOnly />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label htmlFor="portfolio-slug" className="subheading-4 text-muted-foreground">
              Portfolio URL
            </label>
            <SlugEditor
              portfolioId={portfolio.id}
              initialSlug={portfolio.slug}
              liveUrl={portfolio.isPublic ? `/p/${portfolio.slug}` : null}
              onSave={(slug) => onUpdateSlug(slug)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label htmlFor="name" className="subheading-4 text-muted-foreground">
              Full Name
            </label>
            <Input id="name" {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="body-4 text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="initials" className="subheading-4 text-muted-foreground">
              Initials
            </label>
            <Input id="initials" {...register('initials')} maxLength={10} />
          </div>
          <div className="space-y-1">
            <label htmlFor="jobTitle" className="subheading-4 text-muted-foreground">
              Job Title
            </label>
            <Input id="jobTitle" {...register('jobTitle', { required: 'Job title is required' })} />
            {errors.jobTitle && (
              <p className="body-4 text-destructive">{errors.jobTitle.message}</p>
            )}
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="tagline" className="subheading-4 text-muted-foreground">
              Tagline
            </label>
            <Input
              id="tagline"
              {...register('tagline', { required: 'Tagline is required' })}
              maxLength={500}
            />
            {errors.tagline && <p className="body-4 text-destructive">{errors.tagline.message}</p>}
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="bio" className="subheading-4 text-muted-foreground">
              Bio
            </label>
            <Textarea
              id="bio"
              {...register('bio', { required: 'Bio is required' })}
              rows={4}
              className="resize-none"
            />
            {errors.bio && <p className="body-4 text-destructive">{errors.bio.message}</p>}
          </div>
        </div>
      </section>

      <EditorSection title="Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="phone" className="subheading-4 text-muted-foreground">
              Phone
            </label>
            <Input id="phone" {...register('phone')} maxLength={50} />
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Location">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="currentLocation" className="subheading-4 text-muted-foreground">
              Location
            </label>
            <Input
              id="currentLocation"
              {...register('currentLocation', { required: 'Location is required' })}
              maxLength={255}
            />
            {errors.currentLocation && (
              <p className="body-4 text-destructive">{errors.currentLocation.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="locationTagline" className="subheading-4 text-muted-foreground">
              Location tagline
            </label>
            <Input id="locationTagline" {...register('locationTagline')} maxLength={255} />
          </div>
        </div>
      </EditorSection>

      <section className="border-t border-border pt-6">
        <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-4">
          <p className="subheading-4 text-foreground">Open to opportunities</p>
          <Controller
            name="availabilityStatus"
            control={control}
            render={({ field }) => (
              <Switch
                id="availabilityStatus"
                checked={field.value}
                disabled={isTogglingAvailability || isSubmitting}
                onCheckedChange={(checked) => {
                  void handleAvailabilityChange(checked);
                }}
              />
            )}
          />
        </div>
      </section>

      <Button
        type="submit"
        disabled={isSubmitting || isTogglingAvailability || !isDirty}
        variant="default"
        className="w-full rounded-full sm:w-auto sm:px-6"
        isLoading={isSubmitting}
        loadingLabel="Saving..."
      >
        Save changes
      </Button>
    </form>
  );
}

function portfolioToFormValues(
  portfolio: PortfolioRecord,
  email: string,
): BasicInfoFormValues {
  return {
    name: portfolio.name || '',
    initials: portfolio.initials || '',
    title: portfolio.title || '',
    jobTitle: portfolio.jobTitle || '',
    bio: portfolio.bio || '',
    tagline: portfolio.tagline || '',
    currentLocation: portfolio.currentLocation || '',
    locationTagline: portfolio.locationTagline || '',
    email,
    phone: portfolio.phone || '',
    availabilityStatus: portfolio.availabilityStatus || false,
    availabilityMessage: portfolio.availabilityMessage || '',
    isPublic: portfolio.isPublic,
    isActive: portfolio.isActive,
  };
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h3 className="subheading-3">{title}</h3>
      {children}
    </section>
  );
}

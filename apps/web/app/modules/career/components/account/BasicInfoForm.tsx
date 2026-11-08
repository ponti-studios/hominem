import { Input, Switch, Textarea } from '@ponti-studios/ui/forms';
import { Phone } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';

import { Field } from '~/components/design/form-field';
import { FormGrid, IconField } from '~/components/design/forms';
import { ProfileImageUpload } from '~/modules/career/components/ProfileImageUpload';
import type { ProfileDetailsFormValues } from '~/modules/career/lib/account/types';
import type { CareerProfileRecord } from '~/modules/career/lib/types/records';

// Hooks into the page-level react-hook-form context (not its own form) so
// this fieldset shares dirty state and the save action with ProfilePage's SaveBar.
export function BasicInfoForm({
  profile,
  onImageUpload,
}: {
  profile: CareerProfileRecord;
  onImageUpload: (croppedImageBlob: Blob) => Promise<string | undefined>;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProfileDetailsFormValues>();

  return (
    <div className="flex flex-col gap-5">
      <ProfileImageUpload
        compact
        currentImageUrl={profile.profileImageUrl || undefined}
        onUpload={onImageUpload}
      />

      <FormGrid>
        <div className="md:col-span-2">
          <Field label="Full Name" error={errors.name?.message}>
            {(id) => <Input id={id} {...register('name', { required: 'Name is required' })} />}
          </Field>
        </div>
        <Field label="Initials">
          {(id) => <Input id={id} {...register('initials')} maxLength={10} />}
        </Field>
        <Field label="Job Title" error={errors.jobTitle?.message}>
          {(id) => (
            <Input id={id} {...register('jobTitle', { required: 'Job title is required' })} />
          )}
        </Field>
        <div className="md:col-span-2">
          <Field label="Tagline" error={errors.tagline?.message}>
            {(id) => (
              <Input
                id={id}
                {...register('tagline', { required: 'Tagline is required' })}
                maxLength={500}
              />
            )}
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Bio" error={errors.bio?.message}>
            {(id) => (
              <Textarea
                id={id}
                {...register('bio', { required: 'Bio is required' })}
                rows={4}
                className="resize-none"
              />
            )}
          </Field>
        </div>
      </FormGrid>

      <Controller
        name="phone"
        control={control}
        render={({ field }) => (
          <IconField
            label="Phone"
            icon={<Phone className="size-4" aria-hidden />}
            name="phone"
            field={{
              value: field.value ?? '',
              name: field.name,
              onChange: (value: string) => field.onChange(value),
              onBlur: () => {
                field.onBlur();
              },
            }}
            maxLength={50}
          />
        )}
      />

      <div className="flex flex-col gap-4">
        <Field label="Location" error={errors.currentLocation?.message}>
          {(id) => (
            <Input
              id={id}
              {...register('currentLocation', { required: 'Location is required' })}
              maxLength={255}
            />
          )}
        </Field>

        <div className="flex max-w-fit items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
          <p className="text-sm font-medium text-[#f2f4f8]">Open to remote</p>
          <Controller
            name="openToRemote"
            control={control}
            render={({ field }) => (
              <Switch id="openToRemote" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        <div className="flex max-w-fit items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
          <p className="text-sm font-medium text-[#f2f4f8]">Open to opportunities</p>
          <Controller
            name="availabilityStatus"
            control={control}
            render={({ field }) => (
              <Switch
                id="availabilityStatus"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}

export function profileToFormValues(
  profile: CareerProfileRecord,
  email: string,
): Pick<
  ProfileDetailsFormValues,
  | 'email'
  | 'name'
  | 'availabilityStatus'
  | 'bio'
  | 'currentLocation'
  | 'initials'
  | 'jobTitle'
  | 'openToRemote'
  | 'phone'
  | 'tagline'
  | 'title'
> {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || '';
  return {
    email,
    name,
    availabilityStatus: profile.availabilityStatus || false,
    bio: profile.summary || '',
    currentLocation: profile.location || '',
    initials: profile.initials || '',
    jobTitle: profile.headline || '',
    openToRemote: profile.openToRemote || false,
    phone: profile.phone || '',
    tagline: profile.tagline || '',
    title: profile.title || '',
  };
}

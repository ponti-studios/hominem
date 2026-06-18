import type { CareerPortfolioRecord } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Input } from '@hominem/ui/input';
import { Switch } from '@hominem/ui/switch';
import { Textarea } from '@hominem/ui/textarea';
import { useEffect, useState } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';

import { FormErrorAlert } from '~/components/FormErrorAlert';
import type { AccountActionResult, BasicInfoFormValues } from '~/lib/account/types';

export function BasicInfoForm({
  portfolio,
  onSave,
}: {
  portfolio: CareerPortfolioRecord;
  onSave: (values: BasicInfoFormValues) => Promise<AccountActionResult<unknown>>;
}) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
    control,
  } = useForm<BasicInfoFormValues>({
    defaultValues: {
      name: portfolio.name || '',
      initials: portfolio.initials || '',
      title: portfolio.title || '',
      job_title: portfolio.job_title || '',
      bio: portfolio.bio || '',
      tagline: portfolio.tagline || '',
      current_location: portfolio.current_location || '',
      location_tagline: portfolio.location_tagline || '',
      email: portfolio.email || '',
      phone: portfolio.phone || '',
      availability_status: portfolio.availability_status || false,
      availability_message: portfolio.availability_message || '',
      is_public: portfolio.is_public,
      is_active: portfolio.is_active,
    },
  });

  useEffect(() => {
    reset({
      name: portfolio.name || '',
      initials: portfolio.initials || '',
      title: portfolio.title || '',
      job_title: portfolio.job_title || '',
      bio: portfolio.bio || '',
      tagline: portfolio.tagline || '',
      current_location: portfolio.current_location || '',
      location_tagline: portfolio.location_tagline || '',
      email: portfolio.email || '',
      phone: portfolio.phone || '',
      availability_status: portfolio.availability_status || false,
      availability_message: portfolio.availability_message || '',
      is_public: portfolio.is_public,
      is_active: portfolio.is_active,
    });
  }, [portfolio, reset]);

  const onSubmit: SubmitHandler<BasicInfoFormValues> = async (formData) => {
    if (!isDirty) {
      return;
    }

    setSubmissionError(null);
    const result = await onSave(formData);

    if (result.success === false) {
      setSubmissionError(result.error || 'We couldn’t save your basic info. Try again.');
      return;
    }

    reset(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormErrorAlert title="Basic info wasn’t saved" message={submissionError} />
      <EditorSection title="Personal">
        <div className="grid gap-4 md:grid-cols-2">
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
            <label htmlFor="job_title" className="subheading-4 text-muted-foreground">
              Job Title
            </label>
            <Input
              id="job_title"
              {...register('job_title', { required: 'Job title is required' })}
            />
            {errors.job_title && (
              <p className="body-4 text-destructive">{errors.job_title.message}</p>
            )}
          </div>
          <div className="space-y-1">
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
      </EditorSection>

      <EditorSection title="Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="email" className="subheading-4 text-muted-foreground">
              Email
            </label>
            <Input
              id="email"
              type="email"
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' },
              })}
            />
            {errors.email && <p className="body-4 text-destructive">{errors.email.message}</p>}
          </div>
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
            <label htmlFor="current_location" className="subheading-4 text-muted-foreground">
              Location
            </label>
            <Input
              id="current_location"
              {...register('current_location', { required: 'Location is required' })}
              maxLength={255}
            />
            {errors.current_location && (
              <p className="body-4 text-destructive">{errors.current_location.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor="location_tagline" className="subheading-4 text-muted-foreground">
              Location tagline
            </label>
            <Input id="location_tagline" {...register('location_tagline')} maxLength={255} />
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Availability">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-4">
            <p className="subheading-4 text-foreground">Open to opportunities</p>
            <Controller
              name="availability_status"
              control={control}
              render={({ field }) => (
                <Switch
                  id="availability_status"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
      </EditorSection>

      <Button
        type="submit"
        disabled={isSubmitting || !isDirty}
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

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h3 className="subheading-3">{title}</h3>
      {children}
    </section>
  );
}

import { CareerRepository, getDb } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Switch } from '@hominem/ui/switch';
import { useEffect } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import type { ActionFunctionArgs, MetaFunction } from 'react-router';
import { useFetcher, useOutletContext } from 'react-router';

import { useToast } from '../hooks/useToast';
import type { FullPortfolio } from '../lib/portfolio.server';
import { createSuccessResponse, parseFormData, withAuthAction } from '../lib/route-utils';

export interface BasicInfoFormValues {
  name: string;
  initials?: string | null;
  title?: string | null;
  jobTitle: string;
  bio: string;
  tagline: string;
  currentLocation: string;
  locationTagline?: string | null;
  email: string;
  phone?: string | null;
  availabilityStatus?: boolean;
  availabilityMessage?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
}

export const meta: MetaFunction = () => {
  return [{ title: 'Basic Info - Portfolio Editor | Craftd' }];
};

// Server action to save portfolio data
export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData();
    const portfolioDataResult = parseFormData<BasicInfoFormValues>(formData, 'portfolioData');
    if ('success' in portfolioDataResult && !portfolioDataResult.success) {
      return portfolioDataResult;
    }
    const portfolioData = portfolioDataResult as BasicInfoFormValues;

    await CareerRepository.savePortfolioBasics(getDb(), user.id, portfolioData);
    return createSuccessResponse(null, 'Portfolio saved successfully');
  });
}

export default function EditorBasic() {
  // Consume portfolio provided by parent editor layout loader via outlet context
  const portfolio = useOutletContext<FullPortfolio>();
  const fetcher = useFetcher();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    control,
    watch,
  } = useForm<BasicInfoFormValues>({
    defaultValues: {
      name: portfolio.name || '',
      initials: portfolio.initials || '',
      title: portfolio.title || '',
      jobTitle: portfolio.jobTitle || '',
      bio: portfolio.bio || '',
      tagline: portfolio.tagline || '',
      currentLocation: portfolio.currentLocation || '',
      locationTagline: portfolio.locationTagline || '',
      email: portfolio.email || '',
      phone: portfolio.phone || '',
      availabilityStatus: portfolio.availabilityStatus || false,
      availabilityMessage: portfolio.availabilityMessage || '',
      isPublic: portfolio.isPublic,
      isActive: portfolio.isActive,
    },
  });

  useEffect(() => {
    reset({
      name: portfolio.name || '',
      initials: portfolio.initials || '',
      title: portfolio.title || '',
      jobTitle: portfolio.jobTitle || '',
      bio: portfolio.bio || '',
      tagline: portfolio.tagline || '',
      currentLocation: portfolio.currentLocation || '',
      locationTagline: portfolio.locationTagline || '',
      email: portfolio.email || '',
      phone: portfolio.phone || '',
      availabilityStatus: portfolio.availabilityStatus || false,
      availabilityMessage: portfolio.availabilityMessage || '',
      isPublic: portfolio.isPublic,
      isActive: portfolio.isActive,
    });
  }, [portfolio, reset]);

  // Handle fetcher errors and success
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as { success: boolean; error?: string; message?: string };
      if (result.success) {
        addToast(result.message || 'Basic info updated successfully!', 'success');
      } else {
        addToast(`Failed to update basic info: ${result.error || 'Unknown error'}`, 'error');
      }
    }
  }, [fetcher.state, fetcher.data, addToast]);

  const onSubmit: SubmitHandler<BasicInfoFormValues> = (formData) => {
    if (!isDirty) {
      addToast('No changes made to submit.', 'info');
      return;
    }

    // Clean up the data - only send essential fields
    const portfolioToSave: BasicInfoFormValues = {
      name: formData.name,
      initials: formData.initials,
      title: formData.title,
      jobTitle: formData.jobTitle,
      bio: formData.bio,
      tagline: formData.tagline,
      currentLocation: formData.currentLocation,
      locationTagline: formData.locationTagline,
      email: formData.email,
      phone: formData.phone,
      availabilityStatus: formData.availabilityStatus,
      availabilityMessage: formData.availabilityMessage,
      isPublic: portfolio.isPublic,
      isActive: portfolio.isActive,
    };

    const formData2 = new FormData();
    formData2.append('portfolioData', JSON.stringify(portfolioToSave));

    fetcher.submit(formData2, {
      method: 'POST',
      action: '/editor/basic',
    });
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <section className="flex flex-col gap-8 mx-auto">
      <h2 className="text-2xl font-semibold text-foreground">Basic Information</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information Card */}
        <div className="rounded-md border border-border bg-card p-4 space-y-6">
          <h3 className="text-lg font-medium text-foreground">Personal Information</h3>
          <div>
            <label htmlFor="name" className="label">
              Full Name
            </label>
            <input
              id="name"
              {...register('name', { required: 'Name is required' })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
            />
            {errors.name && <p className="error-message">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="initials" className="label">
              Initials (Optional)
            </label>
            <input
              id="initials"
              {...register('initials')}
              maxLength={10}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
            />
          </div>
          <div>
            <label htmlFor="jobTitle" className="label">
              Job Title / Professional Title
            </label>
            <input
              id="jobTitle"
              {...register('jobTitle', { required: 'Job title is required' })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
            />
            {errors.jobTitle && <p className="error-message">{errors.jobTitle.message}</p>}
          </div>
          <div>
            <label htmlFor="tagline" className="label">
              Tagline (Short, catchy phrase)
            </label>
            <input
              id="tagline"
              {...register('tagline', { required: 'Tagline is required' })}
              maxLength={500}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
            />
            {errors.tagline && <p className="error-message">{errors.tagline.message}</p>}
          </div>
          <div>
            <label htmlFor="bio" className="label">
              Bio / Description
            </label>
            <textarea
              id="bio"
              {...register('bio', { required: 'Bio is required' })}
              rows={5}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-28 mt-1"
            />
            {errors.bio && <p className="error-message">{errors.bio.message}</p>}
          </div>
        </div>

        {/* Contact Information Card */}
        <div className="rounded-md border border-border bg-card p-4 space-y-6">
          <h3 className="text-lg font-medium text-foreground">Contact Information</h3>
          <div>
            <label htmlFor="email" className="label">
              Contact Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' },
              })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
            />
            {errors.email && <p className="error-message">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="phone" className="label">
              Phone (Optional)
            </label>
            <input
              id="phone"
              {...register('phone')}
              maxLength={50}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
            />
          </div>
        </div>

        {/* Location Information Card */}
        <div className="rounded-md border border-border bg-card p-4 space-y-6">
          <h3 className="text-lg font-medium text-foreground">Location Information</h3>
          <div>
            <label htmlFor="currentLocation" className="label">
              Current Location (e.g., City, Country)
            </label>
            <input
              id="currentLocation"
              {...register('currentLocation', { required: 'Location is required' })}
              maxLength={255}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
            />
            {errors.currentLocation && (
              <p className="error-message">{errors.currentLocation.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="locationTagline" className="label">
              Location Tagline (Optional)
            </label>
            <input
              id="locationTagline"
              {...register('locationTagline')}
              maxLength={255}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
            />
          </div>
        </div>

        {/* Availability Information Card */}
        <div className="rounded-md border border-border bg-card p-4 space-y-6">
          <h3 className="text-lg font-medium text-foreground">Availability</h3>
          <div>
            <label htmlFor="availabilityStatus" className="label mb-2">
              Available for new opportunities?
            </label>
            <div className="flex items-center">
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
              <span className="ml-3 text-sm text-muted-foreground">
                {watch('availabilityStatus') ? 'Yes, I am available' : 'No, I am not available'}
              </span>
            </div>
          </div>
          {watch('availabilityStatus') && (
            <div>
              <label htmlFor="availabilityMessage" className="label">
                Availability Message (Optional)
              </label>
              <input
                id="availabilityMessage"
                {...register('availabilityMessage')}
                maxLength={500}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 mt-1"
              />
            </div>
          )}
        </div>

        <div>
          <Button
            type="submit"
            disabled={isSaving || !isDirty}
            variant="primary"
            className="w-full"
          >
            {isSaving ? 'Saving...' : 'Save Basic Info'}
          </Button>
        </div>
      </form>
    </section>
  );
}

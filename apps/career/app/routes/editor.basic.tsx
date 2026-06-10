import { CareerRepository, db } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardHeader } from '@hominem/ui/card';
import { Input } from '@hominem/ui/input';
import { Switch } from '@hominem/ui/switch';
import { useEffect } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import type { ActionFunctionArgs, MetaFunction } from 'react-router';
import { useFetcher, useOutletContext } from 'react-router';

import { useToast } from '../hooks/useToast';
import type { FullPortfolio } from '../lib/portfolio.server';
import { userContext } from '../lib/middleware';
import { createSuccessResponse, parseFormData } from '../lib/route-utils';

export interface BasicInfoFormValues {
  name: string;
  initials?: string | null;
  title?: string | null;
  job_title: string;
  bio: string;
  tagline: string;
  current_location: string;
  location_tagline?: string | null;
  email: string;
  phone?: string | null;
  availability_status?: boolean;
  availability_message?: string | null;
  is_public?: boolean;
  is_active?: boolean;
}

export const meta: MetaFunction = () => {
  return [{ title: 'Basic Info - Portfolio Editor | Craftd' }];
};

// Server action to save portfolio data
export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return createSuccessResponse(null, 'User not found');
  }
  const formData = await request.formData();
  const portfolioDataResult = parseFormData<BasicInfoFormValues>(formData, 'portfolioData');
  if ('success' in portfolioDataResult && !portfolioDataResult.success) {
    return portfolioDataResult;
  }
  const portfolioData = portfolioDataResult as BasicInfoFormValues;

  await CareerRepository.savePortfolioBasics(db, user.id, portfolioData);
  return createSuccessResponse(null, 'Portfolio saved successfully');
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
      job_title: formData.job_title,
      bio: formData.bio,
      tagline: formData.tagline,
      current_location: formData.current_location,
      location_tagline: formData.location_tagline,
      email: formData.email,
      phone: formData.phone,
      availability_status: formData.availability_status,
      availability_message: formData.availability_message,
      is_public: portfolio.is_public,
      is_active: portfolio.is_active,
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
    <section className="flex flex-col gap-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Personal
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                Full Name
              </label>
              <Input id="name" {...register('name', { required: 'Name is required' })} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="initials" className="text-xs font-medium text-muted-foreground">
                Initials
              </label>
              <Input id="initials" {...register('initials')} maxLength={10} />
            </div>
            <div className="space-y-1">
              <label htmlFor="job_title" className="text-xs font-medium text-muted-foreground">
                Job Title
              </label>
              <Input
                id="job_title"
                {...register('job_title', { required: 'Job title is required' })}
              />
              {errors.job_title && (
                <p className="text-xs text-destructive">{errors.job_title.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="tagline" className="text-xs font-medium text-muted-foreground">
                Tagline
              </label>
              <Input
                id="tagline"
                {...register('tagline', { required: 'Tagline is required' })}
                maxLength={500}
              />
              {errors.tagline && (
                <p className="text-xs text-destructive">{errors.tagline.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="bio" className="text-xs font-medium text-muted-foreground">
                Bio
              </label>
              <textarea
                id="bio"
                {...register('bio', { required: 'Bio is required' })}
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
              />
              {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
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
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="phone" className="text-xs font-medium text-muted-foreground">
                Phone
              </label>
              <Input id="phone" {...register('phone')} maxLength={50} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Location
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="current_location"
                className="text-xs font-medium text-muted-foreground"
              >
                Location
              </label>
              <Input
                id="current_location"
                {...register('current_location', { required: 'Location is required' })}
                maxLength={255}
              />
              {errors.current_location && (
                <p className="text-xs text-destructive">{errors.current_location.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label
                htmlFor="location_tagline"
                className="text-xs font-medium text-muted-foreground"
              >
                Location tagline
              </label>
              <Input id="location_tagline" {...register('location_tagline')} maxLength={255} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Availability
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
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
              <label htmlFor="availability_status" className="text-sm text-muted-foreground">
                {watch('availability_status') ? 'Open to opportunities' : 'Not available'}
              </label>
            </div>
            {watch('availability_status') && (
              <div className="space-y-1">
                <label
                  htmlFor="availability_message"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Availability note
                </label>
                <Input
                  id="availability_message"
                  {...register('availability_message')}
                  maxLength={500}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSaving || !isDirty} variant="default" className="w-full">
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </section>
  );
}

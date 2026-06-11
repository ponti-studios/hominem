import { useAuthClient } from '@hominem/auth/client/provider';
import { CareerRepository, db, type CareerPortfolioRecord } from '@hominem/db';
import { createStorageService, validateFile } from '@hominem/storage';
import { Badge } from '@hominem/ui/badge';
import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardHeader } from '@hominem/ui/card';
import { Input } from '@hominem/ui/input';
import { Switch } from '@hominem/ui/switch';
import { Download, Edit, ExternalLink, LogOut, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { useNavigate, useRevalidator, useSubmit, useFetcher } from 'react-router';

import { cn } from '~/lib/utils';

import { ProfileImageUpload } from '../components/ProfileImageUpload';
import { SlugEditor } from '../components/SlugEditor';
import { UploadResumeForm } from '../components/UploadResumeForm';
import { useToast } from '../hooks/useToast';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import { Route } from './+types/account';

const profileImageStorage = createStorageService('images', {
  maxFileSize: 5 * 1024 * 1024,
  isPublic: true,
});
const PROFILE_IMAGE_VALIDATION = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const currentPortfolio = context.get(portfolioContext);
  const portfolioRows = await CareerRepository.listPortfoliosByUserId(db, user.id);
  const portfolios: Portfolio[] = portfolioRows.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    is_public: p.is_public,
    is_active: p.is_active,
    updatedat: p.updatedat,
    name: p.name,
    job_title: p.job_title,
    bio: p.bio,
    profile_image_url: p.profile_image_url || undefined,
  }));
  return {
    user,
    portfolios,
    currentPortfolio: currentPortfolio ?? null,
    currentPortfolioId: currentPortfolio?.id ?? null,
    hasPortfolio: portfolios.length > 0,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const formData = await request.formData();
  {
    const action = formData.get('action');
    const portfolio_id = formData.get('portfolio_id');

    if (action === 'delete' && portfolio_id) {
      try {
        await CareerRepository.deletePortfolio(db, user.id, portfolio_id as string);
        return { message: 'Portfolio deleted successfully' };
      } catch (error) {
        console.error('Failed to delete portfolio:', error);
        throw new Response('Failed to delete portfolio', { status: 500 });
      }
    }

    if (action === 'set-current-portfolio' && portfolio_id) {
      try {
        await CareerRepository.setCurrentPortfolioByUserId(db, user.id, portfolio_id as string);
        return { message: 'Current portfolio updated successfully' };
      } catch (error) {
        console.error('Failed to update current portfolio:', error);
        throw new Response('Failed to update current portfolio', { status: 500 });
      }
    }

    if (action === 'upload-profile-image') {
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
          throw new Response(
            uploadError instanceof Error ? uploadError.message : 'Failed to upload image',
            { status: 500 },
          );
        }

        try {
          await CareerRepository.updatePortfolioProfileImage(db, user.id, uploadResult.url);
        } catch (updateError) {
          console.error('Database update error:', updateError);
          await profileImageStorage.deleteFile(uploadResult.id, user.id);
          throw new Response('Failed to update portfolio', { status: 500 });
        }

        return {
          message: 'Profile image updated successfully',
          data: { image_url: uploadResult.url },
        };
      } catch (error) {
        if (error instanceof Response) throw error;
        console.error('Failed to upload profile image:', error);
        throw new Response('Failed to upload profile image', { status: 500 });
      }
    }

    if (action === 'update-slug') {
      try {
        const newSlug = formData.get('slug') as string;
        const portfolio_id = formData.get('portfolio_id') as string;

        if (!newSlug || !portfolio_id) {
          throw new Response('Slug and portfolio ID are required', { status: 400 });
        }

        // Basic slug validation
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

        const isAvailable = await CareerRepository.isSlugAvailable(db, newSlug, portfolio_id);

        if (!isAvailable) {
          throw new Response('Slug is already taken', { status: 400 });
        }

        await CareerRepository.updatePortfolioSlug(db, user.id, portfolio_id, newSlug);

        return { message: 'Portfolio URL updated successfully', data: { slug: newSlug } };
      } catch (error) {
        if (error instanceof Response) throw error;
        console.error('Failed to update portfolio URL:', error);
        throw new Response('Failed to update portfolio URL', { status: 500 });
      }
    }

    if (action === 'update-basics') {
      const portfolioDataResult = parseFormData<BasicInfoFormValues>(formData, 'portfolioData');
      if ('success' in portfolioDataResult && !portfolioDataResult.success) {
        throw new Response('Invalid portfolio data', { status: 400 });
      }
      const portfolioData = portfolioDataResult as BasicInfoFormValues;
      try {
        await CareerRepository.savePortfolioBasics(db, user.id, portfolioData);
        return { message: 'Portfolio basics updated successfully' };
      } catch (error) {
        console.error('Failed to update portfolio basics:', error);
        throw new Response('Failed to update portfolio basics', { status: 500 });
      }
    }

    throw new Response('Invalid action', { status: 400 });
  }
}

interface BasicInfoFormValues {
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

interface Portfolio {
  id: string;
  title: string;
  slug: string;
  is_public: boolean;
  is_active: boolean;
  updatedat: string | Date;
  name?: string;
  job_title?: string;
  bio?: string;
  profile_image_url?: string;
}

function BasicInfoForm({ portfolio }: { portfolio: CareerPortfolioRecord }) {
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

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as { success: boolean; error?: string; message?: string };
      if (result.success) {
        addToast(result.message || 'Basic info updated!', 'success');
      } else {
        addToast(`Failed to update: ${result.error || 'Unknown error'}`, 'error');
      }
    }
  }, [fetcher.state, fetcher.data, addToast]);

  const onSubmit: SubmitHandler<BasicInfoFormValues> = (formData) => {
    if (!isDirty) {
      addToast('No changes to save.', 'info');
      return;
    }
    const fd = new FormData();
    fd.append('action', 'update-basics');
    fd.append('portfolioData', JSON.stringify(formData));
    fetcher.submit(fd, { method: 'POST', action: '/account' });
  };

  const isSaving = fetcher.state === 'submitting';

  return (
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
            {errors.tagline && <p className="text-xs text-destructive">{errors.tagline.message}</p>}
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
            <label htmlFor="current_location" className="text-xs font-medium text-muted-foreground">
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
            <label htmlFor="location_tagline" className="text-xs font-medium text-muted-foreground">
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
  );
}

export function meta() {
  return [
    { title: 'Account' },
    { name: 'description', content: 'Manage your portfolio and account settings' },
  ];
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const submit = useSubmit();
  const authClient = useAuthClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showReplaceResume, setShowReplaceResume] = useState(false);

  const { user, portfolios, currentPortfolioId, currentPortfolio } = loaderData;
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await authClient.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeletePortfolio = (portfolio_id: string) => {
    if (confirm('Are you sure you want to delete this portfolio? This action cannot be undone.')) {
      const formData = new FormData();
      formData.append('action', 'delete');
      formData.append('portfolio_id', portfolio_id);

      submit(formData, { method: 'post' });
    }
  };

  const handleSetCurrentPortfolio = (portfolio_id: string) => {
    const formData = new FormData();
    formData.append('action', 'set-current-portfolio');
    formData.append('portfolio_id', portfolio_id);

    submit(formData, { method: 'post' });
  };

  const handleImageUpload = async (croppedImageBlob: Blob) => {
    const formData = new FormData();
    formData.append('image', croppedImageBlob, 'profile-image.jpg');
    formData.append('action', 'upload-profile-image');

    const response = await fetch('/account', {
      method: 'POST',
      body: formData,
    });

    const result = (await response.json()) as {
      success: boolean;
      error?: string;
      data?: { image_url: string };
    };

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    revalidator.revalidate();

    return result.data?.image_url;
  };

  const handleReplaceResumeComplete = () => {
    setShowReplaceResume(false);
    revalidator.revalidate();
  };

  const handleDownloadPdf = async () => {
    if (!currentPortfolio?.slug || !currentPortfolio.is_public) {
      setPdfError('Portfolio must be public to generate PDF');
      return;
    }

    try {
      setPdfGenerating(true);
      setPdfError(null);

      const portfolioUrl = `${window.location.origin}/p/${currentPortfolio.slug}`;

      const response = await fetch('https://craftd-worker.fly.dev/trigger-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: portfolioUrl,
          owner_userid: user.id,
        }),
      });

      const result = await response.json();

      if (result.success && result.pdfUrl) {
        // Open the PDF in a new tab for download
        window.open(result.pdfUrl, '_blank');
      } else {
        setPdfError(result.message || 'Failed to generate PDF');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      setPdfError('Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const userDisplayName = String(user.name || user.email);

  return (
    <div className="py-2">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Account</h1>
        </div>

        <Card className="max-w-fit justify-self-end">
          <CardContent className="flex space-x-2">
            <ProfileImageUpload
              compact
              currentImageUrl={currentPortfolio?.profile_image_url}
              onUpload={handleImageUpload}
            />

            <div className="flex flex-col items-start">
              <h3 className="text-base font-medium">{userDisplayName}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Management Section */}
        <div className="mb-6">
          {currentPortfolio ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="space-y-3 sm:hidden">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Portfolio</h2>
                    {currentPortfolio.is_public && (
                      <a
                        href={`/p/${currentPortfolio.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 border border-border rounded-md text-xs font-medium text-muted-foreground bg-card hover:bg-muted"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-xs">View</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="outline"
                        className={
                          currentPortfolio.is_public
                            ? 'border-accent/30 bg-accent/10 text-foreground'
                            : 'border-border bg-muted text-foreground'
                        }
                      >
                        {currentPortfolio.is_public ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Desktop: Horizontal layout */}
                <div className="hidden sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-lg font-semibold">Portfolio</h2>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="outline"
                        className={
                          currentPortfolio.is_public
                            ? 'border-accent/30 bg-accent/10 text-foreground'
                            : 'border-border bg-muted text-foreground'
                        }
                      >
                        {currentPortfolio.is_public ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                  </div>

                  {currentPortfolio.is_public && (
                    <a
                      href={`/p/${currentPortfolio.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 border border-border rounded-md text-sm font-medium text-muted-foreground bg-card hover:bg-muted"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Live
                    </a>
                  )}
                </div>

                <div className="mt-4 space-y-4">
                  {/* Editable Portfolio URL */}
                  <SlugEditor
                    portfolio_id={currentPortfolio.id}
                    initialSlug={currentPortfolio.slug}
                  />

                  <div className="bg-accent/10 border border-accent/30 rounded-md p-3">
                    <p className="text-sm text-foreground">
                      Want a fresh portfolio? Create a new one from a resume upload or replace this
                      portfolio from here.
                    </p>
                  </div>

                  {showReplaceResume ? (
                    <div className="rounded-md border border-warning/30 bg-warning/10 p-4 space-y-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Replace portfolio</p>
                        <p className="text-sm text-foreground">
                          This will delete the current portfolio and rebuild it from the uploaded
                          resume.
                        </p>
                      </div>

                      <UploadResumeForm
                        mode="replace"
                        onUploadStart={() => undefined}
                        onUploadComplete={handleReplaceResumeComplete}
                        onUploadError={() => undefined}
                      />

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => setShowReplaceResume(false)}
                          variant="ghost"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {portfolios.length > 1 ? (
                    <div className="rounded-md border border-border bg-card p-4 space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          Choose current portfolio
                        </p>
                        <p className="text-sm text-muted-foreground">
                          This portfolio powers the editor, customize tools, and public API views.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {portfolios.map((portfolioOption) => {
                          const isCurrent = portfolioOption.id === currentPortfolio.id;

                          return (
                            <div
                              key={portfolioOption.id}
                              className={cn(
                                'flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between',
                                isCurrent
                                  ? 'border-primary/30 bg-primary/5'
                                  : 'border-border bg-background',
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {portfolioOption.title}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  /p/{portfolioOption.slug}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {isCurrent ? (
                                  <Badge
                                    variant="outline"
                                    className="border-primary/30 bg-primary/10"
                                  >
                                    Current
                                  </Badge>
                                ) : (
                                  <Button
                                    type="button"
                                    onClick={() => handleSetCurrentPortfolio(portfolioOption.id)}
                                    variant="outline"
                                    size="sm"
                                  >
                                    Use this portfolio
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Responsive button layout */}
                  <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                    <Button
                      type="button"
                      onClick={() => navigate('/work')}
                      variant="default"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Portfolio
                    </Button>
                    <Button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={pdfGenerating || !currentPortfolio.is_public}
                      variant="outline"
                      size="sm"
                      className="w-full border-success/30 text-success hover:bg-success/10 sm:w-auto"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {pdfGenerating ? 'Generating PDF...' : 'Download PDF'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => navigate('/onboarding')}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto border-accent/30 text-primary hover:text-primary hover:bg-accent/10"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Create New Portfolio
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setShowReplaceResume((current) => !current)}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto border-warning/30 text-foreground hover:bg-warning/10"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Replace Portfolio
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDeletePortfolio(currentPortfolio.id)}
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 sm:w-auto"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Portfolio
                    </Button>
                  </div>

                  {pdfError && (
                    <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                      <p className="text-sm text-destructive">{pdfError}</p>
                    </div>
                  )}

                  {!currentPortfolio.is_public && (
                    <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3">
                      <p className="text-sm text-foreground">
                        Your portfolio must be public to generate a PDF. Make it public in the
                        editor to enable PDF downloads.
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(currentPortfolio.updatedat).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <p className="text-muted-foreground">
                  Start showcasing your skills and experience.
                </p>
                <Button
                  type="button"
                  onClick={() => navigate('/onboarding')}
                  variant="default"
                  className="inline-flex items-center justify-center"
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {currentPortfolio && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Portfolio Info</h2>
            <BasicInfoForm portfolio={currentPortfolio} />
          </div>
        )}

        <div className="border-t border-border pt-6 flex justify-end">
          <Button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            variant="default"
            className="w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </div>
      </div>
    </div>
  );
}

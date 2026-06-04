import { useAuthClient } from '@hominem/auth/client/provider';
import { CareerRepository, getDb } from '@hominem/db';
import { createStorageService, validateFile } from '@hominem/storage';
import { Badge } from '@hominem/ui/badge';
import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { Download, Edit, ExternalLink, LogOut, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useActionData, useLoaderData, useNavigate, useSubmit } from 'react-router';

import { ProfileImageUpload } from '../components/ProfileImageUpload';
import { SlugEditor } from '../components/SlugEditor';
import { getFullUserPortfolio } from '../lib/portfolio.server';
import {
  createErrorResponse,
  createSuccessResponse,
  tryAsync,
  withAuthAction,
  withAuthLoader,
} from '../lib/route-utils';
const profileImageStorage = createStorageService('images', {
  maxFileSize: 5 * 1024 * 1024,
  isPublic: true,
});
const PROFILE_IMAGE_VALIDATION = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

// Account loader - migrated from Svelte layout server
export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    const fullPortfolio = await getFullUserPortfolio(user.id);
    const portfolios: Portfolio[] = fullPortfolio
      ? [
          {
            id: fullPortfolio.id,
            title: fullPortfolio.title,
            slug: fullPortfolio.slug,
            is_public: fullPortfolio.is_public,
            is_active: fullPortfolio.is_active,
            updatedat: fullPortfolio.updatedat,
            name: fullPortfolio.name,
            job_title: fullPortfolio.job_title,
            bio: fullPortfolio.bio,
            profile_image_url: fullPortfolio.profile_image_url || undefined,
          },
        ]
      : [];
    return {
      user,
      portfolios,
      hasPortfolio: portfolios.length > 0,
    };
  });
}

// Server action for portfolio operations
export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData();
    const action = formData.get('action');
    const portfolio_id = formData.get('portfolio_id');

    if (action === 'delete' && portfolio_id) {
      return tryAsync(async () => {
        await CareerRepository.deletePortfolio(getDb(), user.id, portfolio_id as string);

        return createSuccessResponse(null, 'Portfolio deleted successfully');
      }, 'Failed to delete portfolio');
    }

    if (action === 'upload-profile-image') {
      return tryAsync(async () => {
        const imageFile = formData.get('image') as File | null;

        if (!imageFile) {
          return createErrorResponse('No image file provided');
        }

        const validation = validateFile(imageFile, PROFILE_IMAGE_VALIDATION);
        if (!validation.valid) {
          return createErrorResponse(validation.error || 'Invalid file');
        }

        let uploadResult: { id: string; url: string };
        try {
          const buffer = Buffer.from(await imageFile.arrayBuffer());
          uploadResult = await profileImageStorage.storeFile(buffer, imageFile.type, user.id, {
            originalName: imageFile.name,
          });
        } catch (uploadError) {
          return createErrorResponse(
            uploadError instanceof Error ? uploadError.message : 'Failed to upload image',
          );
        }

        try {
          await CareerRepository.updatePortfolioProfileImage(
            getDb(),
            user.id,
            uploadResult.url,
          );
        } catch (updateError) {
          console.error('Database update error:', updateError);
          await profileImageStorage.deleteFile(uploadResult.id, user.id);
          return createErrorResponse('Failed to update portfolio');
        }

        return createSuccessResponse(
          { image_url: uploadResult.url },
          'Profile image updated successfully',
        );
      }, 'Failed to upload profile image');
    }

    if (action === 'update-slug') {
      return tryAsync(async () => {
        const newSlug = formData.get('slug') as string;
        const portfolio_id = formData.get('portfolio_id') as string;

        if (!newSlug || !portfolio_id) {
          return createErrorResponse('Slug and portfolio ID are required');
        }

        // Basic slug validation
        if (!/^[a-z0-9-]+$/.test(newSlug)) {
          return createErrorResponse(
            'Slug can only contain lowercase letters, numbers, and hyphens',
          );
        }

        if (newSlug.length < 3) {
          return createErrorResponse('Slug must be at least 3 characters long');
        }

        if (newSlug.length > 50) {
          return createErrorResponse('Slug must be less than 50 characters long');
        }

        const isAvailable = await CareerRepository.isSlugAvailable(getDb(), newSlug, portfolio_id);

        if (!isAvailable) {
          return createErrorResponse('Slug is already taken');
        }

        await CareerRepository.updatePortfolioSlug(getDb(), user.id, portfolio_id, newSlug);

        return createSuccessResponse({ slug: newSlug }, 'Portfolio URL updated successfully');
      }, 'Failed to update portfolio URL');
    }

    return createErrorResponse('Invalid action');
  });
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

export function meta() {
  return [
    { title: 'Account - Craftd' },
    { name: 'description', content: 'Manage your portfolio and account settings' },
  ];
}

export default function Account() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const authClient = useAuthClient();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { user, portfolios, hasPortfolio } = loaderData;

  const portfolio = portfolios[0];
  const [profile_image_url, setProfileImageUrl] = useState(portfolio?.profile_image_url || undefined);
  const [uploadError, setUploadError] = useState<string | null>(null);
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

  const handleImageUpload = (image_url: string) => {
    setProfileImageUrl(image_url);
    setUploadError(null);
  };

  const handleImageError = (error: string) => {
    setUploadError(error);
  };

  const handleDownloadPdf = async () => {
    if (!portfolio?.slug || !portfolio.is_public) {
      setPdfError('Portfolio must be public to generate PDF');
      return;
    }

    try {
      setPdfGenerating(true);
      setPdfError(null);

      const portfolioUrl = `${window.location.origin}/p/${portfolio.slug}`;

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

  // User should be available from loader (requireAuth ensures this)
  if (!user) {
    navigate('/login');
    return null;
  }

  const userDisplayName = String(user.name || user.email);

  return (
    <div className="py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="-mt-4 space-y-2 text-center">
          <Badge variant="outline">Account</Badge>
          <p className="text-muted-foreground">Manage your portfolio and account settings</p>
        </div>

        {/* Profile Information Card */}
        <Card>
          <CardContent className="space-y-6 p-5 sm:p-6">
            <h3 className="heading-4 text-foreground">Profile Information</h3>

            <ProfileImageUpload
              currentImageUrl={portfolio?.profile_image_url}
              onImageUploaded={handleImageUpload}
              onError={handleImageError}
            />

            <div className="flex items-start">
              <div className="flex items-center space-x-4">
                <div>
                  <h3 className="text-lg font-medium">{userDisplayName}</h3>
                  <p className="text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{uploadError}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio Management Section */}
        <div className="mb-6">
          {portfolio ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="space-y-3 sm:hidden">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Portfolio</h2>
                    {portfolio.is_public && (
                      <a
                        href={`/p/${portfolio.slug}`}
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
                          portfolio.is_public
                            ? 'border-accent/30 bg-accent/10 text-foreground'
                            : 'border-border bg-muted text-foreground'
                        }
                      >
                        {portfolio.is_public ? 'Public' : 'Private'}
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
                          portfolio.is_public
                            ? 'border-accent/30 bg-accent/10 text-foreground'
                            : 'border-border bg-muted text-foreground'
                        }
                      >
                        {portfolio.is_public ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                  </div>

                  {portfolio.is_public && (
                    <a
                      href={`/p/${portfolio.slug}`}
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
                  <SlugEditor portfolio_id={portfolio.id} initialSlug={portfolio.slug} />

                  <div className="bg-accent/10 border border-accent/30 rounded-md p-3">
                    <p className="text-sm text-foreground">
                      Want to update your portfolio with a new resume? Use "Upload New Resume" to
                      replace your current portfolio data with fresh information from your updated
                      resume.
                    </p>
                  </div>

                  {/* Responsive button layout */}
                  <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                    <Button
                      type="button"
                      onClick={() => navigate('/editor')}
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
                      disabled={pdfGenerating || !portfolio.is_public}
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
                      Upload New Resume
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDeletePortfolio(portfolio.id)}
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

                  {!portfolio.is_public && (
                    <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3">
                      <p className="text-sm text-foreground">
                        Your portfolio must be public to generate a PDF. Make it public in the
                        editor to enable PDF downloads.
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(portfolio.updatedat).toLocaleDateString()}
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

        <div className="border-t border-border pt-6 flex justify-end">
          <Button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            variant="primary"
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

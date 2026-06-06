import { useAuthClient } from '@hominem/auth/client/provider';
import { CareerRepository, db } from '@hominem/db';
import { createStorageService, validateFile } from '@hominem/storage';
import { Badge } from '@hominem/ui/badge';
import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { Download, Edit, ExternalLink, LogOut, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, useRevalidator, useSubmit } from 'react-router';

import { cn } from '~/lib/utils';

import { ProfileImageUpload } from '../components/ProfileImageUpload';
import { SlugEditor } from '../components/SlugEditor';
import { UploadResumeForm } from '../components/UploadResumeForm';
import { userContext } from '../lib/middleware';
import { getFullUserPortfolio } from '../lib/portfolio.server';
import { createErrorResponse, createSuccessResponse, tryAsync } from '../lib/route-utils';

const profileImageStorage = createStorageService('images', {
  maxFileSize: 5 * 1024 * 1024,
  isPublic: true,
});
const PROFILE_IMAGE_VALIDATION = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(userContext)!;
  const [fullPortfolio, portfolioRows] = await Promise.all([
    getFullUserPortfolio(user.id),
    CareerRepository.listPortfoliosByUserId(db, user.id),
  ]);
  const portfolios: Portfolio[] = portfolioRows.map((portfolio) => ({
    id: portfolio.id,
    title: portfolio.title,
    slug: portfolio.slug,
    is_public: portfolio.is_public,
    is_active: portfolio.is_active,
    updatedat: portfolio.updatedat,
    name: portfolio.name,
    job_title: portfolio.job_title,
    bio: portfolio.bio,
    profile_image_url: portfolio.profile_image_url || undefined,
  }));
  return {
    user,
    portfolios,
    currentPortfolioId: fullPortfolio?.id ?? null,
    hasPortfolio: portfolios.length > 0,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.get(userContext)!;
  const formData = await request.formData();
  {
    const action = formData.get('action');
    const portfolio_id = formData.get('portfolio_id');

    if (action === 'delete' && portfolio_id) {
      return tryAsync(async () => {
        await CareerRepository.deletePortfolio(db, user.id, portfolio_id as string);

        return createSuccessResponse(null, 'Portfolio deleted successfully');
      }, 'Failed to delete portfolio');
    }

    if (action === 'set-current-portfolio' && portfolio_id) {
      return tryAsync(async () => {
        await CareerRepository.setCurrentPortfolioByUserId(db, user.id, portfolio_id as string);

        return createSuccessResponse(null, 'Current portfolio updated successfully');
      }, 'Failed to update current portfolio');
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
          await CareerRepository.updatePortfolioProfileImage(db, user.id, uploadResult.url);
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

        const isAvailable = await CareerRepository.isSlugAvailable(db, newSlug, portfolio_id);

        if (!isAvailable) {
          return createErrorResponse('Slug is already taken');
        }

        await CareerRepository.updatePortfolioSlug(db, user.id, portfolio_id, newSlug);

        return createSuccessResponse({ slug: newSlug }, 'Portfolio URL updated successfully');
      }, 'Failed to update portfolio URL');
    }

    return createErrorResponse('Invalid action');
  }
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
  const revalidator = useRevalidator();
  const submit = useSubmit();
  const authClient = useAuthClient();
  const loaderData = useLoaderData<typeof loader>();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showReplaceResume, setShowReplaceResume] = useState(false);

  const { user, portfolios, currentPortfolioId } = loaderData;

  const currentPortfolio =
    portfolios.find((portfolio) => portfolio.id === currentPortfolioId) ?? portfolios[0] ?? null;
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

  const handleImageUpload = () => revalidator.revalidate();

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

        <Card>
          <CardContent>
            <ProfileImageUpload
              compact
              currentImageUrl={currentPortfolio?.profile_image_url}
              onImageUploaded={handleImageUpload}
            />

            <div className="flex items-start">
              <div className="flex items-center space-x-3">
                <div>
                  <h3 className="text-base font-medium">{userDisplayName}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
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
                                    size="xs"
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

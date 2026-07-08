import { useAuthClient } from '@hominem/auth/client/provider';
import { Button } from '@hominem/ui';
import { useState } from 'react';
import { useNavigate, useRevalidator } from 'react-router';

import { AccountActions } from '~/components/account/AccountActions';
import { AccountHeader } from '~/components/account/AccountHeader';
import { BasicInfoForm } from '~/components/account/BasicInfoForm';
import { CurrentPortfolioSection } from '~/components/account/CurrentPortfolioSection';
import { SocialLinksSection } from '~/components/account/SocialLinksSection';
import type {
  AccountActionResult,
  AccountLoaderData,
  BasicInfoFormValues,
  SocialLinksFormValues,
} from '~/lib/account/types';

export function AccountPage({ loaderData }: { loaderData: AccountLoaderData }) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const authClient = useAuthClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showReplaceResume, setShowReplaceResume] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { user, portfolios, currentPortfolio, socialLinks } = loaderData;

  const submitAccountAction = async <TData,>(
    formData: FormData,
  ): Promise<AccountActionResult<TData>> => {
    const response = await fetch('/account', {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get('content-type');
    const result = contentType?.includes('application/json')
      ? ((await response.json()) as AccountActionResult<TData>)
      : {
          success: response.ok,
          error: response.ok ? undefined : await response.text(),
        };

    if (!response.ok) {
      throw new Error(result.error || result.message || 'Request failed');
    }

    return result;
  };

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

  const handleDeletePortfolio = async () => {
    if (!currentPortfolio) {
      return;
    }

    if (!confirm('Are you sure you want to delete this portfolio? This action cannot be undone.')) {
      return;
    }

    const formData = new FormData();
    formData.append('action', 'delete');
    formData.append('portfolioId', currentPortfolio.id);

    await submitAccountAction(formData);
    revalidator.revalidate();
  };

  const handleSetCurrentPortfolio = async (portfolioId: string) => {
    const formData = new FormData();
    formData.append('action', 'set-current-portfolio');
    formData.append('portfolioId', portfolioId);

    await submitAccountAction(formData);
    revalidator.revalidate();
  };

  const handleImageUpload = async (croppedImageBlob: Blob) => {
    const formData = new FormData();
    formData.append('image', croppedImageBlob, 'profile-image.jpg');
    formData.append('action', 'upload-profile-image');

    const result = await submitAccountAction<{ imageUrl: string }>(formData);
    revalidator.revalidate();

    return result.data?.imageUrl;
  };

  const handleUpdateSlug = async (slug: string) => {
    if (!currentPortfolio) {
      return;
    }

    const formData = new FormData();
    formData.append('action', 'update-slug');
    formData.append('slug', slug);
    formData.append('portfolioId', currentPortfolio.id);

    await submitAccountAction<{ slug: string }>(formData);
    revalidator.revalidate();
  };

  const handleSaveBasics = async (values: BasicInfoFormValues) => {
    const formData = new FormData();
    formData.append('action', 'update-basics');
    formData.append('portfolioData', JSON.stringify(values));

    const result = await submitAccountAction(formData);
    revalidator.revalidate();
    return result;
  };

  const handleSaveSocialLinks = async (values: SocialLinksFormValues) => {
    const formData = new FormData();
    formData.append('action', 'update-social-links');
    formData.append('socialLinksData', JSON.stringify(values));

    const result = await submitAccountAction(formData);
    revalidator.revalidate();
    return result;
  };

  const handleReplaceResumeComplete = () => {
    setShowReplaceResume(false);
    revalidator.revalidate();
  };

  const handleDownloadPdf = async () => {
    if (!currentPortfolio?.slug || !currentPortfolio.isPublic) {
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
          ownerUserid: user.id,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        pdfUrl?: string;
        message?: string;
      };

      if (result.success && result.pdfUrl) {
        window.open(result.pdfUrl, '_blank');
        return;
      }

      setPdfError(result.message || 'Failed to generate PDF');
    } catch (error) {
      console.error('PDF generation error:', error);
      setPdfError('Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const userDisplayName = String(user.name || user.email);
  const publicPortfolioUrl = currentPortfolio ? `/p/${currentPortfolio.slug}` : null;

  if (!currentPortfolio) {
    return (
      <div className="space-y-8 pb-8">
        <AccountHeader
          currentPortfolio={null}
          currentImageUrl={undefined}
          isSigningOut={isSigningOut}
          userDisplayName={userDisplayName}
          userEmail={user.email}
          onImageUpload={handleImageUpload}
          onSignOut={handleSignOut}
        />

        <section className="space-y-4 py-8 text-center">
          <h2 className="heading-3">Start with a resume upload</h2>
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={() => navigate('/onboarding')}
              variant="default"
              className="rounded-full px-6"
            >
              Get started
            </Button>
          </div>
        </section>

        <SocialLinksSection socialLinks={socialLinks} onSave={handleSaveSocialLinks} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <AccountHeader
        currentPortfolio={currentPortfolio}
        currentImageUrl={currentPortfolio.profileImageUrl || undefined}
        isSigningOut={isSigningOut}
        updatedAtLabel={`Updated ${new Date(currentPortfolio.updatedat).toLocaleDateString()}`}
        userDisplayName={userDisplayName}
        userEmail={user.email}
        onImageUpload={handleImageUpload}
        onSignOut={handleSignOut}
      />

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
        <section className="space-y-6">
          <CurrentPortfolioSection
            currentPortfolio={currentPortfolio}
            portfolios={portfolios}
            publicPortfolioUrl={publicPortfolioUrl}
            showReplaceResume={showReplaceResume}
            onReplaceResumeComplete={handleReplaceResumeComplete}
            onSetCurrentPortfolio={handleSetCurrentPortfolio}
            onToggleReplaceResume={() => setShowReplaceResume((current) => !current)}
            onUpdateSlug={handleUpdateSlug}
          />

          <section className="space-y-4">
            <BasicInfoForm portfolio={currentPortfolio} onSave={handleSaveBasics} />
          </section>

          <SocialLinksSection socialLinks={socialLinks} onSave={handleSaveSocialLinks} />
        </section>

        <aside className="space-y-8">
          <AccountActions
            canDownloadPdf={currentPortfolio.isPublic}
            isGeneratingPdf={pdfGenerating}
            onCreatePortfolio={() => navigate('/onboarding')}
            onDeletePortfolio={handleDeletePortfolio}
            onDownloadPdf={handleDownloadPdf}
            onEditPortfolio={() => navigate('/work')}
            onReplacePortfolio={() => setShowReplaceResume((current) => !current)}
          />

          {pdfError ? (
            <div className="rounded-2xl bg-destructive/10 p-4">
              <p className="subheading-4 text-destructive">PDF export unavailable</p>
              <p className="body-3 mt-1 text-destructive">{pdfError}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

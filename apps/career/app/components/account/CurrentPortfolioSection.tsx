import type { PortfolioRecord } from '@hominem/db';
import { Button } from '@hominem/ui';
import { ExternalLink } from 'lucide-react';

import { SlugEditor } from '~/components/SlugEditor';
import { UploadResumeForm } from '~/components/UploadResumeForm';

export function CurrentPortfolioSection({
  currentPortfolio,
  publicPortfolioUrl,
  showReplaceResume,
  onReplaceResumeComplete,
  onToggleReplaceResume,
  onUpdateSlug,
}: {
  currentPortfolio: PortfolioRecord;
  publicPortfolioUrl: string | null;
  showReplaceResume: boolean;
  onReplaceResumeComplete: () => void;
  onToggleReplaceResume: () => void;
  onUpdateSlug: (slug: string) => Promise<void>;
}) {
  return (
    <section className="space-y-5 border-b border-border pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="heading-3">{currentPortfolio.title}</h2>
        </div>

        {publicPortfolioUrl && currentPortfolio.isPublic ? (
          <a
            href={publicPortfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            View live
          </a>
        ) : null}
      </div>

      <div className="space-y-5">
        <SlugEditor
          portfolioId={currentPortfolio.id}
          initialSlug={currentPortfolio.slug}
          onSave={(slug) => onUpdateSlug(slug)}
        />

        {showReplaceResume ? (
          <div className="space-y-4 rounded-2xl bg-warning/10 p-4">
            <div className="space-y-1">
              <p className="subheading-4 text-foreground">Replace portfolio</p>
              <p className="body-3 text-foreground">
                This deletes the current portfolio and rebuilds it from the uploaded resume.
              </p>
            </div>

            <UploadResumeForm
              mode="replace"
              onUploadStart={() => undefined}
              onUploadComplete={() => onReplaceResumeComplete()}
              onUploadError={() => undefined}
            />

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => onToggleReplaceResume()}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

import { Badge, Button } from '@hominem/ui';
import { LogOut } from 'lucide-react';

import { ProfileImageUpload } from '~/components/ProfileImageUpload';

export function AccountHeader({
  currentPortfolio,
  currentImageUrl,
  isSigningOut,
  updatedAtLabel,
  userDisplayName,
  userEmail,
  onImageUpload,
  onSignOut,
}: {
  currentPortfolio: { slug: string; is_public: boolean } | null;
  currentImageUrl?: string;
  isSigningOut: boolean;
  updatedAtLabel?: string;
  userDisplayName: string;
  userEmail?: string | null;
  onImageUpload: (croppedImageBlob: Blob) => Promise<string | undefined>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <section className="border-b border-border pb-8">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <ProfileImageUpload
              compact
              currentImageUrl={currentImageUrl}
              onUpload={onImageUpload}
            />
            <div className="space-y-1">
              <h1 className="heading-2">{userDisplayName}</h1>
              <p className="body-3 text-muted-foreground">{userEmail}</p>
              {currentPortfolio ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="body-4 text-muted-foreground">/p/{currentPortfolio.slug}</span>
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
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => onSignOut()}
            disabled={isSigningOut}
            variant="ghost"
            className="rounded-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </div>

        {updatedAtLabel ? <p className="body-4 text-muted-foreground">{updatedAtLabel}</p> : null}
      </div>
    </section>
  );
}

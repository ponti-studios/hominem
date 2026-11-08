import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { PrefixInput } from '~/components/design/forms';
import { Button } from '~/components/ui/button';
import { careerApiUrl } from '~/modules/career/lib/api-url';

interface SlugEditorProps {
  profileId: string;
  initialSlug: string;
  liveUrl?: string | null;
  onSave: (newSlug: string) => Promise<void>;
}

interface ValidationState {
  isChecking: boolean;
  isAvailable: boolean | null;
  message: string;
  isValid: boolean;
}

const DEFAULT_SLUG_PLACEHOLDER = 'your-profile-name';

export function SlugEditor({ profileId, initialSlug, liveUrl, onSave }: SlugEditorProps) {
  const [slugValue, setSlugValue] = useState(initialSlug);
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({
    isChecking: false,
    isAvailable: null,
    message: '',
    isValid: true,
  });

  useEffect(() => {
    setSlugValue(initialSlug);
  }, [initialSlug]);

  const validateSlug = useCallback(
    async (slug: string) => {
      if (!slug || slug === initialSlug) {
        setValidation({ isChecking: false, isAvailable: null, message: '', isValid: true });
        return;
      }

      if (slug.length < 3) {
        setValidation({
          isChecking: false,
          isAvailable: false,
          message: 'Slug must be at least 3 characters long',
          isValid: false,
        });
        return;
      }

      if (slug.length > 50) {
        setValidation({
          isChecking: false,
          isAvailable: false,
          message: 'Slug must be less than 50 characters long',
          isValid: false,
        });
        return;
      }

      setValidation({
        isChecking: true,
        isAvailable: null,
        message: 'Checking availability...',
        isValid: true,
      });

      try {
        const query = new URLSearchParams({ slug, currentProfileId: profileId });
        const response = await fetch(
          `${careerApiUrl('/api/career/profile/slug-available')}?${query.toString()}`,
          { credentials: 'include' },
        );
        const data: {
          slug?: string;
          isAvailable?: boolean;
          message?: string;
        } = await response.json();

        if (response.ok && typeof data.isAvailable === 'boolean') {
          setValidation({
            isChecking: false,
            isAvailable: data.isAvailable,
            message: data.isAvailable ? 'Available' : 'That URL is already taken',
            isValid: data.isAvailable,
          });
        } else {
          setValidation({
            isChecking: false,
            isAvailable: false,
            message: data.message || 'Invalid slug format',
            isValid: false,
          });
        }
      } catch {
        setValidation({
          isChecking: false,
          isAvailable: false,
          message: 'Error checking availability',
          isValid: false,
        });
      }
    },
    [profileId, initialSlug],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      validateSlug(slugValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [slugValue, validateSlug]);

  const handleSave = async () => {
    if (!validation.isValid || !validation.isAvailable || slugValue === initialSlug || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(slugValue);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    setSlugValue(newValue.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const canSave =
    validation.isValid && validation.isAvailable && slugValue !== initialSlug && !isSaving;

  const getValidationStatus = () => {
    if (!slugValue || slugValue === initialSlug) return null;

    if (validation.isChecking) {
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    }

    if (validation.isAvailable) {
      return <Check className="w-4 h-4 text-success" />;
    }

    if (validation.isAvailable === false) {
      return <X className="w-4 h-4 text-destructive" />;
    }

    return null;
  };

  const statusIcon = getValidationStatus();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <PrefixInput
            label="Profile URL"
            labelHidden
            name="slug"
            prefix="career.dev/p/"
            value={slugValue}
            onChange={handleInputChange}
            placeholder={DEFAULT_SLUG_PLACEHOLDER}
            error={validation.isValid ? null : validation.message || 'Invalid slug'}
            hint={
              validation.isValid
                ? validation.message || 'Lowercase letters, numbers, and hyphens only.'
                : undefined
            }
            suffix={statusIcon}
          />
        </div>

        {liveUrl ? (
          <Button
            asChild
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="View live"
          >
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
            </a>
          </Button>
        ) : null}

        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          variant="outline"
          className="shrink-0"
        >
          {isSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
